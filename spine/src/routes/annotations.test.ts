import { afterEach, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { annotationsMdDir } from '../search';
import { createTestDb } from '../testSupport/db';
import { browserGet, browserJson, buildTestApp } from '../testSupport/http';

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function setup() {
	const ctx = createTestDb();
	cleanup = ctx.cleanup;
	const now = '2026-05-29T12:00:00.000Z';
	const capture = ctx.db
		.prepare('INSERT INTO captures (text, source, captured_at, ingested_at) VALUES (?, ?, ?, ?)')
		.run('annotatable capture text', 'test', now, now);
	return { ...ctx, app: buildTestApp(ctx.db, ctx.dir), captureId: Number(capture.lastInsertRowid) };
}

test('annotations can be created, listed, indexed, and deleted', async () => {
	const { app, captureId } = setup();
	const create = await app.handle(
		browserJson('/api/annotations', {
			target_kind: 'capture',
			target_id: String(captureId),
			selection_start: 0,
			selection_end: 11,
			selection_text: 'annotatable',
			comment: 'remember this passage',
		}),
	);
	expect(create.status).toBe(201);
	const created = (await create.json()) as { annotation: { id: string; comment: string } };
	expect(created.annotation.comment).toBe('remember this passage');
	expect(existsSync(join(annotationsMdDir(), `${created.annotation.id}.md`))).toBe(true);

	const list = await app.handle(
		browserGet(`/api/annotations?target_kind=capture&target_id=${captureId}`),
	);
	expect(list.status).toBe(200);
	expect((await list.json()) as unknown).toMatchObject({
		annotations: [{ id: created.annotation.id, selection_text: 'annotatable' }],
	});

	const deleted = await app.handle(
		new Request(`http://spine.test/api/annotations/${created.annotation.id}`, {
			method: 'DELETE',
			headers: { 'x-authentik-username': 'test-user' },
		}),
	);
	expect(deleted.status).toBe(204);
	expect(existsSync(join(annotationsMdDir(), `${created.annotation.id}.md`))).toBe(false);
});

test('numeric target kinds reject nonnumeric target ids', async () => {
	const { app } = setup();
	const response = await app.handle(
		browserJson('/api/annotations', {
			target_kind: 'capture',
			target_id: 'cap_123',
			comment: 'bad id',
		}),
	);
	expect(response.status).toBe(400);
	expect(await response.json()).toEqual({ error: 'Target id is invalid' });
});
