import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { buildTestApp, json, req, type TestApp } from '../helpers/app';

let app: TestApp;

beforeEach(async () => {
	app = await buildTestApp();
});

afterEach(async () => {
	await app?.cleanup();
});

function postJson(path: string, body: unknown) {
	return req(path, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body),
	});
}

function insertCapture(): number {
	return (
		app.db
			.prepare(
				'INSERT INTO captures (text, source, captured_at, ingested_at) VALUES (?, ?, ?, ?) RETURNING id',
			)
			.get('annotated capture body', 'test', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z') as {
			id: number;
		}
	).id;
}

describe('POST /api/annotations', () => {
	it('creates a capture annotation and writes a searchable markdown index document', async () => {
		const captureId = insertCapture();

		const res = await app.app.handle(
			postJson('/api/annotations', {
				target_kind: 'capture',
				target_id: String(captureId),
				selection_start: 0,
				selection_end: 9,
				selection_text: 'annotated',
				comment: 'remember this passage',
			}),
		);

		expect(res.status).toBe(201);
		const { annotation } = await json(res);
		expect(annotation).toMatchObject({
			target_kind: 'capture',
			target_id: String(captureId),
			selection_text: 'annotated',
			comment: 'remember this passage',
		});

		const indexPath = join(dirname(app.env.dbPath), 'annotation-index', `${annotation.id}.md`);
		expect(existsSync(indexPath)).toBe(true);
		expect(readFileSync(indexPath, 'utf8')).toContain('remember this passage');
	});

	it('rejects empty selection text without creating an annotation', async () => {
		const captureId = insertCapture();

		const res = await app.app.handle(
			postJson('/api/annotations', {
				target_kind: 'capture',
				target_id: String(captureId),
				selection_text: '   ',
				comment: 'note',
			}),
		);

		expect(res.status).toBe(400);
		expect((await json(res)).error).toBe('Selection text cannot be empty');
	});

	it('returns 404 for a missing target', async () => {
		const res = await app.app.handle(
			postJson('/api/annotations', {
				target_kind: 'capture',
				target_id: '9999',
				comment: 'orphan note',
			}),
		);

		expect(res.status).toBe(404);
		expect((await json(res)).error).toBe('Annotation target not found');
	});
});

describe('GET /api/annotations', () => {
	it('lists annotations for the requested target only', async () => {
		const captureId = insertCapture();
		const otherCaptureId = insertCapture();
		await app.app.handle(
			postJson('/api/annotations', {
				target_kind: 'capture',
				target_id: String(captureId),
				comment: 'visible note',
			}),
		);
		await app.app.handle(
			postJson('/api/annotations', {
				target_kind: 'capture',
				target_id: String(otherCaptureId),
				comment: 'other note',
			}),
		);

		const res = await app.app.handle(
			req(`/api/annotations?target_kind=capture&target_id=${captureId}`),
		);

		expect(res.status).toBe(200);
		expect((await json(res)).annotations.map((a: any) => a.comment)).toEqual(['visible note']);
	});

	it('requires a valid target kind', async () => {
		const res = await app.app.handle(req('/api/annotations?target_kind=bad&target_id=1'));
		expect(res.status).toBe(400);
	});
});

describe('DELETE /api/annotations/:id', () => {
	it('deletes the annotation row and its index document', async () => {
		const captureId = insertCapture();
		const create = await app.app.handle(
			postJson('/api/annotations', {
				target_kind: 'capture',
				target_id: String(captureId),
				comment: 'delete me',
			}),
		);
		const { annotation } = await json(create);
		const indexPath = join(dirname(app.env.dbPath), 'annotation-index', `${annotation.id}.md`);

		const res = await app.app.handle(
			req(`/api/annotations/${annotation.id}`, { method: 'DELETE' }),
		);

		expect(res.status).toBe(204);
		expect(app.db.query('SELECT id FROM annotations WHERE id = ?').get(annotation.id)).toBeNull();
		expect(existsSync(indexPath)).toBe(false);
	});

	it('returns 404 for an unknown annotation id', async () => {
		const res = await app.app.handle(req('/api/annotations/ann_missing', { method: 'DELETE' }));
		expect(res.status).toBe(404);
	});
});
