import { Elysia, t } from 'elysia';
import type { Database } from 'bun:sqlite';
import type { CaptureRow } from '../db/rows';
import { writeCaptureFile, refreshIndex } from '../search';

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

const TASK_SELECT =
	'SELECT id, text, source, captured_at, ingested_at, triaged_at, triage_action, task_due_date, task_priority, task_notes FROM captures';

export const tasksRoutes = (db: Database) =>
	new Elysia()
		.get('/api/tasks', () => {
			const rows = db
				.query(`${TASK_SELECT} WHERE triage_action = 'task' ORDER BY captured_at DESC`)
				.all() as CaptureRow[];

			// Sort: due_date asc (nulls last), priority (high→medium→low→null), captured_at desc
			return rows.sort((a, b) => {
				if (a.task_due_date !== b.task_due_date) {
					if (!a.task_due_date) return 1;
					if (!b.task_due_date) return -1;
					return a.task_due_date < b.task_due_date ? -1 : 1;
				}
				const pa = a.task_priority != null ? (PRIORITY_ORDER[a.task_priority] ?? 3) : 3;
				const pb = b.task_priority != null ? (PRIORITY_ORDER[b.task_priority] ?? 3) : 3;
				if (pa !== pb) return pa - pb;
				return b.captured_at < a.captured_at ? -1 : 1;
			});
		})
		.post(
			'/api/tasks',
			({ body }) => {
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
							body.text,
							now,
							now,
							now,
							body.due_date ?? null,
							body.priority ?? null,
							body.notes ?? null,
						) as { id: number };
					writeCaptureFile(inserted.id, body.text, 'task', now);
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
				const result = db
					.prepare(
						`UPDATE captures SET task_due_date = ?, task_priority = ?, task_notes = ?
						WHERE id = ? AND triage_action = 'task' RETURNING id`,
					)
					.get(body.due_date ?? null, body.priority ?? null, body.notes ?? null, id) as {
					id: number;
				} | null;
				if (!result) {
					set.status = 404;
					return { error: 'Not found' };
				}
				return {};
			},
			{
				params: t.Object({ id: t.String() }),
				body: t.Object({
					due_date: t.Optional(t.Nullable(t.String())),
					priority: t.Optional(
						t.Nullable(t.Union([t.Literal('high'), t.Literal('medium'), t.Literal('low')])),
					),
					notes: t.Optional(t.Nullable(t.String())),
				}),
			},
		);
