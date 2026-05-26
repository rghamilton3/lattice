import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { buildTestApp, json, req, type TestApp } from '../helpers/app';

let app: TestApp;

beforeEach(async () => {
	app = await buildTestApp();
});

afterEach(async () => {
	await app?.cleanup();
});

function seedCapture(app: TestApp, text: string, capturedAt = '2026-05-01T00:00:00Z') {
	return app.db
		.prepare(
			'INSERT INTO captures (text, source, captured_at, ingested_at) VALUES (?, ?, ?, ?) RETURNING id',
		)
		.get(text, 'agent', capturedAt, capturedAt) as { id: number };
}

function seedFile(app: TestApp, text: string, modifiedAt = '2026-05-01T00:00:00Z') {
	return app.db
		.prepare(
			`INSERT INTO file_index
         (machine_id, path, hash, mime_type, text, modified_at, size_bytes, indexed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
		)
		.get(
			'm1',
			`/p/${text}.txt`,
			`h-${text}`,
			'text/plain',
			text,
			modifiedAt,
			text.length,
			modifiedAt,
		) as {
		id: number;
	};
}

describe('GET /api/similar', () => {
	it('returns 422 on invalid kind (TypeBox validation)', async () => {
		const res = await app.app.handle(req('/api/similar?id=1&kind=bogus'));
		expect(res.status).toBe(422);
	});

	it('returns 400 on non-numeric capture id', async () => {
		const res = await app.app.handle(req('/api/similar?id=abc&kind=capture'));
		expect(res.status).toBe(400);
	});

	it('returns 400 on partially numeric and non-positive ids', async () => {
		const partial = await app.app.handle(req('/api/similar?id=1abc&kind=local-file'));
		expect(partial.status).toBe(400);

		const zero = await app.app.handle(req('/api/similar?id=0&kind=capture'));
		expect(zero.status).toBe(400);
	});

	it('returns 404 when capture id is unknown', async () => {
		const res = await app.app.handle(req('/api/similar?id=999&kind=capture'));
		expect(res.status).toBe(404);
	});

	it('returns 404 when local-file id is unknown', async () => {
		const res = await app.app.handle(req('/api/similar?id=999&kind=local-file'));
		expect(res.status).toBe(404);
	});

	it('returns 404 when working slug is unknown', async () => {
		const res = await app.app.handle(req('/api/similar?id=missing&kind=working'));
		expect(res.status).toBe(404);
	});

	it('filters the source capture out of the results (self-exclusion)', async () => {
		const { id } = seedCapture(app, 'alpha');
		// Mock the search to return the source itself + a different capture.
		app.qmd.setHits([
			{
				file: `qmd://captures/${id}.md`,
				score: 0.99,
				bestChunk: 'alpha',
				body: 'alpha',
				displayPath: `captures/${id}.md`,
			},
			{
				file: `qmd://captures/999.md`,
				score: 0.5,
				bestChunk: 'beta',
				body: 'beta',
				displayPath: 'captures/999.md',
			},
		]);
		const res = await app.app.handle(req(`/api/similar?id=${id}&kind=capture`));
		const { results } = await json(res);
		const ids = results.map((r: any) => r.id);
		expect(ids).not.toContain(id);
		expect(ids).toContain(999);
	});

	it('filters the source working doc out by slug', async () => {
		// Create a working doc so readWorking() works.
		await app.app.handle(
			req('/api/working', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ title: 'Source' }),
			}),
		);
		app.qmd.setHits([
			{
				file: 'qmd://working/source.md',
				score: 0.9,
				bestChunk: 'x',
				body: 'x',
				displayPath: 'working/source.md',
			},
			{
				file: 'qmd://working/other.md',
				score: 0.5,
				bestChunk: 'y',
				body: 'y',
				displayPath: 'working/other.md',
			},
		]);
		const res = await app.app.handle(req('/api/similar?id=source&kind=working'));
		const { results } = await json(res);
		expect(results.map((r: any) => r.slug)).toEqual(['other']);
	});

	it('filters the source local file out of the results', async () => {
		const { id } = seedFile(app, 'source-file');
		seedFile(app, 'other-file', '2026-05-02T00:00:00Z');
		app.qmd.setHits([
			{
				file: 'qmd://local-files/m1/h-source-file.md',
				score: 0.9,
				bestChunk: 'source-file',
				body: 'source-file',
				displayPath: 'local-files/m1/h-source-file.md',
			},
			{
				file: 'qmd://local-files/m1/h-other-file.md',
				score: 0.8,
				bestChunk: 'other-file',
				body: 'other-file',
				displayPath: 'local-files/m1/h-other-file.md',
			},
		]);

		const res = await app.app.handle(req(`/api/similar?id=${id}&kind=local-file`));
		const { results } = await json(res);
		expect(results.map((r: any) => r.id)).not.toContain(id);
		expect(results.map((r: any) => r.snippet)).toEqual(['other-file']);
	});

	it('caps results at 10', async () => {
		const { id } = seedCapture(app, 'src');
		const hits = Array.from({ length: 20 }, (_, i) => ({
			file: `qmd://captures/${1000 + i}.md`,
			score: 1 - i * 0.01,
			bestChunk: `s${i}`,
			body: `b${i}`,
			displayPath: `captures/${1000 + i}.md`,
		}));
		app.qmd.setHits(hits);
		const res = await app.app.handle(req(`/api/similar?id=${id}&kind=capture`));
		expect((await json(res)).results.length).toBe(10);
	});
});

describe('GET /api/nearby', () => {
	it('returns 400 when timestamp is missing', async () => {
		const res = await app.app.handle(req('/api/nearby'));
		expect(res.status).toBe(422); // missing required query param → TypeBox 422
	});

	it('returns 400 when timestamp is whitespace only', async () => {
		const res = await app.app.handle(req('/api/nearby?timestamp=%20%20'));
		expect(res.status).toBe(400);
		expect((await json(res)).error).toBe('timestamp is required');
	});

	it('returns 400 on invalid timestamp', async () => {
		const res = await app.app.handle(req('/api/nearby?timestamp=not-a-date'));
		expect(res.status).toBe(400);
		expect((await json(res)).error).toBe('Invalid timestamp');
	});

	it('returns captures and files inside the window, sorted ASC by ts', async () => {
		seedCapture(app, 'a', '2026-05-01T00:00:00Z');
		seedCapture(app, 'b', '2026-05-02T00:00:00Z');
		seedFile(app, 'x', '2026-05-01T12:00:00Z');
		// outside the window
		seedCapture(app, 'old', '2025-01-01T00:00:00Z');

		const res = await app.app.handle(
			req('/api/nearby?timestamp=2026-05-01T12:00:00Z&window_hours=24'),
		);
		const { results } = await json(res);
		expect(results.length).toBe(3);
		// sorted ascending
		for (let i = 1; i < results.length; i++) {
			expect(results[i].ts >= results[i - 1].ts).toBe(true);
		}
		const snippets = results.map((r: any) => r.snippet);
		expect(snippets).toContain('a');
		expect(snippets).toContain('b');
		expect(snippets).toContain('x');
	});

	it('clamps window_hours to [1, 720]', async () => {
		// Negative values land in the clamp floor of 1h. A row 3h out should miss.
		seedCapture(app, 'far', '2026-05-01T03:00:00Z');
		const res = await app.app.handle(
			req('/api/nearby?timestamp=2026-05-01T00:00:00Z&window_hours=-5'),
		);
		expect((await json(res)).results.length).toBe(0);

		// window_hours=99999 → clamped to 720h, request succeeds.
		const big = await app.app.handle(
			req('/api/nearby?timestamp=2026-05-01T00:00:00Z&window_hours=99999'),
		);
		expect(big.status).toBe(200);
	});

	it('treats window_hours=0 as missing (uses default 72)', async () => {
		// `Number("0") || 72` falls back to 72. A row 24h out is within 72h.
		seedCapture(app, 'in-default-window', '2026-05-02T00:00:00Z');
		const res = await app.app.handle(
			req('/api/nearby?timestamp=2026-05-01T00:00:00Z&window_hours=0'),
		);
		expect((await json(res)).results.length).toBe(1);
	});

	it('local-file results include machine_id', async () => {
		seedFile(app, 'lf', '2026-05-01T00:00:00Z');
		const res = await app.app.handle(
			req('/api/nearby?timestamp=2026-05-01T00:00:00Z&window_hours=24'),
		);
		const { results } = await json(res);
		const lf = results.find((r: any) => r.kind === 'local-file');
		expect(lf?.machine_id).toBe('m1');
	});
});
