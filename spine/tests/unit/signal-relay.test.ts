import { afterEach, describe, expect, it } from 'bun:test';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
	buildAttachmentUploadBody,
	loadRelayConfig,
	postAttachment,
	resolveAttachmentPath,
	spineBaseFromCaptureUrl,
	validateRelayConfig,
} from '../../src/signal-relay';

let tempDirs: string[] = [];

function tempDir(): string {
	const dir = mkdtempSync(join(tmpdir(), 'lattice-signal-relay-'));
	tempDirs.push(dir);
	return dir;
}

afterEach(() => {
	for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
	tempDirs = [];
});

describe('relay config helpers', () => {
	it('loads defaults from env shape', () => {
		const config = loadRelayConfig({ LATTICE_AGENT_TOKEN: 'token', SIGNAL_PHONE_NUMBER: '+1555' });
		expect(config).toMatchObject({
			agentToken: 'token',
			signalPhone: '+1555',
			rpcHost: '127.0.0.1:7583',
			spineUrl: 'http://127.0.0.1:3000/api/agent/capture',
			signalAttachmentsDir: '',
		});
	});

	it('reports missing required config', () => {
		expect(validateRelayConfig(loadRelayConfig({}))).toEqual([
			'LATTICE_AGENT_TOKEN is required',
			'SIGNAL_PHONE_NUMBER is required',
		]);
	});

	it('derives spine base from capture URL', () => {
		expect(spineBaseFromCaptureUrl('http://127.0.0.1:3000/api/agent/capture')).toBe(
			'http://127.0.0.1:3000',
		);
	});
});

describe('attachment path safety', () => {
	it('resolves attachment ids inside the configured directory', async () => {
		const dir = tempDir();
		writeFileSync(join(dir, 'att-1'), 'hello');

		const resolved = await resolveAttachmentPath(dir, 'att-1');
		expect(resolved).toEndWith('/att-1');
	});

	it('rejects traversal outside the configured directory', async () => {
		const dir = tempDir();
		writeFileSync(join(dir, 'att-1'), 'hello');
		writeFileSync(join(dir, '..', 'outside-lattice-signal-relay'), 'secret');

		await expect(resolveAttachmentPath(dir, '../outside-lattice-signal-relay')).rejects.toThrow(
			'escapes configured directory',
		);
	});

	it('rejects symlinks that resolve outside the configured directory', async () => {
		const dir = tempDir();
		const outside = tempDir();
		writeFileSync(join(outside, 'secret'), 'secret');
		symlinkSync(join(outside, 'secret'), join(dir, 'link'));

		await expect(resolveAttachmentPath(dir, 'link')).rejects.toThrow(
			'escapes configured directory',
		);
	});
});

describe('attachment upload helpers', () => {
	it('builds a base64 upload payload with metadata defaults', async () => {
		const dir = tempDir();
		const path = join(dir, 'att-1');
		writeFileSync(path, 'hello');

		const body = await buildAttachmentUploadBody({ id: 'att-1' }, path);
		expect(body).toEqual({
			signal_id: 'att-1',
			content_type: 'application/octet-stream',
			filename: '',
			data: Buffer.from('hello').toString('base64'),
			size_bytes: 5,
		});
	});

	it('posts attachment bytes to the agent attachment endpoint', async () => {
		const dir = tempDir();
		writeFileSync(join(dir, 'att-1'), 'hello');
		const requests: Array<{ url: string; init: RequestInit }> = [];
		const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
			requests.push({ url: String(url), init: init ?? {} });
			return new Response(JSON.stringify({ id: 99 }), { status: 200 });
		};

		await postAttachment(
			42,
			{ id: 'att-1', contentType: 'text/plain', filename: 'note.txt', size: 123 },
			{
				attachmentsDir: dir,
				spineBase: 'http://spine.local',
				agentToken: 'token',
				fetchImpl,
			},
		);

		expect(requests).toHaveLength(1);
		expect(requests[0].url).toBe('http://spine.local/api/agent/capture/42/attachments');
		expect(requests[0].init.headers).toMatchObject({
			authorization: 'Bearer token',
			'x-forwarded-proto': 'https',
		});
		expect(JSON.parse(String(requests[0].init.body))).toMatchObject({
			signal_id: 'att-1',
			content_type: 'text/plain',
			filename: 'note.txt',
			data: Buffer.from('hello').toString('base64'),
			size_bytes: 123,
		});
	});

	it('skips attachments that are missing an id', async () => {
		let calls = 0;
		const fetchImpl = async () => {
			calls += 1;
			return new Response(JSON.stringify({ id: 1 }), { status: 200 });
		};

		await postAttachment(
			42,
			{},
			{ attachmentsDir: tempDir(), spineBase: 'http://spine', fetchImpl },
		);
		expect(calls).toBe(0);
	});
});
