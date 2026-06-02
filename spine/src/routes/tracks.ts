import { Elysia, t } from 'elysia';
import type { Database } from 'bun:sqlite';
import { existsSync, mkdirSync, realpathSync, unlinkSync, writeFileSync } from 'node:fs';
import { realpath } from 'node:fs/promises';
import { join, sep } from 'node:path';
import type {
	TrackBinCreateResponse,
	TrackBinRow,
	TrackBoardActionResponse,
	TrackBoardCard,
	TrackBoardResponse,
	TrackCreateResponse,
	TrackDetailResponse,
	TrackFollowUp,
	TrackPhoto,
	TrackPhotoCreateResponse,
	TrackQueryRow,
	TrackRow,
	TrackSearchResponse,
	TrackSearchResult,
} from '../db/rows';

export const FOLLOWUP_ELIGIBILITY_MS = 12 * 60 * 60 * 1000;
export const FOLLOWUP_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
export const DUPLICATE_HORIZON_MS = 90 * 24 * 60 * 60 * 1000;
export const MAX_PHOTO_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_PHOTO_MULTIPART_BYTES = MAX_PHOTO_UPLOAD_BYTES + 1024 * 1024;

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
const TRACK_COLUMNS =
	'id, text, captured_at, ingested_at, source, displaced, photo_ref, supersedes';
const SURFACE_SOURCES = new Set([
	'surface-manual',
	'surface-form',
	'surface-board',
	'surface-drag',
	'surface-followup',
]);
const PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export interface TracksRoutesOptions {
	attachmentsDir: string;
}

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
			`SELECT ${TRACK_COLUMNS} FROM tracks`,
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
	return db.prepare(`SELECT ${TRACK_COLUMNS} FROM tracks WHERE id = ?`).get(id) as TrackRow | null;
}

function normalizeBinName(value: string): string {
	return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function stripCheckoutPrefix(text: string): string {
	return text.replace(/^\s*item\s+checked\s+out\s*:\s*/i, '').trim() || text.trim();
}

function itemPhrase(text: string): string {
	const cleaned = stripCheckoutPrefix(text);
	const checkout = cleaned.match(/^(.+?)\s+checked\s+out\s*:/i);
	if (checkout?.[1]) return checkout[1].trim();
	const match = cleaned.match(/^(.+?)\s+(?:is\s+)?(?:in|inside|on|at|under|near)\s+(.+)$/i);
	return (match?.[1] ?? cleaned).trim();
}

function locationPhrase(text: string): string | null {
	const match = stripCheckoutPrefix(text).match(
		/^(.+?)\s+(?:is\s+)?(?:in|inside|on|at|under|near)\s+(.+)$/i,
	);
	return match?.[2]?.trim() ?? null;
}

function itemKeyFor(text: string): string {
	return itemPhrase(text)
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ' ')
		.trim()
		.replace(/\s+/g, '-');
}

function validateSurfaceTrack(
	db: Database,
	payload: Record<string, unknown>,
	set: { status?: number | string },
):
	| {
			text: string;
			capturedAt: string;
			source: string;
			displaced: boolean;
			photoRef: string | null;
			supersedes: number | null;
	  }
	| { error: string } {
	const text = typeof payload.text === 'string' ? payload.text.trim() : '';
	const source = typeof payload.source === 'string' ? payload.source.trim() : '';
	const capturedAt = typeof payload.captured_at === 'string' ? payload.captured_at.trim() : '';
	if (!text) {
		set.status = 400;
		return { error: 'text is required' };
	}
	if (!SURFACE_SOURCES.has(source)) {
		set.status = 400;
		return { error: 'source must be a documented surface source' };
	}
	if (!capturedAt || Number.isNaN(Date.parse(capturedAt))) {
		set.status = 400;
		return { error: 'captured_at is required' };
	}
	if (typeof payload.displaced !== 'boolean') {
		set.status = 400;
		return { error: 'displaced must be boolean' };
	}
	const photoRef =
		typeof payload.photo_ref === 'string' && payload.photo_ref.trim()
			? payload.photo_ref.trim()
			: null;
	if (photoRef && !db.prepare('SELECT ref FROM track_photos WHERE ref = ?').get(photoRef)) {
		set.status = 400;
		return { error: 'photo_ref not found' };
	}
	const supersedes = Number.isInteger(payload.supersedes) ? (payload.supersedes as number) : null;
	if (supersedes !== null && !trackById(db, supersedes)) {
		set.status = 400;
		return { error: 'supersedes track not found' };
	}
	return {
		text,
		capturedAt,
		source,
		displaced: payload.displaced as boolean,
		photoRef,
		supersedes,
	};
}

function insertSurfaceTrack(
	db: Database,
	input: {
		text: string;
		capturedAt: string;
		source: string;
		displaced: boolean;
		photoRef: string | null;
		supersedes: number | null;
	},
): { id: number } {
	return db
		.prepare(
			`INSERT INTO tracks (text, captured_at, ingested_at, source, displaced, photo_ref, supersedes)
			 VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
		)
		.get(
			input.text,
			input.capturedAt,
			new Date().toISOString(),
			input.source,
			input.displaced ? 1 : 0,
			input.photoRef,
			input.supersedes,
		) as { id: number };
}

function duplicateHints(db: Database, text: string): TrackCreateResponse['possible_duplicates'] {
	const tokens = tokenizeTrackText(text);
	if (tokens.length === 0) return [];
	return rankedRows(db, text, 5).map((row) => ({
		track_id: row.id,
		text: row.text,
		captured_at: row.captured_at,
		source: row.source,
		displaced: row.displaced === 1,
		reason: 'similar wording',
	}));
}

function detailResponse(db: Database, row: TrackRow): TrackDetailResponse {
	const key = itemKeyFor(row.text);
	const location = locationPhrase(row.text);
	const all = db
		.prepare(`SELECT ${TRACK_COLUMNS} FROM tracks WHERE id != ?`)
		.all(row.id) as TrackRow[];
	return {
		record: toTrackSearchResult(row),
		same_item_history: all
			.filter((candidate) => itemKeyFor(candidate.text) === key)
			.sort((a, b) => Date.parse(b.captured_at) - Date.parse(a.captured_at) || b.id - a.id)
			.map(toTrackSearchResult),
		related_location_tracks: location
			? rankedRows(db, location, 12)
					.filter((candidate) => candidate.id !== row.id && itemKeyFor(candidate.text) !== key)
					.map(toTrackSearchResult)
			: [],
	};
}

function currentBoardCards(db: Database, displacedFilter: 'all' | 'only'): TrackBoardResponse {
	const bins = db
		.prepare(
			'SELECT id, name, normalized_name, created_at, updated_at, archived_at FROM track_bins WHERE archived_at IS NULL ORDER BY name ASC',
		)
		.all() as TrackBinRow[];
	const binsByName = new Map(bins.map((bin) => [bin.normalized_name, bin]));
	const rows = (
		db
			.prepare(`SELECT ${TRACK_COLUMNS} FROM tracks ORDER BY datetime(captured_at) DESC, id DESC`)
			.all() as TrackRow[]
	).filter(
		(row, index, all) =>
			all.findIndex((candidate) => itemKeyFor(candidate.text) === itemKeyFor(row.text)) === index,
	);
	const cards: TrackBoardCard[] = rows.map((row) => {
		const location = locationPhrase(row.text);
		const bin = location ? (binsByName.get(normalizeBinName(location)) ?? null) : null;
		return {
			item_key: itemKeyFor(row.text),
			item_phrase: itemPhrase(row.text),
			current_track: toTrackSearchResult(row),
			bin_id: bin?.id ?? null,
			bin_name: bin?.name ?? null,
			location_label: location,
			displaced: row.displaced === 1,
			possible_duplicates: [],
		};
	});
	const visible = displacedFilter === 'only' ? cards.filter((card) => card.displaced) : cards;
	return {
		bins,
		cards: visible.filter((card) => card.bin_id !== null),
		unbinned: visible.filter((card) => card.bin_id === null),
		displaced_count: cards.filter((card) => card.displaced).length,
	};
}

function createPhotoHelpers(attachmentsDir: string) {
	const photosDir = join(attachmentsDir, 'tracks');
	mkdirSync(photosDir, { recursive: true });
	let canonicalBase: string;
	try {
		canonicalBase = realpathSync(photosDir);
	} catch {
		canonicalBase = photosDir;
	}
	return { photosDir, canonicalBase };
}

function safePhotoFilename(name: string): string {
	return (name || 'upload').replace(/[^a-zA-Z0-9._-]/g, '_');
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

export const tracksRoutes = (db: Database, { attachmentsDir }: TracksRoutesOptions) => {
	const { photosDir, canonicalBase } = createPhotoHelpers(attachmentsDir);

	return new Elysia({ prefix: '/api/tracks' })
		.post(
			'/',
			({ body, set }): TrackCreateResponse | { error: string } => {
				const payload = body as Record<string, unknown>;
				const validated = validateSurfaceTrack(db, payload, set);
				if ('error' in validated) return validated;
				const possible_duplicates = duplicateHints(db, validated.text);
				const inserted = insertSurfaceTrack(db, validated);
				set.status = 201;
				return { id: inserted.id, possible_duplicates };
			},
			{ body: t.Any() },
		)
		.get(
			'/:id',
			({ params, set }): TrackDetailResponse | { error: string } => {
				const id = Number.parseInt(params.id, 10);
				if (!Number.isInteger(id) || id < 1) {
					set.status = 404;
					return { error: 'track not found' };
				}
				const track = trackById(db, id);
				if (!track) {
					set.status = 404;
					return { error: 'track not found' };
				}
				return detailResponse(db, track);
			},
			{ params: t.Object({ id: t.String() }) },
		)
		.post(
			'/photos',
			async ({ request, set }): Promise<TrackPhotoCreateResponse | { error: string }> => {
				const contentLength = Number.parseInt(request.headers.get('content-length') ?? '', 10);
				if (Number.isFinite(contentLength) && contentLength > MAX_PHOTO_MULTIPART_BYTES) {
					set.status = 413;
					return { error: 'image is too large' };
				}
				let formData: FormData;
				try {
					formData = await request.formData();
				} catch {
					set.status = 400;
					return { error: 'invalid multipart body' };
				}
				const file = formData.get('file');
				if (!(file instanceof File)) {
					set.status = 400;
					return { error: 'file is required' };
				}
				const contentType = file.type || 'application/octet-stream';
				if (!PHOTO_TYPES.has(contentType)) {
					set.status = 415;
					return { error: 'unsupported image type' };
				}
				if (file.size > MAX_PHOTO_UPLOAD_BYTES) {
					set.status = 413;
					return { error: 'image is too large' };
				}
				const bytes = Buffer.from(await file.arrayBuffer());
				if (bytes.length > MAX_PHOTO_UPLOAD_BYTES) {
					set.status = 413;
					return { error: 'image is too large' };
				}
				const now = new Date().toISOString();
				const ref = `track-photo-${crypto.randomUUID()}`;
				const filename = safePhotoFilename(file.name);
				const storedPath = `tracks/${ref}`;
				const photoPath = join(photosDir, ref);
				writeFileSync(photoPath, bytes);
				try {
					db.prepare(
						`INSERT INTO track_photos (ref, filename, content_type, size_bytes, stored_path, created_at)
					 VALUES (?, ?, ?, ?, ?, ?)`,
					).run(ref, filename, contentType, bytes.length, storedPath, now);
				} catch (e) {
					try {
						unlinkSync(photoPath);
					} catch {
						// Best effort cleanup; preserve the original database error for the caller.
					}
					throw e;
				}
				set.status = 201;
				return {
					ref,
					filename,
					content_type: contentType,
					size_bytes: bytes.length,
					url: `/api/tracks/photos/${ref}/raw`,
				};
			},
		)
		.get(
			'/photos/:ref/raw',
			async ({ params, set }) => {
				const row = db
					.prepare(
						'SELECT ref, filename, content_type, size_bytes, stored_path, created_at FROM track_photos WHERE ref = ?',
					)
					.get(params.ref) as TrackPhoto | null;
				if (!row) {
					set.status = 404;
					return 'Not found';
				}
				const fullPath = join(attachmentsDir, row.stored_path);
				let resolved: string;
				try {
					resolved = await realpath(fullPath);
				} catch (e) {
					const code = (e as NodeJS.ErrnoException).code;
					set.status = code === 'ENOENT' ? 404 : code === 'ELOOP' ? 403 : 500;
					return code === 'ENOENT'
						? 'File not found on disk'
						: code === 'ELOOP'
							? 'Forbidden'
							: 'Internal error';
				}
				if (!resolved.startsWith(canonicalBase + sep) && resolved !== canonicalBase) {
					set.status = 403;
					return 'Forbidden';
				}
				if (!existsSync(resolved)) {
					set.status = 404;
					return 'File not found on disk';
				}
				return new Response(Bun.file(resolved), {
					headers: {
						'Content-Type': row.content_type,
						'Content-Disposition': `inline; filename="${safePhotoFilename(row.filename)}"`,
						'X-Content-Type-Options': 'nosniff',
					},
				});
			},
			{ params: t.Object({ ref: t.String() }) },
		)
		.get('/board', ({ query }): TrackBoardResponse => {
			const displaced = query.displaced === 'only' ? 'only' : 'all';
			return currentBoardCards(db, displaced);
		})
		.post(
			'/bins',
			({ body, set }): TrackBinCreateResponse | { error: string; bin?: TrackBinRow } => {
				const payload = body as Record<string, unknown>;
				const name = typeof payload.name === 'string' ? payload.name.trim() : '';
				if (!name) {
					set.status = 400;
					return { error: 'name is required' };
				}
				const normalized = normalizeBinName(name);
				const existing = db
					.prepare(
						'SELECT id, name, normalized_name, created_at, updated_at, archived_at FROM track_bins WHERE normalized_name = ? AND archived_at IS NULL',
					)
					.get(normalized) as TrackBinRow | null;
				if (existing) {
					set.status = 409;
					return { error: 'bin already exists', bin: existing };
				}
				const now = new Date().toISOString();
				const bin = db
					.prepare(
						`INSERT INTO track_bins (name, normalized_name, created_at, updated_at)
						 VALUES (?, ?, ?, ?) RETURNING id, name, normalized_name, created_at, updated_at, archived_at`,
					)
					.get(name, normalized, now, now) as TrackBinRow;
				set.status = 201;
				return { bin };
			},
			{ body: t.Any() },
		)
		.post(
			'/board/move',
			({ body, set }): TrackBoardActionResponse | { error: string } => {
				const payload = body as Record<string, unknown>;
				const itemPhraseValue =
					typeof payload.item_phrase === 'string' ? payload.item_phrase.trim() : '';
				const fromTrackId = Number.isInteger(payload.from_track_id)
					? (payload.from_track_id as number)
					: 0;
				const toBinId = Number.isInteger(payload.to_bin_id) ? (payload.to_bin_id as number) : 0;
				const source = typeof payload.source === 'string' ? payload.source.trim() : 'surface-board';
				const capturedAt =
					typeof payload.captured_at === 'string'
						? payload.captured_at.trim()
						: new Date().toISOString();
				const bin = db
					.prepare('SELECT id, name FROM track_bins WHERE id = ? AND archived_at IS NULL')
					.get(toBinId) as { id: number; name: string } | null;
				if (!itemPhraseValue || !fromTrackId || !bin) {
					set.status = 400;
					return { error: 'item phrase, source track, and destination bin are required' };
				}
				const validated = validateSurfaceTrack(
					db,
					{
						text: `${itemPhraseValue} in ${bin.name}`,
						captured_at: capturedAt,
						source,
						displaced: false,
						supersedes: fromTrackId,
					},
					set,
				);
				if ('error' in validated) return validated;
				const inserted = insertSurfaceTrack(db, validated);
				set.status = 201;
				return {
					track_id: inserted.id,
					text: validated.text,
					displaced: false,
					supersedes: fromTrackId,
				};
			},
			{ body: t.Any() },
		)
		.post(
			'/board/checkout',
			({ body, set }): TrackBoardActionResponse | { error: string } => {
				const payload = body as Record<string, unknown>;
				const itemPhraseValue =
					typeof payload.item_phrase === 'string' ? payload.item_phrase.trim() : '';
				const context =
					typeof payload.context === 'string' && payload.context.trim()
						? payload.context.trim()
						: itemPhraseValue;
				const fromTrackId = Number.isInteger(payload.from_track_id)
					? (payload.from_track_id as number)
					: 0;
				const capturedAt =
					typeof payload.captured_at === 'string'
						? payload.captured_at.trim()
						: new Date().toISOString();
				if (!itemPhraseValue || !fromTrackId) {
					set.status = 400;
					return { error: 'item phrase and source track are required' };
				}
				const text = `${itemPhraseValue} checked out: ${context}`;
				const validated = validateSurfaceTrack(
					db,
					{
						text,
						captured_at: capturedAt,
						source: 'surface-board',
						displaced: true,
						supersedes: fromTrackId,
					},
					set,
				);
				if ('error' in validated) return validated;
				const inserted = insertSurfaceTrack(db, validated);
				set.status = 201;
				return { track_id: inserted.id, text, displaced: true, supersedes: fromTrackId };
			},
			{ body: t.Any() },
		)
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
};
