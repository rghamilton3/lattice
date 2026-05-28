import { afterEach, expect, test } from 'bun:test';
import { createTestDb } from '../testSupport/db';
import { agentJson, browserGet, browserJson, buildTestApp } from '../testSupport/http';
import { scoreTrackMatch, tokenizeTrackText } from './tracks';
import type { TrackFollowUp, TrackSearchResponse } from '../db/rows';

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
	displaced = false,
) {
	const response = await app.handle(
		agentJson('/api/agent/track', { text, captured_at, source: 'signal-text', displaced }),
	);
	return (await response.json()) as { id: number };
}

function ageQuery(db: ReturnType<typeof createTestDb>['db'], queryId: number, queriedAt: string) {
	db.prepare('UPDATE track_queries SET queried_at = ? WHERE id = ?').run(queriedAt, queryId);
}

function eligibleQueriedAt() {
	return new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
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
	expect(body.primary?.text).toBe('new drill on shelf');
	expect(body.history.map((row) => row.text)).toEqual(['old drill in cabinet']);
	expect(body.empty_message).toBeNull();
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
	expect(body.primary).toBeNull();
	expect(body.history).toEqual([]);
	expect(body.empty_message).toBe('No matching tracks found.');
	expect(body.query_id).toBeGreaterThan(0);
});

test('tokenization and scoring ignore ordinary question words', () => {
	expect(tokenizeTrackText('where is the drill on the shelf?')).toEqual(['drill', 'shelf']);
	expect(scoreTrackMatch(tokenizeTrackText('where is the drill'), 'drill is on the shelf')).toBe(2);
	expect(scoreTrackMatch(tokenizeTrackText('where is the drill'), 'hammer is in the drawer')).toBe(
		0,
	);
});

test('GET /api/tracks/search ranks ordinary multi-token wording by match quality then recency', async () => {
	const { app } = setup();
	await createTrack(app, 'drill on workbench', '2026-01-03T00:00:00.000Z');
	const better = await createTrack(
		app,
		'drill is on the garage top shelf, blue case',
		'2026-01-02T00:00:00.000Z',
	);

	const response = await app.handle(
		browserGet('/api/tracks/search?q=where%20is%20the%20garage%20drill'),
	);
	const body = (await response.json()) as TrackSearchResponse;
	expect(body.primary?.id).toBe(better.id);
	expect(body.history.map((row) => row.text)).toEqual(['drill on workbench']);
});

test('POST /api/tracks/queries/:id/open records opened result and handles errors', async () => {
	const { app, db } = setup();
	const track = await createTrack(app, 'drill on shelf', '2026-01-02T00:00:00.000Z');
	const alternateTrack = await createTrack(app, 'drill on bench', '2026-01-03T00:00:00.000Z');
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
				browserJson(`/api/tracks/queries/${searchBody.query_id}/open`, {
					track_id: alternateTrack.id,
				}),
			)
		).status,
	).toBe(409);
	expect(
		(
			db
				.query('SELECT opened_track_id FROM track_queries WHERE id = ?')
				.get(searchBody.query_id) as {
				opened_track_id: number;
			}
		).opened_track_id,
	).toBe(track.id);

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
	const missingTrackSearch = (await (
		await app.handle(browserGet('/api/tracks/search?q=drill'))
	).json()) as TrackSearchResponse;
	expect(
		(
			await app.handle(
				browserJson(`/api/tracks/queries/${missingTrackSearch.query_id}/open`, { track_id: 999 }),
			)
		).status,
	).toBe(404);
});

test('GET /api/tracks/followups returns eligible opened queries with displaced-aware labels', async () => {
	const { app, db } = setup();
	const normal = await createTrack(app, 'drill on shelf', '2026-01-02T00:00:00.000Z');
	const displaced = await createTrack(
		app,
		'ladder checked out to deck',
		'2026-01-02T00:00:00.000Z',
		true,
	);
	const normalSearch = (await (
		await app.handle(browserGet('/api/tracks/search?q=drill'))
	).json()) as TrackSearchResponse;
	const displacedSearch = (await (
		await app.handle(browserGet('/api/tracks/search?q=ladder'))
	).json()) as TrackSearchResponse;
	await app.handle(
		browserJson(`/api/tracks/queries/${normalSearch.query_id}/open`, { track_id: normal.id }),
	);
	await app.handle(
		browserJson(`/api/tracks/queries/${displacedSearch.query_id}/open`, { track_id: displaced.id }),
	);
	ageQuery(db, normalSearch.query_id, eligibleQueriedAt());
	ageQuery(db, displacedSearch.query_id, eligibleQueriedAt());

	const response = await app.handle(browserGet('/api/tracks/followups'));
	const body = (await response.json()) as { followups: TrackFollowUp[] };
	expect(body.followups.map((followup) => followup.affirmative_label).sort()).toEqual([
		'Still out',
		'Still there',
	]);
	expect(body.followups[0].expires_at).toBeString();
});

test('GET /api/tracks/followups omits unopened, newer-matched, and expired queries', async () => {
	const { app, db } = setup();
	const unopenedTrack = await createTrack(app, 'saw on pegboard', '2026-01-02T00:00:00.000Z');
	const suppressedTrack = await createTrack(app, 'drill on shelf', '2026-01-02T00:00:00.000Z');
	const expiredTrack = await createTrack(app, 'hammer in drawer', '2026-01-02T00:00:00.000Z');
	const unopened = (await (
		await app.handle(browserGet('/api/tracks/search?q=saw'))
	).json()) as TrackSearchResponse;
	const suppressed = (await (
		await app.handle(browserGet('/api/tracks/search?q=drill'))
	).json()) as TrackSearchResponse;
	const expired = (await (
		await app.handle(browserGet('/api/tracks/search?q=hammer'))
	).json()) as TrackSearchResponse;
	await app.handle(
		browserJson(`/api/tracks/queries/${suppressed.query_id}/open`, {
			track_id: suppressedTrack.id,
		}),
	);
	await app.handle(
		browserJson(`/api/tracks/queries/${expired.query_id}/open`, { track_id: expiredTrack.id }),
	);
	await app.handle(
		browserJson(`/api/tracks/queries/${unopened.query_id}/open`, { track_id: unopenedTrack.id }),
	);
	db.prepare('UPDATE track_queries SET opened_track_id = NULL WHERE id = ?').run(unopened.query_id);
	ageQuery(db, suppressed.query_id, eligibleQueriedAt());
	ageQuery(db, expired.query_id, '2020-01-01T00:00:00.000Z');
	await createTrack(app, 'drill moved to garage bench', new Date().toISOString());

	const response = await app.handle(browserGet('/api/tracks/followups'));
	const body = (await response.json()) as { followups: TrackFollowUp[] };
	expect(body.followups).toEqual([]);
	const expiredRow = db
		.query('SELECT loop_outcome, loop_closed_at FROM track_queries WHERE id = ?')
		.get(expired.query_id) as { loop_outcome: string; loop_closed_at: string };
	expect(expiredRow.loop_outcome).toBe('expired');
	expect(expiredRow.loop_closed_at).toBeString();
});

test('GET /api/tracks/followups keeps queries when newer tracks only match opened-track location', async () => {
	const { app, db } = setup();
	const track = await createTrack(app, 'drill on shelf', '2026-01-02T00:00:00.000Z');
	const search = (await (
		await app.handle(browserGet('/api/tracks/search?q=drill'))
	).json()) as TrackSearchResponse;
	await app.handle(
		browserJson(`/api/tracks/queries/${search.query_id}/open`, { track_id: track.id }),
	);
	ageQuery(db, search.query_id, eligibleQueriedAt());
	await createTrack(app, 'book on shelf', new Date().toISOString());

	const response = await app.handle(browserGet('/api/tracks/followups'));
	const body = (await response.json()) as { followups: TrackFollowUp[] };
	expect(body.followups.map((followup) => followup.query_id)).toEqual([search.query_id]);
});

test('follow-up endpoints close still-accurate, moved, and skipped outcomes', async () => {
	const { app, db } = setup();
	const stillTrack = await createTrack(app, 'drill on shelf', '2026-01-02T00:00:00.000Z');
	const movedTrack = await createTrack(app, 'wrench on bench', '2026-01-02T00:00:00.000Z');
	const skipTrack = await createTrack(app, 'pliers in drawer', '2026-01-02T00:00:00.000Z');
	const still = (await (
		await app.handle(browserGet('/api/tracks/search?q=drill'))
	).json()) as TrackSearchResponse;
	const moved = (await (
		await app.handle(browserGet('/api/tracks/search?q=wrench'))
	).json()) as TrackSearchResponse;
	const skipped = (await (
		await app.handle(browserGet('/api/tracks/search?q=pliers'))
	).json()) as TrackSearchResponse;
	await app.handle(
		browserJson(`/api/tracks/queries/${still.query_id}/open`, { track_id: stillTrack.id }),
	);
	await app.handle(
		browserJson(`/api/tracks/queries/${moved.query_id}/open`, { track_id: movedTrack.id }),
	);
	await app.handle(
		browserJson(`/api/tracks/queries/${skipped.query_id}/open`, { track_id: skipTrack.id }),
	);
	for (const queryId of [still.query_id, moved.query_id, skipped.query_id]) {
		ageQuery(db, queryId, eligibleQueriedAt());
	}

	expect(
		(await app.handle(browserJson(`/api/tracks/followups/${still.query_id}/still-accurate`, {})))
			.status,
	).toBe(200);
	const movedResponse = await app.handle(
		browserJson(`/api/tracks/followups/${moved.query_id}/moved`, {
			text: 'wrench moved to tool bag',
			captured_at: '2026-01-03T00:00:00.000Z',
			source: 'manual-followup',
			displaced: false,
		}),
	);
	expect(movedResponse.status).toBe(201);
	expect(
		(await app.handle(browserJson(`/api/tracks/followups/${skipped.query_id}/skip`, {}))).status,
	).toBe(200);
	expect(
		(await app.handle(browserJson(`/api/tracks/followups/${moved.query_id}/moved`, { text: ' ' })))
			.status,
	).toBe(400);

	const outcomes = db.query('SELECT loop_outcome FROM track_queries ORDER BY id').all() as {
		loop_outcome: string;
	}[];
	expect(outcomes.map((row) => row.loop_outcome)).toEqual(['still_accurate', 'moved', 'skipped']);
	const superseding = db
		.query('SELECT supersedes FROM tracks WHERE text = ?')
		.get('wrench moved to tool bag') as { supersedes: number };
	expect(superseding.supersedes).toBe(movedTrack.id);
});
