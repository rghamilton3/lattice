import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { existsSync } from 'node:fs';
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
