import { Elysia, t } from 'elysia';
import type { Database } from 'bun:sqlite';
import type { CaptureRow } from '../db/rows';
import { writeCaptureFile, refreshIndex } from '../search';
import { onCapture, emitCapture } from '../captureEvents';
import { parseCommand } from '../commands';
import { listArchiveInboxRows } from '../archives';

const VALID_TRIAGE_ACTIONS = new Set(['keep', 'archive', 'promote', 'task', 'skip']);
const MAX_CAPTURE_TEXT_LENGTH = 10_000;
const IMAGE_SUBQ =
	"(SELECT id FROM capture_attachments WHERE capture_id = captures.id AND content_type LIKE 'image/%' ORDER BY created_at ASC LIMIT 1) AS first_image_id";

interface CaptureCursor {
	v: 1;
	kind: 'captures';
	ingested_at: string;
	id: number;
}

function encodeCursor(row: Pick<CaptureRow, 'ingested_at' | 'id'>): string {
	return Buffer.from(
		JSON.stringify({ v: 1, kind: 'captures', ingested_at: row.ingested_at, id: row.id }),
	).toString('base64url');
}

function parseCursor(value: string | undefined): CaptureCursor | null | undefined {
	if (value === undefined) return undefined;
	if (!value) return null;
	try {
		const parsed = JSON.parse(
			Buffer.from(value, 'base64url').toString('utf8'),
		) as Partial<CaptureCursor>;
		if (
			parsed.v !== 1 ||
			parsed.kind !== 'captures' ||
			typeof parsed.ingested_at !== 'string' ||
			typeof parsed.id !== 'number' ||
			!Number.isInteger(parsed.id) ||
			parsed.id <= 0
		) {
			return null;
		}
		return parsed as CaptureCursor;
	} catch {
		return null;
	}
}

export const capturesRoutes = (db: Database) =>
	new Elysia()
		.get(
			'/api/inbox',
			({ query }) => {
				const raw = query.limit ? Number(query.limit) : 50;
				const limit = Math.min(Number.isFinite(raw) && raw > 0 ? raw : 50, 200);
				const captureRows = db
					.query(
						`SELECT id, text, source, captured_at, ingested_at, triaged_at, triage_action, ${IMAGE_SUBQ}
						 FROM captures WHERE triaged_at IS NULL ORDER BY ingested_at DESC, id DESC LIMIT ?`,
					)
					.all(limit) as CaptureRow[];
				const captureItems = captureRows.map((c) => ({
					item_type: 'capture',
					id: `capture:${c.id}`,
					capture_id: c.id,
					title: c.text,
					summary: c.text,
					source: c.source,
					created_at: c.ingested_at,
					capture: c,
					actions: [
						{ action: 'keep', label: 'Keep', shortcut: 'k', tone: 'primary' },
						{ action: 'archive', label: 'Archive', shortcut: 'a', tone: 'neutral' },
						{ action: 'promote', label: 'Promote', shortcut: 'p', tone: 'neutral' },
						{ action: 'task', label: 'Task', shortcut: 't', tone: 'neutral' },
						{ action: 'skip', label: 'Skip', shortcut: 'Space', tone: 'neutral' },
					],
				}));
				const archiveItems = listArchiveInboxRows(db, limit).map((a) => {
					const recent = a.quality === 'good';
					return {
						item_type: recent ? 'archive_recent' : 'archive_recapture',
						id: `archive:${a.id}`,
						archive_id: a.id,
						title: a.title ?? a.url,
						summary: recent
							? (a.why_saved ?? a.extracted_text.slice(0, 180))
							: `Capture looks ${a.quality} and may need desktop recapture.`,
						url: a.url,
						source: a.source,
						quality: a.quality,
						created_at: a.archived_at,
						actions: recent
							? [
									{ action: 'keep', label: 'Keep', shortcut: 'k', tone: 'primary' },
									{ action: 'archive', label: 'Archive', shortcut: 'a', tone: 'neutral' },
									{ action: 'recapture', label: 'Re-capture', shortcut: 'r', tone: 'neutral' },
									{ action: 'skip', label: 'Skip', shortcut: 'Space', tone: 'neutral' },
								]
							: [
									{ action: 'recapture', label: 'Re-capture', shortcut: 'r', tone: 'primary' },
									{ action: 'delete', label: 'Delete', shortcut: 'd', tone: 'destructive' },
									{ action: 'skip', label: 'Skip', shortcut: 'Space', tone: 'neutral' },
								],
					};
				});
				const items = [...captureItems, ...archiveItems]
					.sort((a, b) => b.created_at.localeCompare(a.created_at))
					.slice(0, limit);
				return { items, next_cursor: null };
			},
			{ query: t.Object({ limit: t.Optional(t.String()) }) },
		)
		.get(
			'/api/captures',
			({ query, set }) => {
				const raw = query.limit ? Number(query.limit) : 50;
				const limit = Math.min(Number.isFinite(raw) && raw > 0 ? raw : 50, 200);
				const all = query.all === '1';
				const cursor = parseCursor(query.cursor);
				if (cursor === null) {
					set.status = 400;
					return { error: 'Invalid cursor' };
				}

				const filters = [];
				const params: Array<string | number> = [];
				if (!all) filters.push('triaged_at IS NULL');
				if (cursor) {
					filters.push('(ingested_at < ? OR (ingested_at = ? AND id < ?))');
					params.push(cursor.ingested_at, cursor.ingested_at, cursor.id);
				}
				params.push(limit + 1);
				const where = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';
				const rows = db
					.query(
						`SELECT id, text, source, captured_at, ingested_at, triaged_at, triage_action, ${IMAGE_SUBQ} FROM captures ${where} ORDER BY ingested_at DESC, id DESC LIMIT ?`,
					)
					.all(...params) as CaptureRow[];
				const items = rows.slice(0, limit);
				return {
					items,
					next_cursor: rows.length > limit ? encodeCursor(items[items.length - 1]) : null,
				};
			},
			{
				query: t.Object({
					limit: t.Optional(t.String()),
					all: t.Optional(t.String()),
					cursor: t.Optional(t.String()),
				}),
			},
		)
		.get('/api/captures/stream', () => {
			const encoder = new TextEncoder();
			let off: (() => void) | null = null;
			let heartbeat: ReturnType<typeof setInterval> | null = null;
			const stream = new ReadableStream({
				start(controller) {
					controller.enqueue(encoder.encode(': connected\n\n'));
					// Keep-alive so Caddy's idle_timeout (default 5 min) doesn't silently drop the connection.
					heartbeat = setInterval(() => {
						try {
							controller.enqueue(encoder.encode(': ping\n\n'));
						} catch (e) {
							console.error('[sse] heartbeat enqueue failed:', e);
							clearInterval(heartbeat!);
							heartbeat = null;
							off?.();
							off = null;
						}
					}, 25_000);
					off = onCapture((capture) => {
						try {
							controller.enqueue(
								encoder.encode(`event: capture\ndata: ${JSON.stringify(capture)}\n\n`),
							);
						} catch (e) {
							// Controller closed if an emit races with stream teardown — cancel() hasn't removed the listener yet.
							if (heartbeat !== null) console.error('[sse] capture enqueue failed:', e);
							if (heartbeat !== null) {
								clearInterval(heartbeat);
								heartbeat = null;
							}
							off?.();
							off = null;
						}
					});
				},
				cancel() {
					if (heartbeat !== null) clearInterval(heartbeat);
					off?.();
				},
			});
			return new Response(stream, {
				headers: {
					'Content-Type': 'text/event-stream',
					'Cache-Control': 'no-cache',
				},
			});
		})
		.get(
			'/api/captures/:id',
			({ params, set }) => {
				const id = parseInt(params.id, 10);
				if (isNaN(id)) {
					set.status = 400;
					return { error: 'Invalid id' };
				}
				const row = db
					.query(
						`SELECT id, text, source, captured_at, ingested_at, triaged_at, triage_action, ${IMAGE_SUBQ} FROM captures WHERE id = ?`,
					)
					.get(id) as CaptureRow | null;
				if (!row) {
					set.status = 404;
					return { error: 'Not found' };
				}
				return row;
			},
			{ params: t.Object({ id: t.String() }) },
		)
		.post(
			'/api/captures/:id/triage',
			({ params, body, set }) => {
				const id = parseInt(params.id, 10);
				if (isNaN(id)) {
					set.status = 400;
					return { error: 'Invalid id' };
				}
				if (!VALID_TRIAGE_ACTIONS.has(body.action)) {
					set.status = 400;
					return { error: 'Invalid action' };
				}
				const result = db
					.prepare(
						'UPDATE captures SET triaged_at = ?, triage_action = ? WHERE id = ? RETURNING id',
					)
					.get(new Date().toISOString(), body.action, id) as { id: number } | null;
				if (!result) {
					set.status = 404;
					return { error: 'Not found' };
				}
				return {};
			},
			{
				params: t.Object({ id: t.String() }),
				body: t.Object({ action: t.String() }),
			},
		)
		.post(
			'/api/captures',
			({ body, set }) => {
				const text = body.text.trim();
				const source = body.source.trim();
				if (text.length === 0) {
					set.status = 422;
					return { error: 'Capture text is required' };
				}
				if (text.length > MAX_CAPTURE_TEXT_LENGTH) {
					set.status = 422;
					return { error: 'Capture text must be 10,000 characters or fewer' };
				}
				if (source.length === 0) {
					set.status = 422;
					return { error: 'Capture source is required' };
				}
				// Server-generated captured_at — clients (browser surface) can't forge
				// timestamps. Atomic INSERT + markdown write so an FS failure rolls
				// back the row (matches /api/agent/capture).
				const now = new Date().toISOString();
				const cmd = parseCommand(text);
				const storedText = cmd ? cmd.strippedText : text;
				const triagedAt = cmd ? now : null;
				const triagedAction = cmd ? cmd.action : null;
				const row = db.transaction(() => {
					const inserted = db
						.prepare(
							'INSERT INTO captures (text, source, captured_at, ingested_at, triaged_at, triage_action) VALUES (?, ?, ?, ?, ?, ?) RETURNING id',
						)
						.get(storedText, source, now, now, triagedAt, triagedAction) as { id: number };
					writeCaptureFile(inserted.id, storedText, source, now);
					return inserted;
				})();
				refreshIndex();
				emitCapture({
					id: row.id,
					text: storedText,
					source,
					captured_at: now,
					ingested_at: now,
					triaged_at: triagedAt,
					triage_action: triagedAction,
					task_due_date: null,
					task_priority: null,
					task_notes: null,
					task_completed_at: null,
					first_image_id: null,
				});
				return { id: row.id, triage_action: triagedAction, text: storedText };
			},
			{
				body: t.Object({
					text: t.String({ minLength: 1 }),
					source: t.String({ minLength: 1 }),
				}),
			},
		);
