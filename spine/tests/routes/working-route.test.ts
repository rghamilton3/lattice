import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { buildTestApp, json, req, type TestApp } from '../helpers/app';

let app: TestApp;

beforeEach(async () => {
	app = await buildTestApp();
});

afterEach(async () => {
	await app?.cleanup();
});

function postJson(path: string, body: unknown) {
	return req(path, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body),
	});
}

function putJson(path: string, body: unknown) {
	return req(path, {
		method: 'PUT',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body),
	});
}

describe('POST /api/working', () => {
	it('creates a doc with a slug derived from title', async () => {
		const res = await app.app.handle(postJson('/api/working', { title: 'My First Doc' }));
		expect(res.status).toBe(200);
		expect((await json(res)).slug).toBe('my-first-doc');
	});

	it('returns 409 on duplicate title', async () => {
		await app.app.handle(postJson('/api/working', { title: 'Dup' }));
		const res = await app.app.handle(postJson('/api/working', { title: 'Dup' }));
		expect(res.status).toBe(409);
		expect((await json(res)).error).toBe('Slug already exists');
	});

	it('rejects an empty title with 422 (TypeBox validation)', async () => {
		const res = await app.app.handle(postJson('/api/working', { title: '' }));
		expect(res.status).toBe(422);
	});

	it('seeds content from a capture when seed_capture_id is given', async () => {
		const { id } = app.db
			.prepare(
				'INSERT INTO captures (text, source, captured_at, ingested_at) VALUES (?, ?, ?, ?) RETURNING id',
			)
			.get('capture text', 'agent', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z') as {
			id: number;
		};

		const res = await app.app.handle(
			postJson('/api/working', { title: 'From Capture', seed_capture_id: id }),
		);
		expect(res.status).toBe(200);
		const { slug } = await json(res);

		const get = await app.app.handle(req(`/api/working/${slug}`));
		const doc = await json(get);
		expect(doc.content).toContain(`# From Capture`);
		expect(doc.content).toContain(`> Seeded from capture #${id}`);
		expect(doc.content).toContain('capture text');
	});

	it('returns 404 when seed_capture_id does not exist', async () => {
		const res = await app.app.handle(
			postJson('/api/working', { title: 'x', seed_capture_id: 999 }),
		);
		expect(res.status).toBe(404);
		expect((await json(res)).error).toBe('Capture not found');
	});

	it('seeds content from a file when seed_file_id is given', async () => {
		const { id } = app.db
			.prepare(
				`INSERT INTO file_index
           (machine_id, path, hash, mime_type, text, modified_at, size_bytes, indexed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
			)
			.get(
				'm1',
				'/notes.md',
				'h1',
				'text/markdown',
				'file text',
				'2026-01-01',
				9,
				'2026-01-01',
			) as {
			id: number;
		};

		const res = await app.app.handle(
			postJson('/api/working', { title: 'From File', seed_file_id: id }),
		);
		expect(res.status).toBe(200);
		const { slug } = await json(res);

		const get = await app.app.handle(req(`/api/working/${slug}`));
		const doc = await json(get);
		expect(doc.content).toContain('> Seeded from file: /notes.md');
		expect(doc.content).toContain('file text');
	});

	it('returns 404 when seed_file_id does not exist', async () => {
		const res = await app.app.handle(postJson('/api/working', { title: 'x', seed_file_id: 999 }));
		expect(res.status).toBe(404);
	});
});

describe('GET /api/working', () => {
	it('returns an empty list when no docs exist', async () => {
		const res = await app.app.handle(req('/api/working'));
		expect(res.status).toBe(200);
		expect(await json(res)).toEqual([]);
	});

	it('returns summaries for all docs', async () => {
		await app.app.handle(postJson('/api/working', { title: 'Alpha' }));
		await app.app.handle(postJson('/api/working', { title: 'Beta' }));
		const res = await app.app.handle(req('/api/working'));
		const list = await json(res);
		expect(list.length).toBe(2);
		expect(list.map((d: any) => d.slug).sort()).toEqual(['alpha', 'beta']);
	});
});

describe('GET /api/working/:slug', () => {
	it('returns 404 on missing doc', async () => {
		const res = await app.app.handle(req('/api/working/missing'));
		expect(res.status).toBe(404);
	});

	it('rejects invalid slug shapes with 422 (validation)', async () => {
		const res = await app.app.handle(req('/api/working/Bad-Slug'));
		expect(res.status).toBe(422);
	});
});

describe('PUT /api/working/:slug', () => {
	it('updates an existing doc', async () => {
		await app.app.handle(postJson('/api/working', { title: 'edit' }));
		const res = await app.app.handle(putJson('/api/working/edit', { content: 'new body' }));
		expect(res.status).toBe(200);
		const get = await app.app.handle(req('/api/working/edit'));
		expect((await json(get)).content).toBe('new body');
	});

	it('returns 404 on unknown slug', async () => {
		const res = await app.app.handle(putJson('/api/working/nope', { content: 'x' }));
		expect(res.status).toBe(404);
	});
});

describe('DELETE /api/working/:slug', () => {
	it('removes an existing doc', async () => {
		await app.app.handle(postJson('/api/working', { title: 'kill' }));
		const del = await app.app.handle(req('/api/working/kill', { method: 'DELETE' }));
		expect(del.status).toBe(200);
		const get = await app.app.handle(req('/api/working/kill'));
		expect(get.status).toBe(404);
	});

	it('returns 404 on unknown slug', async () => {
		const res = await app.app.handle(req('/api/working/nope', { method: 'DELETE' }));
		expect(res.status).toBe(404);
	});
});
