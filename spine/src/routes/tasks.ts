import { Elysia, t } from 'elysia';
import type { Database } from 'bun:sqlite';
import { existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import type { CaptureRow } from '../db/rows';
import { writeCaptureFile, deleteCaptureFile, attachmentsMdDir, refreshIndex } from '../search';

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };
const MAX_TASK_TEXT_LENGTH = 10_000;

const TASK_SELECT =
	'SELECT id, text, source, captured_at, ingested_at, triaged_at, triage_action, task_due_date, task_priority, task_notes, task_completed_at FROM captures';

function sortActive(rows: CaptureRow[]): CaptureRow[] {
	return rows.sort((a, b) => {
		if (a.task_due_date !== b.task_due_date) {
			if (!a.task_due_date) return 1;
			if (!b.task_due_date) return -1;
			return a.task_due_date < b.task_due_date ? -1 : 1;
		}
		const pa = a.task_priority != null ? (PRIORITY_ORDER[a.task_priority] ?? 3) : 3;
		const pb = b.task_priority != null ? (PRIORITY_ORDER[b.task_priority] ?? 3) : 3;
		if (pa !== pb) return pa - pb;
		if (a.captured_at !== b.captured_at) return b.captured_at < a.captured_at ? -1 : 1;
		return b.id - a.id;
	});
}

export interface TasksRoutesOptions {
	attachmentsDir: string;
}

export const tasksRoutes = (db: Database, { attachmentsDir }: TasksRoutesOptions) =>
	new Elysia()
		.get('/api/tasks', () => {
			const rows = db
				.query(
					`${TASK_SELECT} WHERE triage_action = 'task' AND task_completed_at IS NULL ORDER BY captured_at DESC`,
				)
				.all() as CaptureRow[];
			return sortActive(rows);
		})
		.get('/api/tasks/done', () => {
			return db
				.query(
					`${TASK_SELECT} WHERE triage_action = 'task' AND task_completed_at IS NOT NULL ORDER BY task_completed_at DESC`,
				)
				.all() as CaptureRow[];
		})
		.post(
			'/api/tasks',
			({ body, set }) => {
				const text = body.text.trim();
				if (text.length === 0) {
					set.status = 422;
					return { error: 'Task text is required' };
				}
				if (text.length > MAX_TASK_TEXT_LENGTH) {
					set.status = 422;
					return { error: 'Task text must be 10,000 characters or fewer' };
				}
				const now = new Date().toISOString();
				const row = db.transaction(() => {
					const inserted = db
						.prepare(
							`INSERT INTO captures
								(text, source, captured_at, ingested_at, triaged_at, triage_action, task_due_date, task_priority, task_notes)
							VALUES (?, 'task', ?, ?, ?, 'task', ?, ?, ?)
							RETURNING id`,
						)
						.get(
							text,
							now,
							now,
							now,
							body.due_date ?? null,
							body.priority ?? null,
							body.notes?.trim() || null,
						) as { id: number };
					writeCaptureFile(inserted.id, text, 'task', now);
					return inserted;
				})();
				refreshIndex();
				return { id: row.id };
			},
			{
				body: t.Object({
					text: t.String({ minLength: 1 }),
					due_date: t.Optional(t.String()),
					priority: t.Optional(t.Union([t.Literal('high'), t.Literal('medium'), t.Literal('low')])),
					notes: t.Optional(t.String()),
				}),
			},
		)
		.patch(
			'/api/captures/:id/task',
			({ params, body, set }) => {
				const id = parseInt(params.id, 10);
				if (isNaN(id)) {
					set.status = 400;
					return { error: 'Invalid id' };
				}

				if (body.text !== undefined) {
					const newText = body.text.trim();
					if (newText.length === 0) {
						set.status = 422;
						return { error: 'Task text is required' };
					}
					if (newText.length > MAX_TASK_TEXT_LENGTH) {
						set.status = 422;
						return { error: 'Task text must be 10,000 characters or fewer' };
					}
				}

				const result = db
					.prepare(
						`UPDATE captures
						SET task_due_date = ?, task_priority = ?, task_notes = ?, text = COALESCE(?, text)
						WHERE id = ? AND triage_action = 'task'
						RETURNING id, text, captured_at`,
					)
					.get(
						body.due_date ?? null,
						body.priority ?? null,
						body.notes ?? null,
						body.text !== undefined ? body.text.trim() : null,
						id,
					) as { id: number; text: string; captured_at: string } | null;

				if (!result) {
					set.status = 404;
					return { error: 'Not found' };
				}

				if (body.text !== undefined) {
					try {
						writeCaptureFile(result.id, result.text, 'task', result.captured_at);
					} catch (e) {
						console.warn(`[tasks] failed to write capture file ${result.id}:`, e);
					}
					refreshIndex();
				}

				return {};
			},
			{
				params: t.Object({ id: t.String() }),
				body: t.Object({
					text: t.Optional(t.String()),
					due_date: t.Optional(t.Nullable(t.String())),
					priority: t.Optional(
						t.Nullable(t.Union([t.Literal('high'), t.Literal('medium'), t.Literal('low')])),
					),
					notes: t.Optional(t.Nullable(t.String())),
				}),
			},
		)
		.patch(
			'/api/tasks/:id/complete',
			({ params, set }) => {
				const id = parseInt(params.id, 10);
				if (isNaN(id)) {
					set.status = 400;
					return { error: 'Invalid id' };
				}
				const result = db
					.prepare(
						`UPDATE captures SET task_completed_at = ? WHERE id = ? AND triage_action = 'task' RETURNING id`,
					)
					.get(new Date().toISOString(), id) as { id: number } | null;
				if (!result) {
					set.status = 404;
					return { error: 'Not found' };
				}
				return {};
			},
			{ params: t.Object({ id: t.String() }) },
		)
		.patch(
			'/api/tasks/:id/uncomplete',
			({ params, set }) => {
				const id = parseInt(params.id, 10);
				if (isNaN(id)) {
					set.status = 400;
					return { error: 'Invalid id' };
				}
				const result = db
					.prepare(
						`UPDATE captures SET task_completed_at = NULL WHERE id = ? AND triage_action = 'task' RETURNING id`,
					)
					.get(id) as { id: number } | null;
				if (!result) {
					set.status = 404;
					return { error: 'Not found' };
				}
				return {};
			},
			{ params: t.Object({ id: t.String() }) },
		)
		.delete(
			'/api/tasks/:id',
			({ params, set }) => {
				const id = parseInt(params.id, 10);
				if (isNaN(id)) {
					set.status = 400;
					return { error: 'Invalid id' };
				}

				const txResult = db.transaction(() => {
					const check = db
						.prepare(`SELECT id FROM captures WHERE id = ? AND triage_action = 'task'`)
						.get(id) as { id: number } | null;
					if (!check) return null;
					const atts = db
						.query('SELECT id, stored_path FROM capture_attachments WHERE capture_id = ?')
						.all(id) as { id: number; stored_path: string }[];
					// Audio transcripts and image descriptions die with the capture (NF-4).
					for (const att of atts) {
						db.prepare(
							`DELETE FROM attachment_descriptions WHERE attachment_kind = 'capture' AND attachment_id = ?`,
						).run(att.id);
					}
					db.prepare('DELETE FROM capture_attachments WHERE capture_id = ?').run(id);
					const capture = db.prepare(`DELETE FROM captures WHERE id = ? RETURNING id`).get(id);
					return { capture, atts };
				})() as { capture: { id: number }; atts: { id: number; stored_path: string }[] } | null;

				if (!txResult) {
					set.status = 404;
					return { error: 'Not found' };
				}

				const { atts } = txResult;
				for (const att of atts) {
					try {
						const binPath = join(attachmentsDir, att.stored_path);
						if (existsSync(binPath)) unlinkSync(binPath);
					} catch (e) {
						console.warn(`[tasks] failed to delete attachment binary ${att.id}:`, e);
					}
					try {
						const mdPath = join(attachmentsMdDir(), `${att.id}.md`);
						if (existsSync(mdPath)) unlinkSync(mdPath);
					} catch (e) {
						console.warn(`[tasks] failed to delete attachment index ${att.id}:`, e);
					}
				}

				try {
					deleteCaptureFile(id);
				} catch (e) {
					console.warn(`[tasks] failed to delete capture file ${id}:`, e);
				}
				refreshIndex();
				return {};
			},
			{ params: t.Object({ id: t.String() }) },
		);
