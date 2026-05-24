import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { buildTestApp, json, req, type TestApp } from '../helpers/app';
import { __listenerCount, __resetListeners } from '../../src/captureEvents';

let app: TestApp;

beforeEach(async () => {
	app = await buildTestApp();
});

afterEach(async () => {
	await app?.cleanup();
});

function seedCapture(
	app: TestApp,
	text: string,
	source = 'agent',
	capturedAt = '2026-01-01T00:00:00Z',
	ingestedAt = new Date().toISOString(),
) {
	return app.db
		.prepare(
			'INSERT INTO captures (text, source, captured_at, ingested_at) VALUES (?, ?, ?, ?) RETURNING id',
		)
		.get(text, source, capturedAt, ingestedAt) as { id: number };
}

describe('GET /api/captures', () => {
	it('returns recent captures ordered by ingested_at descending', async () => {
		seedCapture(app, 'first');
		// ensure ingested_at differs
		await new Promise((r) => setTimeout(r, 10));
		seedCapture(app, 'second');
		await new Promise((r) => setTimeout(r, 10));
		seedCapture(app, 'third');

		const res = await app.app.handle(req('/api/captures'));
		expect(res.status).toBe(200);
		const body = await json(res);
		expect(body.items.map((c: any) => c.text)).toEqual(['third', 'second', 'first']);
		expect(body.next_cursor).toBeNull();
	});

	it('returns an empty page when there are no captures', async () => {
		const res = await app.app.handle(req('/api/captures'));
		expect(res.status).toBe(200);
		expect(await json(res)).toEqual({ items: [], next_cursor: null });
	});

	it('respects ?limit and caps it at 200', async () => {
		for (let i = 0; i < 5; i++) seedCapture(app, `c${i}`);
		const res = await app.app.handle(req('/api/captures?limit=2'));
		const body = await json(res);
		expect(body.items.length).toBe(2);
		expect(typeof body.next_cursor).toBe('string');

		const big = await app.app.handle(req('/api/captures?limit=500'));
		expect(big.status).toBe(200);
		expect((await json(big)).items.length).toBe(5);

		for (let i = 5; i < 205; i++) seedCapture(app, `c${i}`);
		const capped = await app.app.handle(req('/api/captures?limit=500'));
		expect(capped.status).toBe(200);
		expect((await json(capped)).items.length).toBe(200);
	});

	it('falls back to default limit 50 when ?limit is not a number', async () => {
		for (let i = 0; i < 3; i++) seedCapture(app, `c${i}`);
		const res = await app.app.handle(req('/api/captures?limit=garbage'));
		expect(res.status).toBe(200);
		expect((await json(res)).items.length).toBe(3);
	});

	it('rows include the canonical capture columns', async () => {
		seedCapture(app, 'body text');
		const res = await app.app.handle(req('/api/captures'));
		const { items } = await json(res);
		const [row] = items;
		expect(Object.keys(row).sort()).toEqual([
			'captured_at',
			'first_image_id',
			'id',
			'ingested_at',
			'source',
			'text',
			'triage_action',
			'triaged_at',
		]);
	});

	it('first_image_id is null when capture has no attachments', async () => {
		seedCapture(app, 'no attachments');
		const res = await app.app.handle(req('/api/captures'));
		const { items } = await json(res);
		const [row] = items;
		expect(row.first_image_id).toBeNull();
	});

	it('first_image_id is populated when capture has an image attachment', async () => {
		const { id } = seedCapture(app, 'with image');
		const attachRow = app.db
			.prepare(
				`INSERT INTO capture_attachments (capture_id, filename, content_type, size_bytes, stored_path, upload_source, created_at)
				 VALUES (?, 'snap.png', 'image/png', 100, '/tmp/snap.png', 'browser', '2026-01-01T00:00:00Z') RETURNING id`,
			)
			.get(id) as { id: number };

		const res = await app.app.handle(req('/api/captures'));
		const { items } = await json(res);
		const [row] = items;
		expect(row.first_image_id).toBe(attachRow.id);
	});

	it('excludes triaged captures by default', async () => {
		const { id } = seedCapture(app, 'to triage');
		seedCapture(app, 'untriaged');
		app.db
			.prepare('UPDATE captures SET triaged_at = ?, triage_action = ? WHERE id = ?')
			.run('2026-01-02T00:00:00Z', 'archive', id);

		const res = await app.app.handle(req('/api/captures'));
		expect(res.status).toBe(200);
		const body = await json(res);
		expect(body.items.map((c: any) => c.text)).toEqual(['untriaged']);
	});

	it('includes triaged captures when ?all=1', async () => {
		const { id } = seedCapture(app, 'archived');
		seedCapture(app, 'inbox');
		app.db
			.prepare('UPDATE captures SET triaged_at = ?, triage_action = ? WHERE id = ?')
			.run('2026-01-02T00:00:00Z', 'archive', id);

		const res = await app.app.handle(req('/api/captures?all=1'));
		expect(res.status).toBe(200);
		const body = await json(res);
		expect(body.items.map((c: any) => c.text)).toContain('archived');
		expect(body.items.map((c: any) => c.text)).toContain('inbox');
	});

	it('returns the next captures page with no duplicates', async () => {
		seedCapture(app, 'oldest', 'agent', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00.000Z');
		seedCapture(app, 'middle', 'agent', '2026-01-01T00:00:00Z', '2026-01-02T00:00:00.000Z');
		seedCapture(app, 'newest', 'agent', '2026-01-01T00:00:00Z', '2026-01-03T00:00:00.000Z');

		const first = await app.app.handle(req('/api/captures?limit=2'));
		const firstBody = await json(first);
		expect(firstBody.items.map((c: any) => c.text)).toEqual(['newest', 'middle']);
		expect(typeof firstBody.next_cursor).toBe('string');

		const second = await app.app.handle(
			req(`/api/captures?limit=2&cursor=${firstBody.next_cursor}`),
		);
		const secondBody = await json(second);
		expect(secondBody.items.map((c: any) => c.text)).toEqual(['oldest']);
		expect(secondBody.next_cursor).toBeNull();
	});

	it('uses id as a cursor tie-breaker when capture timestamps match', async () => {
		seedCapture(app, 'first', 'agent', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00.000Z');
		seedCapture(app, 'second', 'agent', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00.000Z');
		seedCapture(app, 'third', 'agent', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00.000Z');

		const first = await app.app.handle(req('/api/captures?limit=2'));
		const firstBody = await json(first);
		const second = await app.app.handle(
			req(`/api/captures?limit=2&cursor=${firstBody.next_cursor}`),
		);
		const secondBody = await json(second);

		expect([...firstBody.items, ...secondBody.items].map((c: any) => c.text)).toEqual([
			'third',
			'second',
			'first',
		]);
		expect(secondBody.next_cursor).toBeNull();
	});

	it('preserves all=1 when paginating captures', async () => {
		const { id } = seedCapture(
			app,
			'archived',
			'agent',
			'2026-01-01T00:00:00Z',
			'2026-01-01T00:00:00.000Z',
		);
		seedCapture(app, 'middle', 'agent', '2026-01-01T00:00:00Z', '2026-01-02T00:00:00.000Z');
		seedCapture(app, 'newest', 'agent', '2026-01-01T00:00:00Z', '2026-01-03T00:00:00.000Z');
		app.db
			.prepare('UPDATE captures SET triaged_at = ?, triage_action = ? WHERE id = ?')
			.run('2026-01-02T00:00:00Z', 'archive', id);

		const first = await app.app.handle(req('/api/captures?limit=2&all=1'));
		const firstBody = await json(first);
		const second = await app.app.handle(
			req(`/api/captures?limit=2&all=1&cursor=${firstBody.next_cursor}`),
		);
		const secondBody = await json(second);

		expect([...firstBody.items, ...secondBody.items].map((c: any) => c.text)).toEqual([
			'newest',
			'middle',
			'archived',
		]);
	});

	it('returns 400 for malformed capture cursors', async () => {
		const res = await app.app.handle(req('/api/captures?cursor=not-a-cursor'));
		expect(res.status).toBe(400);
		expect(await json(res)).toEqual({ error: 'Invalid cursor' });
	});
});

describe('GET /api/captures/:id', () => {
	it('returns the requested capture', async () => {
		const { id } = seedCapture(app, 'only one');
		const res = await app.app.handle(req(`/api/captures/${id}`));
		expect(res.status).toBe(200);
		expect((await json(res)).text).toBe('only one');
	});

	it('returns 400 on non-numeric id', async () => {
		const res = await app.app.handle(req('/api/captures/abc'));
		expect(res.status).toBe(400);
		expect((await json(res)).error).toBe('Invalid id');
	});

	it('returns 404 when the capture does not exist', async () => {
		const res = await app.app.handle(req('/api/captures/99999'));
		expect(res.status).toBe(404);
		expect((await json(res)).error).toBe('Not found');
	});

	it('first_image_id is null when capture has no attachments', async () => {
		const { id } = seedCapture(app, 'no attachment');
		const res = await app.app.handle(req(`/api/captures/${id}`));
		expect(res.status).toBe(200);
		expect((await json(res)).first_image_id).toBeNull();
	});

	it('first_image_id is populated when capture has an image attachment', async () => {
		const { id } = seedCapture(app, 'with image');
		const attachRow = app.db
			.prepare(
				`INSERT INTO capture_attachments (capture_id, filename, content_type, size_bytes, stored_path, upload_source, created_at)
				 VALUES (?, 'snap.png', 'image/png', 100, '/tmp/snap.png', 'browser', '2026-01-01T00:00:00Z') RETURNING id`,
			)
			.get(id) as { id: number };

		const res = await app.app.handle(req(`/api/captures/${id}`));
		expect(res.status).toBe(200);
		expect((await json(res)).first_image_id).toBe(attachRow.id);
	});
});

describe('GET /api/captures/stream', () => {
	it('is not caught by /:id route', async () => {
		const res = await app.app.handle(req('/api/captures/stream'));
		expect(res.headers.get('content-type')).toContain('text/event-stream');
	});
});

describe('POST /api/captures', () => {
	it('creates a capture and returns id, triage_action, and text', async () => {
		const res = await app.app.handle(
			req('/api/captures', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ text: 'hello', source: 'browser' }),
			}),
		);
		expect(res.status).toBe(200);
		const body = await json(res);
		expect(typeof body.id).toBe('number');
		expect(body.triage_action).toBeNull();
		expect(body.text).toBe('hello');
	});

	describe('slash commands', () => {
		it('/task stores stripped text with triage_action=task and triaged_at set', async () => {
			const res = await app.app.handle(
				req('/api/captures', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ text: '/task buy oat milk', source: 'browser' }),
				}),
			);
			expect(res.status).toBe(200);
			const body = await json(res);
			expect(body.triage_action).toBe('task');
			expect(body.text).toBe('buy oat milk');

			const row = app.db.query('SELECT * FROM captures WHERE id = ?').get(body.id) as any;
			expect(row.text).toBe('buy oat milk');
			expect(row.triage_action).toBe('task');
			expect(typeof row.triaged_at).toBe('string');
		});

		it('/note stores stripped text with triage_action=keep', async () => {
			const res = await app.app.handle(
				req('/api/captures', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ text: '/note remember this', source: 'browser' }),
				}),
			);
			const body = await json(res);
			expect(body.triage_action).toBe('keep');
			expect(body.text).toBe('remember this');
		});

		it('/skip stores stripped text with triage_action=skip', async () => {
			const res = await app.app.handle(
				req('/api/captures', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ text: '/skip dry cleaning', source: 'browser' }),
				}),
			);
			const body = await json(res);
			expect(body.triage_action).toBe('skip');
			expect(body.text).toBe('dry cleaning');
		});

		it('unknown command is stored as plain text', async () => {
			const res = await app.app.handle(
				req('/api/captures', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ text: '/foobar some text', source: 'browser' }),
				}),
			);
			const body = await json(res);
			expect(body.triage_action).toBeNull();
			expect(body.text).toBe('/foobar some text');
		});

		it('command captures do not appear in the inbox list', async () => {
			const res = await app.app.handle(
				req('/api/captures', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ text: '/task buy milk', source: 'browser' }),
				}),
			);
			const { id } = await json(res);
			const inbox = await app.app.handle(req('/api/captures'));
			const inboxBody = await json(inbox);
			expect(inboxBody.items.find((c: any) => c.id === id)).toBeUndefined();
		});
	});

	it('returns 422 when text is empty', async () => {
		const res = await app.app.handle(
			req('/api/captures', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ text: '', source: 'browser' }),
			}),
		);
		expect(res.status).toBe(422);
	});

	it('returns 422 when source is missing', async () => {
		const res = await app.app.handle(
			req('/api/captures', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ text: 'hello' }),
			}),
		);
		expect(res.status).toBe(422);
	});
});

describe('POST /api/captures/:id/triage', () => {
	it('sets triaged_at and triage_action on the capture', async () => {
		const { id } = seedCapture(app, 'to triage');
		const res = await app.app.handle(
			req(`/api/captures/${id}/triage`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'archive' }),
			}),
		);
		expect(res.status).toBe(200);
		const row = app.db
			.query('SELECT triaged_at, triage_action FROM captures WHERE id = ?')
			.get(id) as any;
		expect(row.triage_action).toBe('archive');
		expect(typeof row.triaged_at).toBe('string');
	});

	it('returns 404 for a non-existent capture', async () => {
		const res = await app.app.handle(
			req('/api/captures/99999/triage', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'keep' }),
			}),
		);
		expect(res.status).toBe(404);
	});

	it('returns 400 for an invalid action', async () => {
		const { id } = seedCapture(app, 'test');
		const res = await app.app.handle(
			req(`/api/captures/${id}/triage`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'delete' }),
			}),
		);
		expect(res.status).toBe(400);
	});

	it('returns 400 for a non-numeric id', async () => {
		const res = await app.app.handle(
			req('/api/captures/abc/triage', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'keep' }),
			}),
		);
		expect(res.status).toBe(400);
	});

	it('removes the capture from the default (inbox) list after triage', async () => {
		const { id } = seedCapture(app, 'will be archived');
		await app.app.handle(
			req(`/api/captures/${id}/triage`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'archive' }),
			}),
		);
		const res = await app.app.handle(req('/api/captures'));
		const body = await json(res);
		expect(body.items.find((c: any) => c.id === id)).toBeUndefined();
	});
});

describe('SSE listener lifecycle', () => {
	beforeEach(() => __resetListeners());
	afterEach(() => __resetListeners());

	it('registers a listener when a stream is opened', async () => {
		expect(__listenerCount()).toBe(0);
		const res = await app.app.handle(req('/api/captures/stream'));
		expect(__listenerCount()).toBe(1);
		await res.body?.cancel();
	});

	it('removes the listener when the stream is cancelled', async () => {
		const res = await app.app.handle(req('/api/captures/stream'));
		await res.body!.cancel();
		expect(__listenerCount()).toBe(0);
	});

	it('emits a capture event when POST /api/captures succeeds', async () => {
		const streamRes = await app.app.handle(req('/api/captures/stream'));
		const reader = streamRes.body!.getReader();

		// Drain the initial ": connected\n\n" comment sent by start()
		await reader.read();

		await app.app.handle(
			req('/api/captures', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ text: 'sse-e2e', source: 'test' }),
			}),
		);

		const { value } = await reader.read();
		const text = new TextDecoder().decode(value);
		expect(text).toContain('event: capture');
		expect(text).toContain('sse-e2e');
		await reader.cancel();
	});
});
