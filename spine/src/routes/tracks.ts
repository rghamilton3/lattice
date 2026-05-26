import { Elysia, t } from 'elysia';
import type { Database } from 'bun:sqlite';
import type { TrackRow, TrackSearchResponse, TrackSearchResult } from '../db/rows';

function escapeLike(value: string): string {
	return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

function toSearchResult(row: TrackRow): TrackSearchResult {
	return { ...row, displaced: row.displaced === 1 };
}

export const tracksRoutes = (db: Database) =>
	new Elysia({ prefix: '/api/tracks' })
		.get('/search', ({ query, set }): TrackSearchResponse | { error: string } => {
			const q = typeof query.q === 'string' ? query.q.trim() : '';
			if (!q) {
				set.status = 400;
				return { error: 'query is required' };
			}

			const now = new Date().toISOString();
			const inserted = db
				.prepare('INSERT INTO track_queries (query, queried_at) VALUES (?, ?) RETURNING id')
				.get(q, now) as { id: number };
			const rows = db
				.prepare(
					`SELECT id, text, captured_at, ingested_at, source, displaced, photo_ref, supersedes
					 FROM tracks
					 WHERE text LIKE ? ESCAPE '\\'
					 ORDER BY datetime(captured_at) DESC, id DESC
					 LIMIT 50`,
				)
				.all(`%${escapeLike(q)}%`) as TrackRow[];

			return { query_id: inserted.id, results: rows.map(toSearchResult) };
		})
		.post(
			'/queries/:id/open',
			({ params, body, set }) => {
				const queryId = Number.parseInt(params.id, 10);
				if (!Number.isInteger(queryId) || queryId < 1) {
					set.status = 404;
					return { error: 'query not found' };
				}
				const payload = body as Record<string, unknown>;
				const trackId = payload.track_id;
				if (!Number.isInteger(trackId) || (trackId as number) < 1) {
					set.status = 400;
					return { error: 'invalid track_id' };
				}
				const queryRow = db.query('SELECT id FROM track_queries WHERE id = ?').get(queryId);
				if (!queryRow) {
					set.status = 404;
					return { error: 'query not found' };
				}
				const track = db.query('SELECT id FROM tracks WHERE id = ?').get(trackId as number);
				if (!track) {
					set.status = 404;
					return { error: 'track not found' };
				}
				db.prepare('UPDATE track_queries SET opened_track_id = ? WHERE id = ?').run(
					trackId as number,
					queryId,
				);
				return { ok: true };
			},
			{ params: t.Object({ id: t.String() }), body: t.Any() },
		);
