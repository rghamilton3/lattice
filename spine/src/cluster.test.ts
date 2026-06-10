import { afterEach, expect, test, describe } from 'bun:test';
import { createTestDb } from './testSupport/db';
import { kmeans, selectResurfaceItems, runResurfacePass } from './cluster';

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function setup() {
	const ctx = createTestDb();
	cleanup = ctx.cleanup;
	return ctx;
}

function makeSyntheticVector(dim: number, base: number): Float32Array {
	const v = new Float32Array(dim);
	for (let i = 0; i < dim; i++) {
		v[i] = base + (i % 10) * 0.01;
	}
	// Normalize
	let mag = 0;
	for (let i = 0; i < dim; i++) mag += v[i] * v[i];
	mag = Math.sqrt(mag);
	for (let i = 0; i < dim; i++) v[i] /= mag;
	return v;
}

describe('kmeans', () => {
	test('clusters 5 synthetic vectors into 2 groups', () => {
		const dim = 768;
		// Two distinct directions: positive-dominant vs negative-dominant
		const groupA = [
			makeSyntheticVector(dim, 1.0),
			makeSyntheticVector(dim, 1.1),
			makeSyntheticVector(dim, 1.2),
		];
		const groupB = [makeSyntheticVector(dim, 100.0), makeSyntheticVector(dim, 100.1)];
		const points = [...groupA, ...groupB];
		const clusters = kmeans(points, 2);

		expect(clusters.length).toBe(2);
		const totalMembers = clusters.reduce((s, c) => s + c.members.length, 0);
		expect(totalMembers).toBe(5);

		// Each cluster should contain 3 or 2 members (groupA and groupB)
		const sizes = clusters.map((c) => c.members.length).sort();
		expect(sizes).toEqual([2, 3]);
	});

	test('returns single cluster when k=1', () => {
		const dim = 768;
		const points = [makeSyntheticVector(dim, 1.0), makeSyntheticVector(dim, 2.0)];
		const clusters = kmeans(points, 1);
		expect(clusters.length).toBe(1);
		expect(clusters[0].members.length).toBe(2);
	});
});

describe('selectResurfaceItems', () => {
	test('skips items surfaced within 7 days', () => {
		const { db } = setup();

		// Seed capture
		db.prepare(
			`INSERT INTO captures (id, text, source, captured_at, ingested_at) VALUES (1, 'test capture', 'test', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`,
		).run();

		// Seed cluster with membership
		db.prepare(`INSERT INTO clusters (id, run_at) VALUES (1, '2026-06-09T00:00:00Z')`).run();
		db.prepare(
			`INSERT INTO cluster_memberships (cluster_id, target_kind, target_id) VALUES (1, 'capture', '1')`,
		).run();

		// Seed a recent surfaced row (3 days ago — within 7-day window)
		const recentAt = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
		db.prepare(
			`INSERT INTO surfaced (target_kind, target_id, surfaced_at) VALUES ('capture', '1', ?)`,
		).run(recentAt);

		const candidates = selectResurfaceItems(db);
		expect(candidates.length).toBe(0); // Should be skipped
	});

	test('includes items surfaced more than 7 days ago', () => {
		const { db } = setup();

		db.prepare(
			`INSERT INTO captures (id, text, source, captured_at, ingested_at) VALUES (1, 'test capture', 'test', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`,
		).run();
		db.prepare(`INSERT INTO clusters (id, run_at) VALUES (1, '2026-06-09T00:00:00Z')`).run();
		db.prepare(
			`INSERT INTO cluster_memberships (cluster_id, target_kind, target_id) VALUES (1, 'capture', '1')`,
		).run();

		// Surfaced 8 days ago — outside the 7-day window, should be eligible
		const oldAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
		db.prepare(
			`INSERT INTO surfaced (target_kind, target_id, surfaced_at) VALUES ('capture', '1', ?)`,
		).run(oldAt);

		const candidates = selectResurfaceItems(db);
		expect(candidates.length).toBe(1);
		expect(candidates[0].reason).toBe('Been a while');
	});

	test('prioritises never-surfaced items over previously-surfaced ones', () => {
		const { db } = setup();

		// Two captures in same cluster
		db.prepare(
			`INSERT INTO captures (id, text, source, captured_at, ingested_at) VALUES (1, 'capture one', 'test', '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z')`,
		).run();
		db.prepare(
			`INSERT INTO captures (id, text, source, captured_at, ingested_at) VALUES (2, 'capture two', 'test', '2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z')`,
		).run();

		db.prepare(`INSERT INTO clusters (id, run_at) VALUES (1, '2026-06-09T00:00:00Z')`).run();
		db.prepare(
			`INSERT INTO cluster_memberships (cluster_id, target_kind, target_id) VALUES (1, 'capture', '1')`,
		).run();
		db.prepare(
			`INSERT INTO cluster_memberships (cluster_id, target_kind, target_id) VALUES (1, 'capture', '2')`,
		).run();

		// Capture 2 was surfaced 10 days ago; capture 1 was never surfaced
		const oldAt = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
		db.prepare(
			`INSERT INTO surfaced (target_kind, target_id, surfaced_at) VALUES ('capture', '2', ?)`,
		).run(oldAt);

		const candidates = selectResurfaceItems(db);
		expect(candidates.length).toBe(1);
		expect(candidates[0].targetId).toBe('1'); // Never-surfaced wins
		expect(candidates[0].reason).toBe('Not visited in a while');
	});
});

describe('runResurfacePass idempotency', () => {
	test('running twice on the same day does not duplicate surfaced rows', () => {
		const { db } = setup();

		db.prepare(
			`INSERT INTO captures (id, text, source, captured_at, ingested_at) VALUES (1, 'hello world', 'test', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`,
		).run();
		db.prepare(`INSERT INTO clusters (id, run_at) VALUES (1, '2026-06-09T00:00:00Z')`).run();
		db.prepare(
			`INSERT INTO cluster_memberships (cluster_id, target_kind, target_id) VALUES (1, 'capture', '1')`,
		).run();

		runResurfacePass(db);
		const countAfterFirst =
			db
				.query<
					{ n: number },
					[]
				>(`SELECT COUNT(*) AS n FROM surfaced WHERE DATE(surfaced_at) = DATE('now')`)
				.get()?.n ?? 0;

		runResurfacePass(db);
		const countAfterSecond =
			db
				.query<
					{ n: number },
					[]
				>(`SELECT COUNT(*) AS n FROM surfaced WHERE DATE(surfaced_at) = DATE('now')`)
				.get()?.n ?? 0;

		expect(countAfterSecond).toBe(countAfterFirst);
	});
});
