import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildTestApp, json, req, type TestApp } from '../helpers/app';
import { workingAttachmentsMdDir } from '../../src/search';
import { createWorking } from '../../src/working';

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

function insertWorking(title = 'Test Doc'): string {
	return createWorking(title, `# ${title}\n\nContent here.\n`);
}

function makeFormData(filename: string, content: string, type = 'text/plain'): FormData {
	const fd = new FormData();
	fd.append('file', new File([content], filename, { type }));
	return fd;
}

async function upload(slug: string, fd: FormData): Promise<Response> {
	return app.app.handle(
		new Request(`http://localhost/api/working/${slug}/attachments`, {
			method: 'POST',
			headers: {
				'x-forwarded-proto': 'https',
				'x-authentik-username': 'test@local',
			},
			body: fd,
		}),
	);
}

describe('POST /api/working/:slug/attachments', () => {
	it('uploads a file and returns metadata', async () => {
		const slug = insertWorking();
		const res = await upload(slug, makeFormData('note.txt', 'hello'));
		expect(res.status).toBe(200);
		const body = await json(res);
		expect(body.id).toBeNumber();
		expect(body.slug).toBe(slug);
		expect(body.filename).toBe('note.txt');
		expect(body.size_bytes).toBeGreaterThan(0);
	});

	it('writes file to disk at working/<slug>/<attachmentId>', async () => {
		const slug = insertWorking();
		const res = await upload(slug, makeFormData('disk.txt', 'content'));
		const { id } = await json(res);
		const diskPath = join(app.env.attachmentsDir, 'working', slug, String(id));
		expect(existsSync(diskPath)).toBe(true);
	});

	it('writes an index markdown file for search', async () => {
		const slug = insertWorking();
		const res = await upload(slug, makeFormData('idx.txt', 'findable'));
		const { id } = await json(res);
		const mdPath = join(workingAttachmentsMdDir(), `${id}.md`);
		expect(existsSync(mdPath)).toBe(true);
	});

	it('returns 404 for unknown slug', async () => {
		const res = await upload('no-such-slug', makeFormData('x.txt', 'x'));
		expect(res.status).toBe(404);
	});

	it('returns 400 when multipart body is invalid', async () => {
		const slug = insertWorking();
		const res = await app.app.handle(
			new Request(`http://localhost/api/working/${slug}/attachments`, {
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
		const slug = insertWorking();
		const fd = new FormData();
		fd.append('note', 'no file here');
		const res = await upload(slug, fd);
		expect(res.status).toBe(400);
		expect((await json(res)).error).toBe('Missing file field');
	});
});

describe('GET /api/working/:slug/attachments', () => {
	it('returns empty array when doc has no attachments', async () => {
		const slug = insertWorking();
		const res = await app.app.handle(authGet(`/api/working/${slug}/attachments`));
		expect(res.status).toBe(200);
		const body = await json(res);
		expect(body).toEqual([]);
	});

	it('lists attachments after upload', async () => {
		const slug = insertWorking();
		await upload(slug, makeFormData('listed.txt', 'content'));
		const res = await app.app.handle(authGet(`/api/working/${slug}/attachments`));
		expect(res.status).toBe(200);
		const body = await json(res);
		expect(body).toHaveLength(1);
		expect(body[0].filename).toBe('listed.txt');
	});

	it('returns 404 for unknown slug', async () => {
		const res = await app.app.handle(authGet('/api/working/no-such-slug/attachments'));
		expect(res.status).toBe(404);
	});
});

describe('GET /api/working/:slug/attachments/:attId/raw', () => {
	it('streams the file with correct headers', async () => {
		const slug = insertWorking();
		const content = 'streamed data';
		const uploadRes = await upload(slug, makeFormData('data.txt', content, 'text/plain'));
		const { id } = await json(uploadRes);

		const rawRes = await app.app.handle(authGet(`/api/working/${slug}/attachments/${id}/raw`));
		expect(rawRes.status).toBe(200);
		expect(rawRes.headers.get('Content-Type')).toContain('text/plain');
		expect(rawRes.headers.get('Content-Disposition')).toContain('attachment');
		const text = await rawRes.text();
		expect(text).toBe(content);
	});

	it('returns 404 when attachment belongs to a different slug', async () => {
		const slug1 = insertWorking('Doc One');
		const slug2 = insertWorking('Doc Two');
		const uploadRes = await upload(slug1, makeFormData('x.txt', 'x'));
		const { id } = await json(uploadRes);
		const res = await app.app.handle(authGet(`/api/working/${slug2}/attachments/${id}/raw`));
		expect(res.status).toBe(404);
	});

	it('returns 404 when attachment binary is missing from disk', async () => {
		const slug = insertWorking();
		const row = app.db
			.prepare(
				`INSERT INTO working_attachments
				 (slug, content_type, filename, size_bytes, stored_path, created_at)
				 VALUES (?, 'text/plain', 'missing.txt', 7, ?, '2026-01-01T00:00:00Z') RETURNING id`,
			)
			.get(slug, `working/${slug}/missing`) as { id: number };

		const res = await app.app.handle(authGet(`/api/working/${slug}/attachments/${row.id}/raw`));
		expect(res.status).toBe(404);
		expect(await res.text()).toBe('File not found on disk');
	});

	it('returns 403 when stored path resolves outside working attachments dir', async () => {
		const slug = insertWorking();
		const outsidePath = join(app.env.attachmentsDir, 'outside.txt');
		mkdirSync(app.env.attachmentsDir, { recursive: true });
		writeFileSync(outsidePath, 'outside');
		const row = app.db
			.prepare(
				`INSERT INTO working_attachments
				 (slug, content_type, filename, size_bytes, stored_path, created_at)
				 VALUES (?, 'text/plain', 'outside.txt', 7, 'outside.txt', '2026-01-01T00:00:00Z') RETURNING id`,
			)
			.get(slug) as { id: number };

		const res = await app.app.handle(authGet(`/api/working/${slug}/attachments/${row.id}/raw`));
		expect(res.status).toBe(403);
	});

	it('sanitizes filenames in Content-Disposition', async () => {
		const slug = insertWorking();
		const row = app.db
			.prepare(
				`INSERT INTO working_attachments
				 (slug, content_type, filename, size_bytes, stored_path, created_at)
				 VALUES (?, 'text/plain', 'bad "name".txt', 7, '', '2026-01-01T00:00:00Z') RETURNING id`,
			)
			.get(slug) as { id: number };
		const dir = join(app.env.attachmentsDir, 'working', slug);
		mkdirSync(dir, { recursive: true });
		writeFileSync(join(dir, String(row.id)), 'content');
		app.db
			.prepare('UPDATE working_attachments SET stored_path = ? WHERE id = ?')
			.run(`working/${slug}/${row.id}`, row.id);

		const res = await app.app.handle(authGet(`/api/working/${slug}/attachments/${row.id}/raw`));
		expect(res.status).toBe(200);
		expect(res.headers.get('Content-Disposition')).toContain('bad__name_.txt');
	});
});

describe('DELETE /api/working/:slug/attachments/:attId', () => {
	it('removes the attachment row and binary', async () => {
		const slug = insertWorking();
		const uploadRes = await upload(slug, makeFormData('del.txt', 'bye'));
		const { id } = await json(uploadRes);
		const diskPath = join(app.env.attachmentsDir, 'working', slug, String(id));

		const delRes = await app.app.handle(
			new Request(`http://localhost/api/working/${slug}/attachments/${id}`, {
				method: 'DELETE',
				headers: {
					'x-forwarded-proto': 'https',
					'x-authentik-username': 'test@local',
				},
			}),
		);
		expect(delRes.status).toBe(200);

		const row = app.db.query('SELECT id FROM working_attachments WHERE id = ?').get(id);
		expect(row).toBeNull();
		expect(existsSync(diskPath)).toBe(false);
	});

	it('returns 404 for unknown attachment', async () => {
		const slug = insertWorking();
		const res = await app.app.handle(
			new Request(`http://localhost/api/working/${slug}/attachments/9999`, {
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
