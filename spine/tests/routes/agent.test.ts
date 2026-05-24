import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildTestApp, json, req, type TestApp } from '../helpers/app';
import { capturesDir, localFilesDir } from '../../src/search';

let app: TestApp;
const TOKEN = 'test-token';

beforeEach(async () => {
	app = await buildTestApp({ agentToken: TOKEN });
});

afterEach(async () => {
	await app?.cleanup();
});

function agentPost(path: string, body: unknown, token = TOKEN) {
	return req(path, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			authorization: `Bearer ${token}`,
		},
		body: JSON.stringify(body),
	});
}

describe('POST /api/agent/capture', () => {
	it('inserts a row and writes the markdown file', async () => {
		const res = await app.app.handle(
			agentPost('/api/agent/capture', {
				text: 'hello world',
				source: 'signal',
				captured_at: '2026-01-01T00:00:00Z',
			}),
		);
		expect(res.status).toBe(200);
		const { id } = await json(res);
		expect(typeof id).toBe('number');

		const row = app.db.query('SELECT * FROM captures WHERE id = ?').get(id);
		expect(row).toMatchObject({
			text: 'hello world',
			source: 'signal',
			captured_at: '2026-01-01T00:00:00Z',
		});

		const file = join(capturesDir(), `${id}.md`);
		expect(existsSync(file)).toBe(true);
		expect(readFileSync(file, 'utf-8')).toContain('hello world');
	});

	it('rejects empty text (422)', async () => {
		const res = await app.app.handle(
			agentPost('/api/agent/capture', { text: '', source: 's', captured_at: 'ts' }),
		);
		expect(res.status).toBe(422);
	});

	it('rejects empty source (422)', async () => {
		const res = await app.app.handle(
			agentPost('/api/agent/capture', { text: 't', source: '', captured_at: 'ts' }),
		);
		expect(res.status).toBe(422);
	});

	it('rejects when captured_at is missing (422)', async () => {
		const res = await app.app.handle(agentPost('/api/agent/capture', { text: 't', source: 's' }));
		expect(res.status).toBe(422);
	});

	it('rolls back the DB row when writeCaptureFile fails (no orphan rows)', async () => {
		// Force writeCaptureFile to throw by removing the captures dir that
		// initSearch created. The handler's db.transaction(...) wrapper must
		// ROLLBACK the INSERT so a retry doesn't leave duplicate rows.
		const { capturesDir } = await import('../../src/search');
		const { rmSync } = await import('node:fs');
		rmSync(capturesDir(), { recursive: true, force: true });

		const res = await app.app.handle(
			agentPost('/api/agent/capture', {
				text: 'should rollback',
				source: 'test',
				captured_at: '2026-01-01T00:00:00Z',
			}),
		);
		expect(res.status).toBe(500);

		const count = (app.db.query('SELECT COUNT(*) AS c FROM captures').get() as { c: number }).c;
		expect(count).toBe(0);
	});

	it('returns id, triage_action, and text in the response', async () => {
		const res = await app.app.handle(
			agentPost('/api/agent/capture', {
				text: 'hello world',
				source: 'signal',
				captured_at: '2026-01-01T00:00:00Z',
			}),
		);
		expect(res.status).toBe(200);
		const body = await json(res);
		expect(typeof body.id).toBe('number');
		expect(body.triage_action).toBeNull();
		expect(body.text).toBe('hello world');
	});

	describe('slash commands', () => {
		it('/task stores stripped text with triage_action=task and triaged_at set', async () => {
			const res = await app.app.handle(
				agentPost('/api/agent/capture', {
					text: '/task buy oat milk',
					source: 'signal',
					captured_at: '2026-01-01T00:00:00Z',
				}),
			);
			expect(res.status).toBe(200);
			const body = await json(res);
			expect(body.triage_action).toBe('task');
			expect(body.text).toBe('buy oat milk');

			const row = app.db.query('SELECT * FROM captures WHERE id = ?').get(body.id) as any;
			expect(row.text).toBe('buy oat milk');
			expect(row.triage_action).toBe('task');
			expect(typeof row.triaged_at).toBe('string');
		});

		it('/note stores stripped text with triage_action=keep', async () => {
			const res = await app.app.handle(
				agentPost('/api/agent/capture', {
					text: '/note remember this',
					source: 'signal',
					captured_at: '2026-01-01T00:00:00Z',
				}),
			);
			const body = await json(res);
			expect(body.triage_action).toBe('keep');
			expect(body.text).toBe('remember this');
		});

		it('/skip stores stripped text with triage_action=skip', async () => {
			const res = await app.app.handle(
				agentPost('/api/agent/capture', {
					text: '/skip dry cleaning',
					source: 'signal',
					captured_at: '2026-01-01T00:00:00Z',
				}),
			);
			const body = await json(res);
			expect(body.triage_action).toBe('skip');
			expect(body.text).toBe('dry cleaning');
		});

		it('command is case-insensitive', async () => {
			const res = await app.app.handle(
				agentPost('/api/agent/capture', {
					text: '/TASK buy milk',
					source: 'signal',
					captured_at: '2026-01-01T00:00:00Z',
				}),
			);
			const body = await json(res);
			expect(body.triage_action).toBe('task');
		});

		it('unknown command is stored as plain text with no triage', async () => {
			const res = await app.app.handle(
				agentPost('/api/agent/capture', {
					text: '/foobar some text',
					source: 'signal',
					captured_at: '2026-01-01T00:00:00Z',
				}),
			);
			const body = await json(res);
			expect(body.triage_action).toBeNull();
			expect(body.text).toBe('/foobar some text');
		});

		it('/task with no body is stored as plain text with no triage', async () => {
			const res = await app.app.handle(
				agentPost('/api/agent/capture', {
					text: '/task',
					source: 'signal',
					captured_at: '2026-01-01T00:00:00Z',
				}),
			);
			const body = await json(res);
			expect(body.triage_action).toBeNull();
			expect(body.text).toBe('/task');
		});

		it('command captures do not appear in the inbox list (triaged_at is set)', async () => {
			const res = await app.app.handle(
				agentPost('/api/agent/capture', {
					text: '/task buy milk',
					source: 'signal',
					captured_at: '2026-01-01T00:00:00Z',
				}),
			);
			const { id } = await json(res);
			const inbox = await app.app.handle(req('/api/captures'));
			const inboxBody = await json(inbox);
			expect(inboxBody.items.find((c: any) => c.id === id)).toBeUndefined();
		});
	});
});

describe('POST /api/agent/index', () => {
	function indexBody(overrides: Record<string, unknown> = {}) {
		return {
			machine_id: 'm1',
			path: '/data/notes.txt',
			hash: 'h1',
			mime_type: 'text/plain',
			text: 'v1',
			modified_at: '2026-01-01T00:00:00Z',
			size_bytes: 2,
			...overrides,
		};
	}

	it('upserts a row and writes the local-file md', async () => {
		const res = await app.app.handle(agentPost('/api/agent/index', indexBody()));
		expect(res.status).toBe(200);
		expect(await json(res)).toEqual({ ok: true });

		const row = app.db
			.query('SELECT * FROM file_index WHERE machine_id = ? AND path = ?')
			.get('m1', '/data/notes.txt');
		expect(row).toMatchObject({ hash: 'h1', text: 'v1' });

		expect(existsSync(join(localFilesDir(), 'm1', 'h1.md'))).toBe(true);
	});

	it('is idempotent on identical payload (re-sends are no-ops)', async () => {
		await app.app.handle(agentPost('/api/agent/index', indexBody()));
		const before = app.db
			.query('SELECT indexed_at FROM file_index WHERE machine_id = ? AND path = ?')
			.get('m1', '/data/notes.txt') as { indexed_at: string };

		// Small sleep so a fresh indexed_at would differ.
		await new Promise((r) => setTimeout(r, 25));
		await app.app.handle(agentPost('/api/agent/index', indexBody()));
		const after = app.db
			.query('SELECT indexed_at FROM file_index WHERE machine_id = ? AND path = ?')
			.get('m1', '/data/notes.txt') as { indexed_at: string };

		// ON CONFLICT WHERE hash != excluded.hash → no update; indexed_at unchanged.
		expect(after.indexed_at).toBe(before.indexed_at);
	});

	it('updates the row in-place and deletes the previous local-file md when hash changes', async () => {
		await app.app.handle(agentPost('/api/agent/index', indexBody({ hash: 'old', text: 'v-old' })));
		const oldMd = join(localFilesDir(), 'm1', 'old.md');
		expect(existsSync(oldMd)).toBe(true);

		await app.app.handle(agentPost('/api/agent/index', indexBody({ hash: 'new', text: 'v-new' })));

		const row = app.db
			.query('SELECT * FROM file_index WHERE machine_id = ? AND path = ?')
			.get('m1', '/data/notes.txt') as any;
		expect(row.hash).toBe('new');
		expect(row.text).toBe('v-new');

		expect(existsSync(oldMd)).toBe(false);
		expect(existsSync(join(localFilesDir(), 'm1', 'new.md'))).toBe(true);
	});

	it('treats different (machine_id, path) tuples as separate rows', async () => {
		await app.app.handle(agentPost('/api/agent/index', indexBody({ machine_id: 'm1' })));
		await app.app.handle(agentPost('/api/agent/index', indexBody({ machine_id: 'm2' })));
		const rows = app.db.query('SELECT * FROM file_index').all() as any[];
		expect(rows.length).toBe(2);
	});

	it('validates size_bytes >= 0', async () => {
		const res = await app.app.handle(agentPost('/api/agent/index', indexBody({ size_bytes: -1 })));
		expect(res.status).toBe(422);
	});
});

describe('POST /api/agent/capture/:id/attachments', () => {
	async function seedCapture() {
		const res = await app.app.handle(
			agentPost('/api/agent/capture', {
				text: 'host',
				source: 'signal',
				captured_at: '2026-01-01T00:00:00Z',
			}),
		);
		const { id } = await json(res);
		return id as number;
	}

	it('stores the file on disk, inserts the row, and returns the new attachment id', async () => {
		const captureId = await seedCapture();
		const payload = Buffer.from('audio bytes').toString('base64');
		const res = await app.app.handle(
			agentPost(`/api/agent/capture/${captureId}/attachments`, {
				signal_id: 'att-abc',
				content_type: 'audio/aac',
				filename: 'voice.aac',
				data: payload,
				size_bytes: 11,
			}),
		);
		expect(res.status).toBe(200);
		const { id } = await json(res);
		expect(typeof id).toBe('number');

		const stored = join(app.env.attachmentsDir, String(captureId), 'att-abc');
		expect(existsSync(stored)).toBe(true);
		expect(readFileSync(stored, 'utf-8')).toBe('audio bytes');

		const row = app.db.query('SELECT * FROM capture_attachments WHERE id = ?').get(id) as any;
		expect(row).toMatchObject({
			capture_id: captureId,
			signal_id: 'att-abc',
			content_type: 'audio/aac',
			filename: 'voice.aac',
			size_bytes: 11,
			stored_path: `${captureId}/att-abc`,
		});
	});

	it('rejects signal_id with directory components (400)', async () => {
		const captureId = await seedCapture();
		const res = await app.app.handle(
			agentPost(`/api/agent/capture/${captureId}/attachments`, {
				signal_id: '../escape.aac',
				content_type: 'audio/aac',
				filename: 'v.aac',
				data: Buffer.from('x').toString('base64'),
				size_bytes: 1,
			}),
		);
		expect(res.status).toBe(400);
		// Nothing should have been written under the capture dir or one level up.
		expect(existsSync(join(app.env.attachmentsDir, String(captureId), 'escape.aac'))).toBe(false);
		expect(existsSync(join(app.env.attachmentsDir, 'escape.aac'))).toBe(false);
	});

	it("rejects signal_id of '.' or '..' (400)", async () => {
		const captureId = await seedCapture();
		for (const sid of ['.', '..']) {
			const res = await app.app.handle(
				agentPost(`/api/agent/capture/${captureId}/attachments`, {
					signal_id: sid,
					content_type: 'audio/aac',
					filename: 'v.aac',
					data: Buffer.from('x').toString('base64'),
					size_bytes: 1,
				}),
			);
			expect(res.status).toBe(400);
		}
	});

	it('rejects signal_id containing a slash (400)', async () => {
		const captureId = await seedCapture();
		const res = await app.app.handle(
			agentPost(`/api/agent/capture/${captureId}/attachments`, {
				signal_id: 'a/b',
				content_type: 'audio/aac',
				filename: 'v.aac',
				data: Buffer.from('x').toString('base64'),
				size_bytes: 1,
			}),
		);
		expect(res.status).toBe(400);
	});

	it('rejects empty signal_id at the schema (422)', async () => {
		const captureId = await seedCapture();
		const res = await app.app.handle(
			agentPost(`/api/agent/capture/${captureId}/attachments`, {
				signal_id: '',
				content_type: 'audio/aac',
				filename: 'v.aac',
				data: Buffer.from('x').toString('base64'),
				size_bytes: 1,
			}),
		);
		expect(res.status).toBe(422);
	});

	it('rejects when size_bytes does not match the decoded data length (400)', async () => {
		const captureId = await seedCapture();
		const res = await app.app.handle(
			agentPost(`/api/agent/capture/${captureId}/attachments`, {
				signal_id: 'att-mismatch',
				content_type: 'audio/aac',
				filename: 'v.aac',
				data: Buffer.from('ab').toString('base64'), // decodes to 2 bytes
				size_bytes: 99,
			}),
		);
		expect(res.status).toBe(400);
		expect(existsSync(join(app.env.attachmentsDir, String(captureId), 'att-mismatch'))).toBe(false);
	});

	it('returns 404 when the capture does not exist', async () => {
		const res = await app.app.handle(
			agentPost('/api/agent/capture/99999/attachments', {
				signal_id: 'a',
				content_type: 'audio/aac',
				filename: '',
				data: Buffer.from('x').toString('base64'),
				size_bytes: 1,
			}),
		);
		expect(res.status).toBe(404);
	});

	it('returns 400 on non-numeric capture id', async () => {
		const res = await app.app.handle(
			agentPost('/api/agent/capture/abc/attachments', {
				signal_id: 'a',
				content_type: 'audio/aac',
				filename: '',
				data: Buffer.from('x').toString('base64'),
				size_bytes: 1,
			}),
		);
		expect(res.status).toBe(400);
	});

	it('rejects empty data (422 validation)', async () => {
		const captureId = await seedCapture();
		const res = await app.app.handle(
			agentPost(`/api/agent/capture/${captureId}/attachments`, {
				signal_id: 'a',
				content_type: 'audio/aac',
				filename: '',
				data: '',
				size_bytes: 0,
			}),
		);
		expect(res.status).toBe(422);
	});
});

describe('POST /api/agent/status', () => {
	function statusBody(overrides: Record<string, unknown> = {}) {
		return {
			machine_id: 'host1',
			state: 'idle',
			last_scan_at: '2026-01-01T00:00:00.000Z',
			last_indexed: 5,
			last_skipped: 2,
			last_errors: 0,
			spine_ok: true,
			last_error_msg: null,
			...overrides,
		};
	}

	it('inserts a new row and returns ok', async () => {
		const res = await app.app.handle(agentPost('/api/agent/status', statusBody()));
		expect(res.status).toBe(200);
		expect(await json(res)).toEqual({ ok: true });

		const row = app.db.query('SELECT * FROM agent_status WHERE machine_id = ?').get('host1') as any;
		expect(row).toMatchObject({
			machine_id: 'host1',
			state: 'idle',
			last_scan_at: '2026-01-01T00:00:00.000Z',
			last_indexed: 5,
			last_skipped: 2,
			last_errors: 0,
			spine_ok: 1,
			last_error_msg: null,
		});
		expect(typeof row.reported_at).toBe('string');
	});

	it('upserts on repeated calls — updates all fields', async () => {
		await app.app.handle(agentPost('/api/agent/status', statusBody()));
		await app.app.handle(
			agentPost(
				'/api/agent/status',
				statusBody({ state: 'scanning', last_indexed: 99, spine_ok: false }),
			),
		);

		const rows = app.db.query('SELECT * FROM agent_status WHERE machine_id = ?').all('host1');
		expect(rows.length).toBe(1);
		const row = rows[0] as any;
		expect(row.state).toBe('scanning');
		expect(row.last_indexed).toBe(99);
		expect(row.spine_ok).toBe(0);
	});

	it('keeps distinct rows per machine_id', async () => {
		await app.app.handle(agentPost('/api/agent/status', statusBody({ machine_id: 'host1' })));
		await app.app.handle(agentPost('/api/agent/status', statusBody({ machine_id: 'host2' })));

		const rows = app.db.query('SELECT machine_id FROM agent_status').all() as any[];
		expect(rows.length).toBe(2);
	});

	it('accepts null last_scan_at', async () => {
		const res = await app.app.handle(
			agentPost('/api/agent/status', statusBody({ last_scan_at: null })),
		);
		expect(res.status).toBe(200);
		const row = app.db
			.query('SELECT last_scan_at FROM agent_status WHERE machine_id = ?')
			.get('host1') as any;
		expect(row.last_scan_at).toBeNull();
	});

	it('rejects invalid state value (422)', async () => {
		const res = await app.app.handle(
			agentPost('/api/agent/status', statusBody({ state: 'unknown' })),
		);
		expect(res.status).toBe(422);
	});

	it('rejects empty machine_id (422)', async () => {
		const res = await app.app.handle(
			agentPost('/api/agent/status', statusBody({ machine_id: '' })),
		);
		expect(res.status).toBe(422);
	});

	it('rejects without bearer token (401)', async () => {
		const res = await app.app.handle(agentPost('/api/agent/status', statusBody(), ''));
		expect(res.status).toBe(401);
	});
});
