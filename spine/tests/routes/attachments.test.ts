import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildTestApp, json, req, type TestApp } from '../helpers/app';
import { attachmentsMdDir } from '../../src/search';

let app: TestApp;

beforeEach(async () => {
	app = await buildTestApp();
});

afterEach(async () => {
	await app?.cleanup();
});

function authGet(path: string) {
	return req(path, {
		headers: { 'x-forwarded-proto': 'https', 'x-authentik-username': 'test@local' },
	});
}

function insertCapture(): number {
	const row = app.db
		.prepare(
			`INSERT INTO captures (text, source, captured_at, ingested_at) VALUES ('hello', 'test', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z') RETURNING id`,
		)
		.get() as { id: number };
	return row.id;
}

function makeFormData(filename: string, content: string, type = 'text/plain'): FormData {
	const fd = new FormData();
	fd.append('file', new File([content], filename, { type }));
	return fd;
}

describe('POST /api/captures/:id/attachments', () => {
	it('uploads a file and returns metadata', async () => {
		const captureId = insertCapture();
		const fd = makeFormData('note.txt', 'hello attachment');

		const res = await app.app.handle(
			new Request(`http://localhost/api/captures/${captureId}/attachments`, {
				method: 'POST',
				headers: {
					'x-forwarded-proto': 'https',
					'x-authentik-username': 'test@local',
				},
				body: fd,
			}),
		);
		expect(res.status).toBe(200);
		const body = await json(res);
		expect(body.id).toBeNumber();
		expect(body.capture_id).toBe(captureId);
		expect(body.filename).toBe('note.txt');
		expect(body.upload_source).toBe('browser');
		expect(body.size_bytes).toBeGreaterThan(0);
	});

	it('writes file to disk at <captureId>/<attachmentId>', async () => {
		const captureId = insertCapture();
		const fd = makeFormData('hello.txt', 'disk content');

		const res = await app.app.handle(
			new Request(`http://localhost/api/captures/${captureId}/attachments`, {
				method: 'POST',
				headers: {
					'x-forwarded-proto': 'https',
					'x-authentik-username': 'test@local',
				},
				body: fd,
			}),
		);
		const { id } = await json(res);
		const diskPath = join(app.env.attachmentsDir, String(captureId), String(id));
		expect(existsSync(diskPath)).toBe(true);
	});

	it('writes an index markdown file for search', async () => {
		const captureId = insertCapture();
		const fd = makeFormData('search-me.txt', 'findable content');

		const res = await app.app.handle(
			new Request(`http://localhost/api/captures/${captureId}/attachments`, {
				method: 'POST',
				headers: {
					'x-forwarded-proto': 'https',
					'x-authentik-username': 'test@local',
				},
				body: fd,
			}),
		);
		const { id } = await json(res);
		const mdPath = join(attachmentsMdDir(), `${id}.md`);
		expect(existsSync(mdPath)).toBe(true);
	});

	it('returns 404 for unknown capture', async () => {
		const fd = makeFormData('x.txt', 'x');
		const res = await app.app.handle(
			new Request('http://localhost/api/captures/9999/attachments', {
				method: 'POST',
				headers: {
					'x-forwarded-proto': 'https',
					'x-authentik-username': 'test@local',
				},
				body: fd,
			}),
		);
		expect(res.status).toBe(404);
	});

	it('returns 400 for non-numeric capture id', async () => {
		const fd = makeFormData('x.txt', 'x');
		const res = await app.app.handle(
			new Request('http://localhost/api/captures/abc/attachments', {
				method: 'POST',
				headers: {
					'x-forwarded-proto': 'https',
					'x-authentik-username': 'test@local',
				},
				body: fd,
			}),
		);
		expect(res.status).toBe(400);
	});

	it('returns 400 when multipart body is invalid', async () => {
		const captureId = insertCapture();
		const res = await app.app.handle(
			new Request(`http://localhost/api/captures/${captureId}/attachments`, {
				method: 'POST',
				headers: {
					'x-forwarded-proto': 'https',
					'x-authentik-username': 'test@local',
					'content-type': 'multipart/form-data; boundary=missing',
				},
				body: 'not multipart',
			}),
		);
		expect(res.status).toBe(400);
		expect((await json(res)).error).toBe('Invalid multipart body');
	});

	it('returns 400 when file field is missing', async () => {
		const captureId = insertCapture();
		const fd = new FormData();
		fd.append('note', 'no file here');
		const res = await app.app.handle(
			new Request(`http://localhost/api/captures/${captureId}/attachments`, {
				method: 'POST',
				headers: {
					'x-forwarded-proto': 'https',
					'x-authentik-username': 'test@local',
				},
				body: fd,
			}),
		);
		expect(res.status).toBe(400);
		expect((await json(res)).error).toBe('Missing file field');
	});
});

describe('GET /api/captures/:id/attachments', () => {
	it('returns empty array when capture has no attachments', async () => {
		const captureId = insertCapture();
		const res = await app.app.handle(authGet(`/api/captures/${captureId}/attachments`));
		expect(res.status).toBe(200);
		const body = await json(res);
		expect(body).toEqual([]);
	});

	it('lists attachments after upload', async () => {
		const captureId = insertCapture();
		const fd = makeFormData('listed.txt', 'content');

		await app.app.handle(
			new Request(`http://localhost/api/captures/${captureId}/attachments`, {
				method: 'POST',
				headers: {
					'x-forwarded-proto': 'https',
					'x-authentik-username': 'test@local',
				},
				body: fd,
			}),
		);

		const res = await app.app.handle(authGet(`/api/captures/${captureId}/attachments`));
		expect(res.status).toBe(200);
		const body = await json(res);
		expect(body).toHaveLength(1);
		expect(body[0].filename).toBe('listed.txt');
		expect(body[0].upload_source).toBe('browser');
	});

	it('returns 404 for unknown capture', async () => {
		const res = await app.app.handle(authGet('/api/captures/9999/attachments'));
		expect(res.status).toBe(404);
	});

	it('returns 400 for non-numeric capture id', async () => {
		const res = await app.app.handle(authGet('/api/captures/abc/attachments'));
		expect(res.status).toBe(400);
	});
});

describe('GET /api/captures/:id/attachments/:attId/raw', () => {
	it('streams the file with correct Content-Type', async () => {
		const captureId = insertCapture();
		const content = 'streamed data';
		const fd = makeFormData('data.txt', content, 'text/plain');

		const uploadRes = await app.app.handle(
			new Request(`http://localhost/api/captures/${captureId}/attachments`, {
				method: 'POST',
				headers: {
					'x-forwarded-proto': 'https',
					'x-authentik-username': 'test@local',
				},
				body: fd,
			}),
		);
		const { id } = await json(uploadRes);

		const rawRes = await app.app.handle(
			authGet(`/api/captures/${captureId}/attachments/${id}/raw`),
		);
		expect(rawRes.status).toBe(200);
		expect(rawRes.headers.get('Content-Type')).toContain('text/plain');
		const text = await rawRes.text();
		expect(text).toBe(content);
	});

	it('returns 404 when attachment id is unknown', async () => {
		const captureId = insertCapture();
		const res = await app.app.handle(authGet(`/api/captures/${captureId}/attachments/9999/raw`));
		expect(res.status).toBe(404);
	});

	it('returns 404 when attachment belongs to a different capture', async () => {
		const captureId1 = insertCapture();
		const captureId2 = insertCapture();
		const fd = makeFormData('x.txt', 'x');

		const uploadRes = await app.app.handle(
			new Request(`http://localhost/api/captures/${captureId1}/attachments`, {
				method: 'POST',
				headers: {
					'x-forwarded-proto': 'https',
					'x-authentik-username': 'test@local',
				},
				body: fd,
			}),
		);
		const { id } = await json(uploadRes);

		const res = await app.app.handle(authGet(`/api/captures/${captureId2}/attachments/${id}/raw`));
		expect(res.status).toBe(404);
	});

	it('returns 404 when attachment binary is missing from disk', async () => {
		const captureId = insertCapture();
		const row = app.db
			.prepare(
				`INSERT INTO capture_attachments
				 (capture_id, signal_id, content_type, filename, size_bytes, stored_path, upload_source, created_at)
				 VALUES (?, '', 'text/plain', 'missing.txt', 7, ?, 'browser', '2026-01-01T00:00:00Z') RETURNING id`,
			)
			.get(captureId, `${captureId}/missing`) as { id: number };

		const res = await app.app.handle(
			authGet(`/api/captures/${captureId}/attachments/${row.id}/raw`),
		);
		expect(res.status).toBe(404);
		expect(await res.text()).toBe('File not found on disk');
	});

	it('returns 403 when stored path resolves outside attachments dir', async () => {
		const captureId = insertCapture();
		const outsidePath = join(app.env.dir, 'outside.txt');
		writeFileSync(outsidePath, 'outside');
		const row = app.db
			.prepare(
				`INSERT INTO capture_attachments
				 (capture_id, signal_id, content_type, filename, size_bytes, stored_path, upload_source, created_at)
				 VALUES (?, '', 'text/plain', 'outside.txt', 7, '../outside.txt', 'browser', '2026-01-01T00:00:00Z') RETURNING id`,
			)
			.get(captureId) as { id: number };

		const res = await app.app.handle(
			authGet(`/api/captures/${captureId}/attachments/${row.id}/raw`),
		);
		expect(res.status).toBe(403);
	});

	it('sanitizes filenames in Content-Disposition', async () => {
		const captureId = insertCapture();
		const row = app.db
			.prepare(
				`INSERT INTO capture_attachments
				 (capture_id, signal_id, content_type, filename, size_bytes, stored_path, upload_source, created_at)
				 VALUES (?, '', 'text/plain', 'bad "name".txt', 7, '', 'browser', '2026-01-01T00:00:00Z') RETURNING id`,
			)
			.get(captureId) as { id: number };
		const dir = join(app.env.attachmentsDir, String(captureId));
		mkdirSync(dir, { recursive: true });
		writeFileSync(join(dir, String(row.id)), 'content');
		app.db
			.prepare('UPDATE capture_attachments SET stored_path = ? WHERE id = ?')
			.run(`${captureId}/${row.id}`, row.id);

		const res = await app.app.handle(
			authGet(`/api/captures/${captureId}/attachments/${row.id}/raw`),
		);
		expect(res.status).toBe(200);
		expect(res.headers.get('Content-Disposition')).toContain('bad__name_.txt');
	});
});

describe('DELETE /api/captures/:id/attachments/:attId', () => {
	it('removes the attachment row', async () => {
		const captureId = insertCapture();
		const fd = makeFormData('del.txt', 'bye');

		const uploadRes = await app.app.handle(
			new Request(`http://localhost/api/captures/${captureId}/attachments`, {
				method: 'POST',
				headers: {
					'x-forwarded-proto': 'https',
					'x-authentik-username': 'test@local',
				},
				body: fd,
			}),
		);
		const { id } = await json(uploadRes);
		const diskPath = join(app.env.attachmentsDir, String(captureId), String(id));
		const mdPath = join(attachmentsMdDir(), `${id}.md`);
		expect(existsSync(diskPath)).toBe(true);
		expect(existsSync(mdPath)).toBe(true);

		const delRes = await app.app.handle(
			new Request(`http://localhost/api/captures/${captureId}/attachments/${id}`, {
				method: 'DELETE',
				headers: {
					'x-forwarded-proto': 'https',
					'x-authentik-username': 'test@local',
				},
			}),
		);
		expect(delRes.status).toBe(200);

		const row = app.db.query('SELECT id FROM capture_attachments WHERE id = ?').get(id);
		expect(row).toBeNull();
		expect(existsSync(diskPath)).toBe(false);
		expect(existsSync(mdPath)).toBe(false);
	});

	it('returns 404 for unknown attachment', async () => {
		const captureId = insertCapture();
		const res = await app.app.handle(
			new Request(`http://localhost/api/captures/${captureId}/attachments/9999`, {
				method: 'DELETE',
				headers: {
					'x-forwarded-proto': 'https',
					'x-authentik-username': 'test@local',
				},
			}),
		);
		expect(res.status).toBe(404);
	});
});
