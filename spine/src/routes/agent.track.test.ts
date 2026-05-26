import { afterEach, expect, test } from 'bun:test';
import { createTestDb } from '../testSupport/db';
import { agentJson, buildTestApp } from '../testSupport/http';
import type { TrackRow } from '../db/rows';

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

test('POST /api/agent/track stores normal and displaced records', async () => {
	const { app, db } = setup();
	const normal = await app.handle(
		agentJson('/api/agent/track', {
			text: 'drill is on the shelf',
			captured_at: '2026-01-02T03:04:05.000Z',
			source: 'ha-voice:printing-room',
			displaced: false,
		}),
	);
	expect(normal.status).toBe(201);
	const normalBody = (await normal.json()) as { id: number };

	const displaced = await app.handle(
		agentJson('/api/agent/track', {
			text: 'checked out drill to kitchen',
			captured_at: '2026-01-02T03:05:05.000Z',
			source: 'tasker-voice',
			displaced: true,
			photo_ref: 'signal-photo-1',
			supersedes: normalBody.id,
		}),
	);
	expect(displaced.status).toBe(201);

	const rows = db.query('SELECT * FROM tracks ORDER BY id').all() as TrackRow[];
	expect(rows).toHaveLength(2);
	expect(rows[0]).toMatchObject({
		text: 'drill is on the shelf',
		captured_at: '2026-01-02T03:04:05.000Z',
		source: 'ha-voice:printing-room',
		displaced: 0,
		photo_ref: null,
		supersedes: null,
	});
	expect(rows[0].ingested_at).toBeString();
	expect(rows[1]).toMatchObject({
		text: 'checked out drill to kitchen',
		source: 'tasker-voice',
		displaced: 1,
		photo_ref: 'signal-photo-1',
		supersedes: normalBody.id,
	});
});

test('POST /api/agent/track rejects invalid payloads and missing bearer token', async () => {
	const { app } = setup();
	const valid = {
		text: 'drill',
		captured_at: '2026-01-02T03:04:05.000Z',
		source: 'signal-text',
		displaced: false,
	};

	expect((await app.handle(agentJson('/api/agent/track', { ...valid, text: '   ' }))).status).toBe(
		400,
	);
	expect((await app.handle(agentJson('/api/agent/track', { ...valid, source: '' }))).status).toBe(
		400,
	);
	expect(
		(await app.handle(agentJson('/api/agent/track', { ...valid, displaced: 'false' }))).status,
	).toBe(400);
	expect(
		(await app.handle(agentJson('/api/agent/track', { ...valid, supersedes: 999 }))).status,
	).toBe(404);

	const noToken = await app.handle(
		new Request('http://spine.test/api/agent/track', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(valid),
		}),
	);
	expect(noToken.status).toBe(401);
});

test('POST /api/agent/track is append-only for duplicate and stale text', async () => {
	const { app, db } = setup();
	const payload = {
		text: 'wrench is on bench',
		captured_at: '2026-01-01T00:00:00.000Z',
		source: 'signal-text',
		displaced: false,
	};

	await app.handle(agentJson('/api/agent/track', payload));
	await app.handle(agentJson('/api/agent/track', payload));
	await app.handle(
		agentJson('/api/agent/track', { ...payload, captured_at: '2025-01-01T00:00:00.000Z' }),
	);

	const rows = db.query('SELECT id, text, captured_at FROM tracks ORDER BY id').all() as Pick<
		TrackRow,
		'id' | 'text' | 'captured_at'
	>[];
	expect(rows).toHaveLength(3);
	expect(rows.map((row) => row.text)).toEqual([
		'wrench is on bench',
		'wrench is on bench',
		'wrench is on bench',
	]);
});

test('HA voice normal and checkout payload examples match endpoint shape', async () => {
	const { app } = setup();
	const normal = await app.handle(
		agentJson('/api/agent/track', {
			text: 'track blue tape in printing room drawer',
			captured_at: '2026-01-02T03:04:05.000Z',
			source: 'ha-voice:printing-room',
			displaced: false,
		}),
	);
	const checkout = await app.handle(
		agentJson('/api/agent/track', {
			text: 'checkout blue tape to garage',
			captured_at: '2026-01-02T03:04:06.000Z',
			source: 'ha-voice:printing-room',
			displaced: true,
		}),
	);
	expect(normal.status).toBe(201);
	expect(checkout.status).toBe(201);
});
