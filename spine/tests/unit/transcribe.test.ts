import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
	transcribeAudioFile,
	TerminalTranscriptionError,
	TransientTranscriptionError,
	type FetchLike,
} from '../../src/transcribe';

const noSleep = async () => {};

let dir: string;
let audioPath: string;
const envBackup: Record<string, string | undefined> = {};

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), 'transcribe-test-'));
	audioPath = join(dir, 'note.ogg');
	writeFileSync(audioPath, 'fake-opus-bytes');
	envBackup.LATTICE_ASR_MODEL = process.env.LATTICE_ASR_MODEL;
	envBackup.QMD_EMBED_API_URL = process.env.QMD_EMBED_API_URL;
	process.env.LATTICE_ASR_MODEL = 'test-asr';
	// getQmdBaseUrl reads config.toml only; point XDG at a config dir with a base url.
	envBackup.XDG_CONFIG_HOME = process.env.XDG_CONFIG_HOME;
	const cfgDir = join(dir, 'lattice');
	mkdirp(cfgDir);
	writeFileSync(
		join(cfgDir, 'config.toml'),
		'[spine.qmd]\nembed_api_url = "http://ai.test/v1"\nembed_api_model = "m"\n',
	);
	process.env.XDG_CONFIG_HOME = dir;
});

function mkdirp(p: string) {
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	require('node:fs').mkdirSync(p, { recursive: true });
}

afterEach(() => {
	for (const [k, v] of Object.entries(envBackup)) {
		if (v === undefined) delete process.env[k];
		else process.env[k] = v;
	}
	rmSync(dir, { recursive: true, force: true });
});

function opts(fetchImpl: FetchLike, retryDelaysMs: number[] = []) {
	return {
		storedFullPath: audioPath,
		filename: 'note.ogg',
		contentType: 'audio/ogg',
		fetchImpl,
		retryDelaysMs,
		sleep: noSleep,
	};
}

describe('transcribeAudioFile', () => {
	it('returns text and model id on success', async () => {
		const fetchImpl = (async (url: any, init: any) => {
			expect(String(url)).toBe('http://ai.test/v1/audio/transcriptions');
			const form = init.body as FormData;
			expect(form.get('model')).toBe('test-asr');
			expect(form.get('file')).toBeInstanceOf(Blob);
			return new Response(JSON.stringify({ text: 'hello world' }), { status: 200 });
		}) as FetchLike;

		const result = await transcribeAudioFile(opts(fetchImpl));
		expect(result).toEqual({ text: 'hello world', modelId: 'test-asr' });
	});

	it('classifies 400 as terminal and does not retry', async () => {
		let calls = 0;
		const fetchImpl = (async () => {
			calls++;
			return new Response(
				JSON.stringify({ error: { message: 'undecodable', type: 'invalid_request_error' } }),
				{ status: 400 },
			);
		}) as FetchLike;

		await expect(transcribeAudioFile(opts(fetchImpl, [0, 0]))).rejects.toBeInstanceOf(
			TerminalTranscriptionError,
		);
		expect(calls).toBe(1);
	});

	it('retries transient 5xx with bounded backoff then throws transient', async () => {
		let calls = 0;
		const fetchImpl = (async () => {
			calls++;
			return new Response('busy', { status: 503 });
		}) as FetchLike;

		await expect(transcribeAudioFile(opts(fetchImpl, [0, 0, 0]))).rejects.toBeInstanceOf(
			TransientTranscriptionError,
		);
		expect(calls).toBe(4); // initial attempt + 3 retries
	});

	it('recovers when a retry succeeds', async () => {
		let calls = 0;
		const fetchImpl = (async () => {
			calls++;
			if (calls < 3) throw new Error('connection refused');
			return new Response(JSON.stringify({ text: 'recovered' }), { status: 200 });
		}) as FetchLike;

		const result = await transcribeAudioFile(opts(fetchImpl, [0, 0, 0]));
		expect(result.text).toBe('recovered');
		expect(calls).toBe(3);
	});

	it('classifies network errors as transient', async () => {
		const fetchImpl = (async () => {
			throw new Error('ECONNREFUSED');
		}) as FetchLike;

		await expect(transcribeAudioFile(opts(fetchImpl))).rejects.toBeInstanceOf(
			TransientTranscriptionError,
		);
	});

	it('treats a malformed success body as transient', async () => {
		const fetchImpl: FetchLike = async () => new Response('not json', { status: 200 });
		await expect(transcribeAudioFile(opts(fetchImpl))).rejects.toBeInstanceOf(
			TransientTranscriptionError,
		);
	});

	it('is terminal when asr_model is unset', async () => {
		delete process.env.LATTICE_ASR_MODEL;
		// config.toml above sets no asr_model
		const fetchImpl: FetchLike = async () => new Response('{}', { status: 200 });
		await expect(transcribeAudioFile(opts(fetchImpl))).rejects.toBeInstanceOf(
			TerminalTranscriptionError,
		);
	});
});
