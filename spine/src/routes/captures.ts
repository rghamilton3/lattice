import { Elysia, t } from 'elysia';
import type { Database } from 'bun:sqlite';
import type { CaptureRow } from '../db/rows';
import { writeCaptureFile, refreshIndex } from '../search';
import { onCapture, emitCapture } from '../captureEvents';
import { parseCommand } from '../commands';

const VALID_TRIAGE_ACTIONS = new Set(['keep', 'archive', 'promote', 'task', 'skip']);

export const capturesRoutes = (db: Database) =>
	new Elysia()
		.get(
			'/api/captures',
			({ query }) => {
				const raw = query.limit ? Number(query.limit) : 50;
				const limit = Math.min(Number.isFinite(raw) && raw > 0 ? raw : 50, 200);
				const all = query.all === '1';
				const sql = all
					? 'SELECT id, text, source, captured_at, ingested_at, triaged_at, triage_action FROM captures ORDER BY ingested_at DESC LIMIT ?'
					: 'SELECT id, text, source, captured_at, ingested_at, triaged_at, triage_action FROM captures WHERE triaged_at IS NULL ORDER BY ingested_at DESC LIMIT ?';
				return db.query(sql).all(limit) as CaptureRow[];
			},
			{ query: t.Object({ limit: t.Optional(t.String()), all: t.Optional(t.String()) }) },
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
						'SELECT id, text, source, captured_at, ingested_at, triaged_at, triage_action FROM captures WHERE id = ?',
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
			({ body }) => {
				// Server-generated captured_at — clients (browser surface) can't forge
				// timestamps. Atomic INSERT + markdown write so an FS failure rolls
				// back the row (matches /api/agent/capture).
				const now = new Date().toISOString();
				const cmd = parseCommand(body.text);
				const storedText = cmd ? cmd.strippedText : body.text;
				const triagedAt = cmd ? now : null;
				const triagedAction = cmd ? cmd.action : null;
				const row = db.transaction(() => {
					const inserted = db
						.prepare(
							'INSERT INTO captures (text, source, captured_at, ingested_at, triaged_at, triage_action) VALUES (?, ?, ?, ?, ?, ?) RETURNING id',
						)
						.get(storedText, body.source, now, now, triagedAt, triagedAction) as { id: number };
					writeCaptureFile(inserted.id, storedText, body.source, now);
					return inserted;
				})();
				refreshIndex();
				emitCapture({
					id: row.id,
					text: storedText,
					source: body.source,
					captured_at: now,
					ingested_at: now,
					triaged_at: triagedAt,
					triage_action: triagedAction,
					task_due_date: null,
					task_priority: null,
					task_notes: null,
					task_completed_at: null,
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
