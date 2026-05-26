import { afterEach, expect, test } from 'bun:test';
import { createTestDb } from './testSupport/db';

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

test('tracks migration creates tables, indexes, and foreign keys', () => {
	const ctx = createTestDb();
	cleanup = ctx.cleanup;
	const { db } = ctx;

	const tables = db
		.query(
			"SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('tracks', 'track_queries')",
		)
		.all() as { name: string }[];
	expect(tables.map((row) => row.name).sort()).toEqual(['track_queries', 'tracks']);

	const indexes = db
		.query("SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'track%idx'")
		.all() as { name: string }[];
	expect(indexes.map((row) => row.name).sort()).toContain('tracks_captured_at_idx');
	expect(indexes.map((row) => row.name).sort()).toContain('track_queries_queried_at_idx');

	db.prepare(
		`INSERT INTO tracks (text, captured_at, ingested_at, source, displaced)
		 VALUES ('drill on shelf', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:01.000Z', 'test', 0)`,
	).run();
	expect(() =>
		db
			.prepare(
				`INSERT INTO tracks (text, captured_at, ingested_at, source, displaced, supersedes)
				 VALUES ('bad', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:01.000Z', 'test', 0, 999)`,
			)
			.run(),
	).toThrow();
	expect(() =>
		db
			.prepare(
				`INSERT INTO track_queries (query, queried_at, opened_track_id)
				 VALUES ('drill', '2026-01-01T00:00:02.000Z', 999)`,
			)
			.run(),
	).toThrow();
});
