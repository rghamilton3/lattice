import { afterEach, expect, test } from 'bun:test';
import { createTestDb } from '../testSupport/db';
import { agentJson, browserGet, browserJson, buildTestApp } from '../testSupport/http';
import type { TrackSearchResponse } from '../db/rows';

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function setup() {
	const ctx = createTestDb();
	cleanup = ctx.cleanup;
	return { ...ctx, app: buildTestApp(ctx.db, ctx.dir) };
}

async function createTrack(
	app: ReturnType<typeof buildTestApp>,
	text: string,
	captured_at: string,
) {
	const response = await app.handle(
		agentJson('/api/agent/track', { text, captured_at, source: 'signal-text', displaced: false }),
	);
	return (await response.json()) as { id: number };
}

test('GET /api/tracks/search logs query and returns newest-first matching records', async () => {
	const { app } = setup();
	await createTrack(app, 'old drill in cabinet', '2026-01-01T00:00:00.000Z');
	const newest = await createTrack(app, 'new drill on shelf', '2026-01-02T00:00:00.000Z');
	await createTrack(app, 'hammer in drawer', '2026-01-03T00:00:00.000Z');

	const response = await app.handle(browserGet('/api/tracks/search?q=drill'));
	expect(response.status).toBe(200);
	const body = (await response.json()) as TrackSearchResponse;
	expect(body.query_id).toBeGreaterThan(0);
	expect(body.results.map((row) => row.text)).toEqual([
		'new drill on shelf',
		'old drill in cabinet',
	]);
	expect(body.results[0]).toMatchObject({
		id: newest.id,
		captured_at: '2026-01-02T00:00:00.000Z',
		source: 'signal-text',
		displaced: false,
		photo_ref: null,
		supersedes: null,
	});
});

test('GET /api/tracks/search rejects blank and unauthenticated queries and logs no-match searches', async () => {
	const { app } = setup();
	expect((await app.handle(browserGet('/api/tracks/search?q=%20%20'))).status).toBe(400);
	expect(
		(await app.handle(new Request('http://spine.test/api/tracks/search?q=drill'))).status,
	).toBe(401);

	const response = await app.handle(browserGet('/api/tracks/search?q=missing'));
	const body = (await response.json()) as TrackSearchResponse;
	expect(response.status).toBe(200);
	expect(body.results).toEqual([]);
	expect(body.query_id).toBeGreaterThan(0);
});

test('POST /api/tracks/queries/:id/open records opened result and handles errors', async () => {
	const { app, db } = setup();
	const track = await createTrack(app, 'drill on shelf', '2026-01-02T00:00:00.000Z');
	const search = await app.handle(browserGet('/api/tracks/search?q=drill'));
	const searchBody = (await search.json()) as TrackSearchResponse;

	const opened = await app.handle(
		browserJson(`/api/tracks/queries/${searchBody.query_id}/open`, { track_id: track.id }),
	);
	expect(opened.status).toBe(200);
	expect(await opened.json()).toEqual({ ok: true });
	const queryRow = db
		.query('SELECT opened_track_id FROM track_queries WHERE id = ?')
		.get(searchBody.query_id) as { opened_track_id: number };
	expect(queryRow.opened_track_id).toBe(track.id);

	expect(
		(
			await app.handle(
				browserJson(`/api/tracks/queries/${searchBody.query_id}/open`, { track_id: 0 }),
			)
		).status,
	).toBe(400);
	expect(
		(await app.handle(browserJson('/api/tracks/queries/999/open', { track_id: track.id }))).status,
	).toBe(404);
	expect(
		(
			await app.handle(
				browserJson(`/api/tracks/queries/${searchBody.query_id}/open`, { track_id: 999 }),
			)
		).status,
	).toBe(404);
});
