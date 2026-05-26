import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { buildTestApp, json, req, type TestApp } from '../helpers/app';

let app: TestApp;

beforeEach(async () => {
	app = await buildTestApp();
});

afterEach(async () => {
	await app?.cleanup();
});

function seedTask(
	text: string,
	attrs: {
		captured_at?: string;
		due?: string | null;
		priority?: 'high' | 'medium' | 'low' | null;
		notes?: string | null;
		completed_at?: string | null;
	} = {},
): number {
	const capturedAt = attrs.captured_at ?? '2026-01-01T00:00:00Z';
	const row = app.db
		.prepare(
			`INSERT INTO captures
				(text, source, captured_at, ingested_at, triaged_at, triage_action, task_due_date, task_priority, task_notes, task_completed_at)
			 VALUES (?, 'task', ?, ?, ?, 'task', ?, ?, ?, ?) RETURNING id`,
		)
		.get(
			text,
			capturedAt,
			capturedAt,
			capturedAt,
			attrs.due ?? null,
			attrs.priority ?? null,
			attrs.notes ?? null,
			attrs.completed_at ?? null,
		) as { id: number };
	return row.id;
}

function seedCapture(text = 'plain capture'): number {
	const row = app.db
		.prepare(
			`INSERT INTO captures (text, source, captured_at, ingested_at)
			 VALUES (?, 'browser', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z') RETURNING id`,
		)
		.get(text) as { id: number };
	return row.id;
}

describe('POST /api/tasks', () => {
	it('creates a direct task with metadata', async () => {
		const res = await app.app.handle(
			req('/api/tasks', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					text: ' renew passport ',
					due_date: '2026-06-30',
					priority: 'high',
					notes: ' photo first ',
				}),
			}),
		);
		expect(res.status).toBe(200);
		const body = await json(res);
		const row = app.db.query('SELECT * FROM captures WHERE id = ?').get(body.id) as any;
		expect(row.text).toBe('renew passport');
		expect(row.source).toBe('task');
		expect(row.triage_action).toBe('task');
		expect(typeof row.triaged_at).toBe('string');
		expect(row.task_due_date).toBe('2026-06-30');
		expect(row.task_priority).toBe('high');
		expect(row.task_notes).toBe('photo first');
	});

	it('returns 422 for whitespace-only task text', async () => {
		const res = await app.app.handle(
			req('/api/tasks', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ text: '   ' }),
			}),
		);
		expect(res.status).toBe(422);
		expect(await json(res)).toEqual({ error: 'Task text is required' });
	});

	it('returns 422 for task text over 10,000 characters', async () => {
		const res = await app.app.handle(
			req('/api/tasks', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ text: 'x'.repeat(10_001) }),
			}),
		);
		expect(res.status).toBe(422);
	});

	it('returns 422 for invalid priority', async () => {
		const res = await app.app.handle(
			req('/api/tasks', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ text: 'task', priority: 'urgent' }),
			}),
		);
		expect(res.status).toBe(422);
	});
});

describe('GET /api/tasks', () => {
	it('lists active tasks by due date, priority, and deterministic recency tie-breaks', async () => {
		const undated = seedTask('undated', { captured_at: '2026-01-05T00:00:00Z' });
		const later = seedTask('later', { due: '2026-02-01', priority: 'high' });
		const low = seedTask('low', { due: '2026-01-01', priority: 'low' });
		const high = seedTask('high', { due: '2026-01-01', priority: 'high' });
		const sameA = seedTask('same A', { captured_at: '2026-01-03T00:00:00Z' });
		const sameB = seedTask('same B', { captured_at: '2026-01-03T00:00:00Z' });
		seedTask('done', { completed_at: '2026-01-07T00:00:00Z' });

		const res = await app.app.handle(req('/api/tasks'));
		expect(res.status).toBe(200);
		const body = await json(res);
		expect(body.map((task: any) => task.id)).toEqual([high, low, later, undated, sameB, sameA]);
	});
});

describe('PATCH /api/captures/:id/task', () => {
	it('updates task metadata', async () => {
		const id = seedTask('edit me');
		const res = await app.app.handle(
			req(`/api/captures/${id}/task`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ due_date: '2026-07-01', priority: 'medium', notes: 'updated' }),
			}),
		);
		expect(res.status).toBe(200);
		const row = app.db
			.query('SELECT task_due_date, task_priority, task_notes FROM captures WHERE id = ?')
			.get(id) as any;
		expect(row).toEqual({
			task_due_date: '2026-07-01',
			task_priority: 'medium',
			task_notes: 'updated',
		});
	});

	it('clears task metadata with nulls', async () => {
		const id = seedTask('clear me', { due: '2026-07-01', priority: 'low', notes: 'old' });
		const res = await app.app.handle(
			req(`/api/captures/${id}/task`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ due_date: null, priority: null, notes: null }),
			}),
		);
		expect(res.status).toBe(200);
		const row = app.db
			.query('SELECT task_due_date, task_priority, task_notes FROM captures WHERE id = ?')
			.get(id) as any;
		expect(row).toEqual({ task_due_date: null, task_priority: null, task_notes: null });
	});

	it('returns 404 for non-task captures', async () => {
		const id = seedCapture();
		const res = await app.app.handle(
			req(`/api/captures/${id}/task`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ priority: 'high' }),
			}),
		);
		expect(res.status).toBe(404);
	});

	it('returns 400 for non-numeric ids', async () => {
		const res = await app.app.handle(
			req('/api/captures/nope/task', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ priority: 'high' }),
			}),
		);
		expect(res.status).toBe(400);
	});
});

describe('complete and restore tasks', () => {
	it('completes active tasks and lists done newest first', async () => {
		const first = seedTask('first');
		const second = seedTask('second');
		await app.app.handle(req(`/api/tasks/${first}/complete`, { method: 'PATCH' }));
		await new Promise((resolve) => setTimeout(resolve, 5));
		await app.app.handle(req(`/api/tasks/${second}/complete`, { method: 'PATCH' }));

		const done = await app.app.handle(req('/api/tasks/done'));
		expect(done.status).toBe(200);
		const body = await json(done);
		expect(body.map((task: any) => task.id)).toEqual([second, first]);
		expect(body.every((task: any) => typeof task.task_completed_at === 'string')).toBe(true);
	});

	it('restores completed tasks while preserving metadata', async () => {
		const id = seedTask('restore', {
			due: '2026-08-01',
			priority: 'high',
			notes: 'keep this',
			completed_at: '2026-01-01T00:00:00Z',
		});
		const res = await app.app.handle(req(`/api/tasks/${id}/uncomplete`, { method: 'PATCH' }));
		expect(res.status).toBe(200);
		const row = app.db
			.query(
				'SELECT task_due_date, task_priority, task_notes, task_completed_at FROM captures WHERE id = ?',
			)
			.get(id) as any;
		expect(row).toEqual({
			task_due_date: '2026-08-01',
			task_priority: 'high',
			task_notes: 'keep this',
			task_completed_at: null,
		});
	});

	it('returns 404 when completing or restoring a non-task capture', async () => {
		const id = seedCapture();
		const complete = await app.app.handle(req(`/api/tasks/${id}/complete`, { method: 'PATCH' }));
		const restore = await app.app.handle(req(`/api/tasks/${id}/uncomplete`, { method: 'PATCH' }));
		expect(complete.status).toBe(404);
		expect(restore.status).toBe(404);
	});

	it('returns 400 for non-numeric ids', async () => {
		const complete = await app.app.handle(req('/api/tasks/nope/complete', { method: 'PATCH' }));
		const restore = await app.app.handle(req('/api/tasks/nope/uncomplete', { method: 'PATCH' }));
		expect(complete.status).toBe(400);
		expect(restore.status).toBe(400);
	});
});
