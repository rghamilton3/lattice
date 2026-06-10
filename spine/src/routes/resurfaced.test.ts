import { afterEach, expect, test, describe } from 'bun:test';
import { createTestDb } from '../testSupport/db';
import { browserGet, browserJson, buildTestApp } from '../testSupport/http';

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

function seedCapture(db: ReturnType<typeof createTestDb>['db'], id: number, text: string) {
	db.prepare(
		`INSERT INTO captures (id, text, source, captured_at, ingested_at)
		 VALUES (?, ?, 'test', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`,
	).run(id, text);
}

function seedSurfaced(
	db: ReturnType<typeof createTestDb>['db'],
	id: number,
	targetKind: string,
	targetId: string,
	reason: string,
	surfacedAt: string,
	dismissedAt: string | null = null,
) {
	db.prepare(
		`INSERT INTO surfaced (id, target_kind, target_id, reason, surfaced_at, dismissed_at)
		 VALUES (?, ?, ?, ?, ?, ?)`,
	).run(id, targetKind, targetId, reason, surfacedAt, dismissedAt);
}

describe('GET /api/resurfaced', () => {
	test('returns today non-dismissed surfaced items', async () => {
		const { db, app } = setup();
		seedCapture(db, 10, 'some interesting capture text');
		const todayAt = new Date().toISOString();
		seedSurfaced(db, 1, 'capture', '10', 'Not visited in a while', todayAt);

		const res = await app.handle(browserGet('/api/resurfaced'));
		expect(res.status).toBe(200);
		const body = (await res.json()) as { items: unknown[] };
		expect(body.items).toHaveLength(1);
		const item = body.items[0] as Record<string, unknown>;
		expect(item.id).toBe(1);
		expect(item.target_kind).toBe('capture');
		expect(item.target_id).toBe('10');
		expect(item.reason).toBe('Not visited in a while');
		expect(typeof item.snippet).toBe('string');
		expect(typeof item.title).toBe('string');
	});

	test('excludes dismissed items', async () => {
		const { db, app } = setup();
		seedCapture(db, 10, 'some text');
		const todayAt = new Date().toISOString();
		seedSurfaced(
			db,
			1,
			'capture',
			'10',
			'Not visited in a while',
			todayAt,
			new Date().toISOString(),
		);

		const res = await app.handle(browserGet('/api/resurfaced'));
		expect(res.status).toBe(200);
		const body = (await res.json()) as { items: unknown[] };
		expect(body.items).toHaveLength(0);
	});

	test('excludes items from previous days', async () => {
		const { db, app } = setup();
		seedCapture(db, 10, 'old capture');
		const yesterdayAt = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
		seedSurfaced(db, 1, 'capture', '10', 'Been a while', yesterdayAt);

		const res = await app.handle(browserGet('/api/resurfaced'));
		expect(res.status).toBe(200);
		const body = (await res.json()) as { items: unknown[] };
		expect(body.items).toHaveLength(0);
	});

	test('returns empty items when no surfaced rows', async () => {
		const { app } = setup();
		const res = await app.handle(browserGet('/api/resurfaced'));
		expect(res.status).toBe(200);
		const body = (await res.json()) as { items: unknown[] };
		expect(body.items).toHaveLength(0);
	});
});

describe('POST /api/resurfaced/:id/dismiss', () => {
	test('sets dismissed_at and item disappears from GET', async () => {
		const { db, app } = setup();
		seedCapture(db, 10, 'interesting text');
		const todayAt = new Date().toISOString();
		seedSurfaced(db, 1, 'capture', '10', 'Not visited in a while', todayAt);

		const dismissRes = await app.handle(browserJson('/api/resurfaced/1/dismiss', {}));
		expect(dismissRes.status).toBe(200);
		const body = (await dismissRes.json()) as { ok: boolean };
		expect(body.ok).toBe(true);

		// Should no longer appear in GET
		const getRes = await app.handle(browserGet('/api/resurfaced'));
		const getBody = (await getRes.json()) as { items: unknown[] };
		expect(getBody.items).toHaveLength(0);

		// dismissed_at should be set in DB
		const row = db
			.query<{ dismissed_at: string }, []>(`SELECT dismissed_at FROM surfaced WHERE id = 1`)
			.get();
		expect(row?.dismissed_at).toBeTruthy();
	});

	test('returns 404 for unknown id', async () => {
		const { app } = setup();
		const res = await app.handle(browserJson('/api/resurfaced/999/dismiss', {}));
		expect(res.status).toBe(404);
	});
});
