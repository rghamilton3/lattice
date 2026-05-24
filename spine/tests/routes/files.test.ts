import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { writeFileSync, symlinkSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { buildTestApp, json, req, type TestApp } from '../helpers/app';

let app: TestApp;

beforeEach(async () => {
	app = await buildTestApp();
});

afterEach(async () => {
	await app?.cleanup();
});

function seedFile(
	app: TestApp,
	path: string,
	text = 'body',
	machine = 'm1',
	hash = 'h1',
	modifiedAt = '2026-01-01T00:00:00.000Z',
) {
	return app.db
		.prepare(
			`INSERT INTO file_index
         (machine_id, path, hash, mime_type, text, modified_at, size_bytes, indexed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
		)
		.get(machine, path, hash, 'text/plain', text, modifiedAt, text.length, '2026-01-01') as {
		id: number;
	};
}

describe('GET /api/files', () => {
	it('returns a paginated first page ordered by modified_at and id descending', async () => {
		seedFile(app, '/data/old.txt', 'old', 'm1', 'h1', '2026-01-01T00:00:00.000Z');
		seedFile(app, '/data/middle.txt', 'middle', 'm1', 'h2', '2026-01-02T00:00:00.000Z');
		seedFile(app, '/data/new.txt', 'new', 'm1', 'h3', '2026-01-03T00:00:00.000Z');

		const res = await app.app.handle(req('/api/files?limit=2'));
		expect(res.status).toBe(200);
		const body = await json(res);
		expect(body.items.map((f: any) => f.path)).toEqual(['/data/new.txt', '/data/middle.txt']);
		expect(typeof body.next_cursor).toBe('string');
	});

	it('returns the next files page with no duplicates', async () => {
		seedFile(app, '/data/old.txt', 'old', 'm1', 'h1', '2026-01-01T00:00:00.000Z');
		seedFile(app, '/data/middle.txt', 'middle', 'm1', 'h2', '2026-01-02T00:00:00.000Z');
		seedFile(app, '/data/new.txt', 'new', 'm1', 'h3', '2026-01-03T00:00:00.000Z');

		const first = await app.app.handle(req('/api/files?limit=2'));
		const firstBody = await json(first);
		const second = await app.app.handle(req(`/api/files?limit=2&cursor=${firstBody.next_cursor}`));
		const secondBody = await json(second);

		expect(secondBody.items.map((f: any) => f.path)).toEqual(['/data/old.txt']);
		expect(secondBody.next_cursor).toBeNull();
	});

	it('uses id as a cursor tie-breaker when file timestamps match', async () => {
		seedFile(app, '/data/first.txt', 'first', 'm1', 'h1', '2026-01-01T00:00:00.000Z');
		seedFile(app, '/data/second.txt', 'second', 'm1', 'h2', '2026-01-01T00:00:00.000Z');
		seedFile(app, '/data/third.txt', 'third', 'm1', 'h3', '2026-01-01T00:00:00.000Z');

		const first = await app.app.handle(req('/api/files?limit=2'));
		const firstBody = await json(first);
		const second = await app.app.handle(req(`/api/files?limit=2&cursor=${firstBody.next_cursor}`));
		const secondBody = await json(second);

		expect([...firstBody.items, ...secondBody.items].map((f: any) => f.path)).toEqual([
			'/data/third.txt',
			'/data/second.txt',
			'/data/first.txt',
		]);
		expect(secondBody.next_cursor).toBeNull();
	});

	it('respects the file limit cap', async () => {
		for (let i = 0; i < 5; i++) seedFile(app, `/data/${i}.txt`, `${i}`, 'm1', `h${i}`);

		const res = await app.app.handle(req('/api/files?limit=2'));
		expect((await json(res)).items.length).toBe(2);

		const big = await app.app.handle(req('/api/files?limit=900'));
		expect(big.status).toBe(200);
		expect((await json(big)).items.length).toBe(5);

		for (let i = 5; i < 505; i++) seedFile(app, `/data/${i}.txt`, `${i}`, 'm1', `h${i}`);
		const capped = await app.app.handle(req('/api/files?limit=900'));
		expect(capped.status).toBe(200);
		expect((await json(capped)).items.length).toBe(500);
	});

	it('returns 400 for malformed file cursors', async () => {
		const res = await app.app.handle(req('/api/files?cursor=not-a-cursor'));
		expect(res.status).toBe(400);
		expect(await json(res)).toEqual({ error: 'Invalid cursor' });
	});
});

describe('GET /api/files/:id', () => {
	it('returns the row when id exists', async () => {
		const { id } = seedFile(app, '/data/notes.txt', 'hello');
		const res = await app.app.handle(req(`/api/files/${id}`));
		expect(res.status).toBe(200);
		const body = await json(res);
		expect(body.path).toBe('/data/notes.txt');
		expect(body.text).toBe('hello');
	});

	it('returns 400 on non-numeric id', async () => {
		const res = await app.app.handle(req('/api/files/abc'));
		expect(res.status).toBe(400);
	});

	it('returns 404 when id is unknown', async () => {
		const res = await app.app.handle(req('/api/files/99999'));
		expect(res.status).toBe(404);
	});
});

describe('GET /api/files/:id/raw', () => {
	it('streams the file contents with the recorded Content-Type', async () => {
		const filePath = join(app.env.dir, 'raw.txt');
		writeFileSync(filePath, 'raw bytes', 'utf-8');
		const { id } = seedFile(app, filePath, 'raw bytes');
		const res = await app.app.handle(req(`/api/files/${id}/raw`));
		expect(res.status).toBe(200);
		expect(res.headers.get('content-type')).toBe('text/plain');
		expect(await res.text()).toBe('raw bytes');
	});

	it('returns 404 when the file is missing on disk', async () => {
		const { id } = seedFile(app, '/nonexistent/path.txt');
		const res = await app.app.handle(req(`/api/files/${id}/raw`));
		expect(res.status).toBe(404);
		expect(await res.text()).toBe('File not found on disk');
	});

	it('returns 403 on ELOOP (circular symlink) instead of swallowing it as 404', async () => {
		// Create a → b → a; realpath() raises ELOOP rather than returning a path.
		const a = join(app.env.dir, 'loop-a');
		const b = join(app.env.dir, 'loop-b');
		symlinkSync(b, a);
		symlinkSync(a, b);
		const { id } = seedFile(app, a);
		const res = await app.app.handle(req(`/api/files/${id}/raw`));
		expect(res.status).toBe(403);
		expect(await res.text()).toBe('Forbidden');
	});

	it('returns 403 when the stored path resolves to a different canonical path (symlink-swap defense)', async () => {
		const realDir = join(app.env.dir, 'real');
		mkdirSync(realDir);
		const realPath = join(realDir, 'secret.txt');
		writeFileSync(realPath, 'secret', 'utf-8');

		const linkPath = join(app.env.dir, 'link.txt');
		symlinkSync(realPath, linkPath);

		const { id } = seedFile(app, linkPath);
		const res = await app.app.handle(req(`/api/files/${id}/raw`));
		expect(res.status).toBe(403);
		expect(await res.text()).toBe('Forbidden');
	});

	it('returns 400 on non-numeric id', async () => {
		const res = await app.app.handle(req('/api/files/abc/raw'));
		expect(res.status).toBe(400);
	});

	it('returns 404 when row is unknown', async () => {
		const res = await app.app.handle(req('/api/files/99999/raw'));
		expect(res.status).toBe(404);
	});
});
