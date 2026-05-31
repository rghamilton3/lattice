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
		const row = app.db
			.query(
				'INSERT INTO file_index (machine_id, path, hash, mime_type, text, modified_at, size_bytes, indexed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id',
			)
			.get(
				'laptop-1',
				'/docs/file.md',
				'abc',
				'text/plain',
				'content',
				'2024-03-20T08:00:00.000Z',
				100,
				'2024-03-20T08:00:00.000Z',
			) as { id: number };
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
			id: row.id,
			kind: 'local-file',
			machine_id: 'laptop-1',
			score: 0.5,
			modified_at: '2024-03-20T08:00:00.000Z',
		});
	});

	it('returns mapped annotation hits with source target context', async () => {
		app.db
			.prepare(
				`INSERT INTO annotations
				 (id, target_kind, target_id, selection_text, comment, created_at, updated_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?)`,
			)
			.run(
				'ann_search',
				'working',
				'daily-note',
				'important passage',
				'searchable annotation note',
				'2026-01-01T00:00:00.000Z',
				'2026-01-02T00:00:00.000Z',
			);
		app.qmd.setHits([
			{
				file: 'qmd://annotations/ann_search.md',
				score: 0.8,
				bestChunk: 'annotation snippet',
				body: 'annotation body',
				displayPath: 'annotations/ann_search.md',
			},
		]);

		const res = await app.app.handle(req('/api/search?q=annotation'));
		const { results } = await json(res);

		expect(results).toEqual([
			{
				id: 'ann_search',
				score: 0.8,
				snippet: 'annotation snippet',
				body: 'annotation body',
				path: 'annotations/ann_search.md',
				kind: 'annotation',
				title: 'Annotation on working daily-note',
				target_kind: 'working',
				target_id: 'daily-note',
				annotation_id: 'ann_search',
				modified_at: '2026-01-02T00:00:00.000Z',
			},
		]);
	});

	it('drops local-file hits without a backing file_index row', async () => {
		app.qmd.setHits([
			{
				file: 'qmd://local-files/laptop-1/missing-hash.md',
				score: 0.5,
				bestChunk: 'lf snippet',
				body: 'lf body',
				displayPath: 'local-files/laptop-1/missing-hash.md',
			},
		]);
		const res = await app.app.handle(req('/api/search?q=hello'));
		expect((await json(res)).results).toEqual([]);
	});

	it('drops capture attachment hits without a backing metadata row', async () => {
		app.qmd.setHits([
			{
				file: 'qmd://capture-attachments/9999.md',
				score: 0.5,
				bestChunk: 'missing attachment',
				body: 'missing attachment',
				displayPath: 'capture-attachments/9999.md',
			},
		]);
		const res = await app.app.handle(req('/api/search?q=attachment'));
		expect((await json(res)).results).toEqual([]);
	});

	it('drops working attachment hits without a backing metadata row', async () => {
		app.qmd.setHits([
			{
				file: 'qmd://working-attachments/9999.md',
				score: 0.5,
				bestChunk: 'missing attachment',
				body: 'missing attachment',
				displayPath: 'working-attachments/9999.md',
			},
		]);
		const res = await app.app.handle(req('/api/search?q=attachment'));
		expect((await json(res)).results).toEqual([]);
	});

	it('returns a safe empty result list when search is unavailable', async () => {
		const { __resetSearchForTests } = await import('../../src/search');
		__resetSearchForTests();
		const res = await app.app.handle(req('/api/search?q=hello'));
		expect(res.status).toBe(200);
		expect(await json(res)).toEqual({ results: [] });
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
