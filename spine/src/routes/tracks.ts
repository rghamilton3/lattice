import { Elysia, t } from 'elysia';
import type { Database } from 'bun:sqlite';
import type {
	TrackFollowUp,
	TrackQueryRow,
	TrackRow,
	TrackSearchResponse,
	TrackSearchResult,
} from '../db/rows';

export const FOLLOWUP_ELIGIBILITY_MS = 12 * 60 * 60 * 1000;
export const FOLLOWUP_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
export const DUPLICATE_HORIZON_MS = 90 * 24 * 60 * 60 * 1000;

const STOP_WORDS = new Set([
	'a',
	'an',
	'and',
	'are',
	'as',
	'at',
	'be',
	'for',
	'from',
	'here',
	'how',
	'in',
	'is',
	'it',
	'its',
	'now',
	'of',
	'on',
	'or',
	'the',
	'there',
	'to',
	'was',
	'where',
	'with',
]);

const TRACK_QUERY_COLUMNS = 'id, query, queried_at, opened_track_id, loop_closed_at, loop_outcome';

export function tokenizeTrackText(value: string): string[] {
	return [...new Set(value.toLowerCase().match(/[a-z0-9]+/g) ?? [])].filter(
		(token) => token.length > 1 && !STOP_WORDS.has(token),
	);
}

export function scoreTrackMatch(queryTokens: string[], text: string): number {
	const textTokens = new Set(tokenizeTrackText(text));
	let score = 0;
	for (const token of queryTokens) {
		if (textTokens.has(token)) score += 2;
		else if (
			[...textTokens].some((textToken) => textToken.includes(token) || token.includes(textToken))
		) {
			score += 1;
		}
	}
	return score;
}

export function toTrackSearchResult(row: TrackRow): TrackSearchResult {
	return { ...row, displaced: row.displaced === 1 };
}

export function sharedMatchTokens(left: string, right: string): string[] {
	const rightTokens = new Set(tokenizeTrackText(right));
	return tokenizeTrackText(left).filter((token) => rightTokens.has(token));
}

function compareTrackRows(
	a: { row: TrackRow; score: number },
	b: { row: TrackRow; score: number },
) {
	if (b.score !== a.score) return b.score - a.score;
	const timeDiff = Date.parse(b.row.captured_at) - Date.parse(a.row.captured_at);
	if (timeDiff !== 0) return timeDiff;
	return b.row.id - a.row.id;
}

function rankedRows(db: Database, queryText: string, limit = 50): TrackRow[] {
	const tokens = tokenizeTrackText(queryText);
	if (tokens.length === 0) return [];
	const rows = db
		.prepare(
			// TODO: Introduce a SQL prefilter or FTS5 once track volume makes full scoring visible.
			'SELECT id, text, captured_at, ingested_at, source, displaced, photo_ref, supersedes FROM tracks',
		)
		.all() as TrackRow[];
	return rows
		.map((row) => ({ row, score: scoreTrackMatch(tokens, row.text) }))
		.filter((match) => match.score > 0)
		.sort(compareTrackRows)
		.slice(0, limit)
		.map((match) => match.row);
}

function trackById(db: Database, id: number): TrackRow | null {
	return db
		.prepare(
			'SELECT id, text, captured_at, ingested_at, source, displaced, photo_ref, supersedes FROM tracks WHERE id = ?',
		)
		.get(id) as TrackRow | null;
}

function expireOldFollowups(db: Database, now: Date) {
	db.prepare(
		`UPDATE track_queries
		 SET loop_closed_at = ?, loop_outcome = 'expired'
		 WHERE opened_track_id IS NOT NULL
		   AND loop_closed_at IS NULL
		   AND datetime(queried_at) <= datetime(?)`,
	).run(now.toISOString(), new Date(now.getTime() - FOLLOWUP_WINDOW_MS).toISOString());
}

function hasNewerMatchingTrack(db: Database, query: TrackQueryRow, openedTrack: TrackRow): boolean {
	const queryTokens = tokenizeTrackText(query.query);
	if (queryTokens.length === 0) return false;
	const newerRows = db
		.prepare(
			// TODO: Prefilter candidate rows before JS scoring if follow-up checks become hot.
			`SELECT id, text, captured_at, ingested_at, source, displaced, photo_ref, supersedes
			 FROM tracks
			 WHERE id != ?
			   AND (datetime(captured_at) > datetime(?) OR datetime(ingested_at) > datetime(?))`,
		)
		.all(openedTrack.id, query.queried_at, query.queried_at) as TrackRow[];
	return newerRows.some((row) => scoreTrackMatch(queryTokens, row.text) > 0);
}

function followupForQuery(db: Database, query: TrackQueryRow, now: Date): TrackFollowUp | null {
	if (!query.opened_track_id || query.loop_closed_at) return null;
	const queriedAt = Date.parse(query.queried_at);
	if (Number.isNaN(queriedAt)) return null;
	if (queriedAt > now.getTime() - FOLLOWUP_ELIGIBILITY_MS) return null;
	if (queriedAt <= now.getTime() - FOLLOWUP_WINDOW_MS) return null;
	const openedTrack = trackById(db, query.opened_track_id);
	if (!openedTrack) return null;
	if (hasNewerMatchingTrack(db, query, openedTrack)) return null;
	return {
		query_id: query.id,
		query: query.query,
		queried_at: query.queried_at,
		expires_at: new Date(queriedAt + FOLLOWUP_WINDOW_MS).toISOString(),
		opened_track: toTrackSearchResult(openedTrack),
		affirmative_label: openedTrack.displaced === 1 ? 'Still out' : 'Still there',
	};
}

function requirePendingFollowup(db: Database, queryId: number, set: { status?: number | string }) {
	const query = db
		.prepare(`SELECT ${TRACK_QUERY_COLUMNS} FROM track_queries WHERE id = ?`)
		.get(queryId) as TrackQueryRow | null;
	if (!query) {
		set.status = 404;
		return { error: 'query not found' } as const;
	}
	if (!query.opened_track_id) {
		set.status = 409;
		return { error: 'query was not opened' } as const;
	}
	if (query.loop_closed_at) {
		set.status = 409;
		return { error: 'follow-up is closed' } as const;
	}
	const now = new Date();
	expireOldFollowups(db, now);
	const refreshed = db
		.prepare(`SELECT ${TRACK_QUERY_COLUMNS} FROM track_queries WHERE id = ?`)
		.get(queryId) as TrackQueryRow;
	const followup = followupForQuery(db, refreshed, now);
	if (!followup) {
		set.status = 409;
		return { error: 'follow-up is not pending' } as const;
	}
	return { query: refreshed, followup };
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
			const results = rankedRows(db, q).map(toTrackSearchResult);
			const primary = results[0] ?? null;
			const history = primary ? results.slice(1) : results;

			return {
				query_id: inserted.id,
				primary,
				history,
				empty_message: primary ? null : 'No matching tracks found.',
				results,
			};
		})
		.get('/followups', () => {
			const now = new Date();
			expireOldFollowups(db, now);
			const queries = db
				.prepare(
					`SELECT id, query, queried_at, opened_track_id, loop_closed_at, loop_outcome
					 FROM track_queries
					 WHERE opened_track_id IS NOT NULL
					   AND loop_closed_at IS NULL
					 ORDER BY datetime(queried_at) DESC, id DESC`,
				)
				.all() as TrackQueryRow[];
			return { followups: queries.map((row) => followupForQuery(db, row, now)).filter(Boolean) };
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
				const queryRow = db
					.query('SELECT id, opened_track_id FROM track_queries WHERE id = ?')
					.get(queryId) as { id: number; opened_track_id: number | null } | null;
				if (!queryRow) {
					set.status = 404;
					return { error: 'query not found' };
				}
				if (queryRow.opened_track_id) {
					set.status = 409;
					return { error: 'query was already opened' };
				}
				const track = db.query('SELECT id FROM tracks WHERE id = ?').get(trackId as number);
				if (!track) {
					set.status = 404;
					return { error: 'track not found' };
				}
				db.prepare(
					'UPDATE track_queries SET opened_track_id = ? WHERE id = ? AND opened_track_id IS NULL',
				).run(trackId as number, queryId);
				return { ok: true };
			},
			{ params: t.Object({ id: t.String() }), body: t.Any() },
		)
		.post(
			'/followups/:query_id/still-accurate',
			({ params, set }) => {
				const queryId = Number.parseInt(params.query_id, 10);
				if (!Number.isInteger(queryId) || queryId < 1) {
					set.status = 404;
					return { error: 'query not found' };
				}
				const pending = requirePendingFollowup(db, queryId, set);
				if ('error' in pending) return pending;
				db.prepare(
					"UPDATE track_queries SET loop_closed_at = ?, loop_outcome = 'still_accurate' WHERE id = ?",
				).run(new Date().toISOString(), queryId);
				return { ok: true, outcome: 'still_accurate' };
			},
			{ params: t.Object({ query_id: t.String() }) },
		)
		.post(
			'/followups/:query_id/moved',
			({ params, body, set }) => {
				const queryId = Number.parseInt(params.query_id, 10);
				if (!Number.isInteger(queryId) || queryId < 1) {
					set.status = 404;
					return { error: 'query not found' };
				}
				const payload = body as Record<string, unknown>;
				const text = typeof payload.text === 'string' ? payload.text.trim() : '';
				const source = typeof payload.source === 'string' ? payload.source.trim() : '';
				const capturedAt =
					typeof payload.captured_at === 'string' ? payload.captured_at.trim() : '';
				if (!text) {
					set.status = 400;
					return { error: 'text is required' };
				}
				if (!source) {
					set.status = 400;
					return { error: 'source is required' };
				}
				if (!capturedAt || Number.isNaN(Date.parse(capturedAt))) {
					set.status = 400;
					return { error: 'captured_at is required' };
				}
				if (typeof payload.displaced !== 'boolean') {
					set.status = 400;
					return { error: 'displaced must be boolean' };
				}
				const pending = requirePendingFollowup(db, queryId, set);
				if ('error' in pending) return pending;
				const photoRef =
					typeof payload.photo_ref === 'string' && payload.photo_ref.trim()
						? payload.photo_ref.trim()
						: null;
				const inserted = db.transaction(() => {
					const row = db
						.prepare(
							`INSERT INTO tracks
							 (text, captured_at, ingested_at, source, displaced, photo_ref, supersedes)
							 VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
						)
						.get(
							text,
							capturedAt,
							new Date().toISOString(),
							source,
							payload.displaced ? 1 : 0,
							photoRef,
							pending.query.opened_track_id,
						) as { id: number };
					db.prepare(
						"UPDATE track_queries SET loop_closed_at = ?, loop_outcome = 'moved' WHERE id = ?",
					).run(new Date().toISOString(), queryId);
					return row;
				})();
				set.status = 201;
				return { ok: true, outcome: 'moved', track_id: inserted.id };
			},
			{ params: t.Object({ query_id: t.String() }), body: t.Any() },
		)
		.post(
			'/followups/:query_id/skip',
			({ params, set }) => {
				const queryId = Number.parseInt(params.query_id, 10);
				if (!Number.isInteger(queryId) || queryId < 1) {
					set.status = 404;
					return { error: 'query not found' };
				}
				const pending = requirePendingFollowup(db, queryId, set);
				if ('error' in pending) return pending;
				db.prepare(
					"UPDATE track_queries SET loop_closed_at = ?, loop_outcome = 'skipped' WHERE id = ?",
				).run(new Date().toISOString(), queryId);
				return { ok: true, outcome: 'skipped' };
			},
			{ params: t.Object({ query_id: t.String() }) },
		);
