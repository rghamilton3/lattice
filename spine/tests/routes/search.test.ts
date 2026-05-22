import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { writeFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { buildTestApp, json, req, type TestApp } from '../helpers/app';

let app: TestApp;

beforeEach(async () => {
	app = await buildTestApp();
});

afterEach(async () => {
	await app?.cleanup();
});

describe('GET /api/search', () => {
	it('returns 400 when q is missing', async () => {
		const res = await app.app.handle(req('/api/search'));
		expect(res.status).toBe(400);
		expect((await json(res)).error).toBe('q is required');
	});

	it('returns 400 when q is whitespace only', async () => {
		const res = await app.app.handle(req('/api/search?q=%20%20%20'));
		expect(res.status).toBe(400);
	});

	it('returns mapped capture hits from the mocked store', async () => {
		app.db
			.query(
				'INSERT INTO captures (id, text, source, captured_at, ingested_at) VALUES (?, ?, ?, ?, ?)',
			)
			.run(42, 'test text', 'test source', '2024-01-15T10:00:00.000Z', '2024-01-15T10:00:00.000Z');
		app.qmd.setHits([
			{
				file: 'qmd://captures/42.md',
				score: 0.9,
				bestChunk: 'snippet',
				body: 'full body',
				displayPath: 'captures/42.md',
			},
		]);
		const res = await app.app.handle(req('/api/search?q=hello'));
		expect(res.status).toBe(200);
		const { results } = await json(res);
		expect(results).toEqual([
			{
				id: 42,
				score: 0.9,
				snippet: 'snippet',
				body: 'full body',
				path: 'captures/42.md',
				kind: 'capture',
				modified_at: '2024-01-15T10:00:00.000Z',
			},
		]);
	});

	it('returns mapped working-doc hits with slug', async () => {
		const workingPath = join(dirname(app.env.dbPath), 'working', 'my-note.md');
		writeFileSync(workingPath, '# My Note\n');
		const expectedMtime = statSync(workingPath).mtime.toISOString();
		app.qmd.setHits([
			{
				file: 'qmd://working/my-note.md',
				score: 0.7,
				bestChunk: 'wd snippet',
				body: 'wd body',
				displayPath: 'working/my-note.md',
			},
		]);
		const res = await app.app.handle(req('/api/search?q=hello'));
		const { results } = await json(res);
		expect(results).toEqual([
			{
				id: 0,
				score: 0.7,
				snippet: 'wd snippet',
				body: 'wd body',
				path: 'working/my-note.md',
				kind: 'working',
				slug: 'my-note',
				modified_at: expectedMtime,
			},
		]);
	});

	it('returns mapped local-file hits with machine_id', async () => {
		app.db
			.query(
				'INSERT INTO file_index (machine_id, path, hash, mime_type, text, modified_at, size_bytes, indexed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
			)
			.run(
				'laptop-1',
				'/docs/file.md',
				'abc',
				'text/plain',
				'content',
				'2024-03-20T08:00:00.000Z',
				100,
				'2024-03-20T08:00:00.000Z',
			);
		app.qmd.setHits([
			{
				file: 'qmd://local-files/laptop-1/abc.md',
				score: 0.5,
				bestChunk: 'lf snippet',
				body: 'lf body',
				displayPath: 'local-files/laptop-1/abc.md',
			},
		]);
		const res = await app.app.handle(req('/api/search?q=hello'));
		const { results } = await json(res);
		expect(results[0]).toMatchObject({
			kind: 'local-file',
			machine_id: 'laptop-1',
			score: 0.5,
			modified_at: '2024-03-20T08:00:00.000Z',
		});
	});

	it("drops hits that don't live in a known collection root", async () => {
		app.qmd.setHits([
			{
				file: '/tmp/some-random.md',
				score: 0.3,
				bestChunk: 'x',
				body: 'x',
				displayPath: '?',
			},
		]);
		const res = await app.app.handle(req('/api/search?q=hello'));
		expect((await json(res)).results).toEqual([]);
	});

	it('drops capture hits whose filename does not parse as an integer', async () => {
		app.qmd.setHits([
			{
				file: 'qmd://captures/not-a-number.md',
				score: 0.5,
				bestChunk: 'x',
				body: 'x',
				displayPath: 'x',
			},
		]);
		const res = await app.app.handle(req('/api/search?q=hello'));
		expect((await json(res)).results).toEqual([]);
	});

	it('fast search passes lex+vec queries and rerank:false to the store', async () => {
		await app.app.handle(req('/api/search?q=hello'));
		const args = app.qmd.getLastSearchArgs() as any;
		expect(args).toMatchObject({ queries: expect.any(Array), rerank: false });
	});

	it('deep search passes a single query string to the store', async () => {
		await app.app.handle(req('/api/search?q=hello&deep=true'));
		const args = app.qmd.getLastSearchArgs() as any;
		expect(args).toHaveProperty('query', 'hello');
		expect(args).not.toHaveProperty('queries');
	});

	it("?deep=false routes to fast search — only 'true' enables deep", async () => {
		await app.app.handle(req('/api/search?q=hello&deep=false'));
		const args = app.qmd.getLastSearchArgs() as any;
		expect(args).toMatchObject({ rerank: false });
	});
});
