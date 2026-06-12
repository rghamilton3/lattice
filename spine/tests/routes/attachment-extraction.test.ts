import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { buildTestApp, json, req, type TestApp } from '../helpers/app';
import { createWorking } from '../../src/working';
import { __awaitQueueForTests, queueAttachment } from '../../src/extraction-queue';

let app: TestApp;

beforeEach(async () => {
	app = await buildTestApp();
});

afterEach(async () => {
	// Drain pending queue work before closing the DB to avoid races
	await __awaitQueueForTests();
	await app?.cleanup();
});

function authReq(path: string, init?: RequestInit) {
	return new Request(`http://localhost${path}`, {
		...init,
		headers: {
			'x-forwarded-proto': 'https',
			'x-authentik-username': 'test@local',
			...(init?.headers as Record<string, string> | undefined),
		},
	});
}

function authGet(path: string) {
	return req(path, {
		headers: { 'x-forwarded-proto': 'https', 'x-authentik-username': 'test@local' },
	});
}

function insertCapture(): number {
	const row = app.db
		.prepare(
			`INSERT INTO captures (text, source, captured_at, ingested_at)
             VALUES ('hello', 'test', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z') RETURNING id`,
		)
		.get() as { id: number };
	return row.id;
}

function makeFormData(filename: string, content: string, type = 'text/plain'): FormData {
	const fd = new FormData();
	fd.append('file', new File([content], filename, { type }));
	return fd;
}

async function uploadCapture(captureId: number, fd: FormData): Promise<Response> {
	return app.app.handle(
		authReq(`/api/captures/${captureId}/attachments`, { method: 'POST', body: fd }),
	);
}

async function uploadWorking(slug: string, fd: FormData): Promise<Response> {
	return app.app.handle(authReq(`/api/working/${slug}/attachments`, { method: 'POST', body: fd }));
}

// ─── Capture attachment extraction_status ────────────────────────────────────

describe('POST /api/captures/:id/attachments — extraction_status', () => {
	it('upload response includes extraction_status: pending', async () => {
		const captureId = insertCapture();
		const res = await uploadCapture(captureId, makeFormData('note.txt', 'hello'));
		expect(res.status).toBe(200);
		const body = await json(res);
		expect(body.extraction_status).toBe('pending');
	});
});

describe('Extraction pipeline — US1+US2 end-to-end', () => {
	it('text file: transitions from pending to done with extracted_text populated', async () => {
		const captureId = insertCapture();
		const content = 'Hello from a plain text attachment';
		const uploadRes = await uploadCapture(
			captureId,
			makeFormData('hello.txt', content, 'text/plain'),
		);
		expect(uploadRes.status).toBe(200);
		const { id: attId } = await json(uploadRes);

		// Wait for the async extraction queue to drain
		await __awaitQueueForTests();

		const row = app.db
			.query('SELECT extraction_status, extracted_text FROM capture_attachments WHERE id = ?')
			.get(attId) as { extraction_status: string; extracted_text: string } | null;
		expect(row).not.toBeNull();
		expect(row!.extraction_status).toBe('done');
		expect(row!.extracted_text).toContain('Hello from a plain text attachment');
	});
});

describe('GET /api/captures/:id/attachments — extraction_status', () => {
	it('list includes extraction_status on items', async () => {
		const captureId = insertCapture();
		await uploadCapture(captureId, makeFormData('note.txt', 'hello'));
		const res = await app.app.handle(authGet(`/api/captures/${captureId}/attachments`));
		expect(res.status).toBe(200);
		const body = await json(res);
		expect(body).toHaveLength(1);
		expect(body[0].extraction_status).toBeDefined();
	});
});

// ─── Capture attachment description endpoints ─────────────────────────────────

describe('GET /api/captures/:id/attachments/:attId/description', () => {
	it('returns 409 when attachment is not dark', async () => {
		const captureId = insertCapture();
		const uploadRes = await uploadCapture(captureId, makeFormData('note.txt', 'hello'));
		const { id: attId } = await json(uploadRes);
		// Status is 'pending' after upload; not dark
		const res = await app.app.handle(
			authGet(`/api/captures/${captureId}/attachments/${attId}/description`),
		);
		expect(res.status).toBe(409);
		expect((await json(res)).error).toBe('Attachment is not dark');
	});

	it('returns 404 when dark but no description row yet', async () => {
		const captureId = insertCapture();
		const uploadRes = await uploadCapture(captureId, makeFormData('note.txt', 'hello'));
		const { id: attId } = await json(uploadRes);
		app.db
			.prepare(`UPDATE capture_attachments SET extraction_status = 'dark' WHERE id = ?`)
			.run(attId);

		const res = await app.app.handle(
			authGet(`/api/captures/${captureId}/attachments/${attId}/description`),
		);
		expect(res.status).toBe(404);
		expect((await json(res)).error).toBe('No description yet');
	});

	it('returns 200 with description row when dark and row exists', async () => {
		const captureId = insertCapture();
		const uploadRes = await uploadCapture(captureId, makeFormData('img.png', 'fake', 'image/png'));
		const { id: attId } = await json(uploadRes);
		const now = new Date().toISOString();
		app.db
			.prepare(`UPDATE capture_attachments SET extraction_status = 'dark' WHERE id = ?`)
			.run(attId);
		app.db
			.prepare(
				`INSERT INTO attachment_descriptions
             (attachment_kind, attachment_id, produced_text, final_text, confirmed, model_id, supersedes, created_at)
             VALUES ('capture', ?, 'A test image.', 'A test image.', 0, 'test-model', null, ?)`,
			)
			.run(attId, now);

		const res = await app.app.handle(
			authGet(`/api/captures/${captureId}/attachments/${attId}/description`),
		);
		expect(res.status).toBe(200);
		const body = await json(res);
		expect(body.final_text).toBe('A test image.');
		expect(body.confirmed).toBe(false);
		expect(body.model_id).toBe('test-model');
	});

	it('returns 404 for unknown capture attachment', async () => {
		const captureId = insertCapture();
		const res = await app.app.handle(
			authGet(`/api/captures/${captureId}/attachments/9999/description`),
		);
		expect(res.status).toBe(404);
	});
});

describe('PATCH /api/captures/:id/attachments/:attId/description', () => {
	function insertDarkCapture(captureId: number): number {
		const row = app.db
			.prepare(
				`INSERT INTO capture_attachments
             (capture_id, signal_id, content_type, filename, size_bytes, stored_path, upload_source, created_at, extraction_status, extracted_text)
             VALUES (?, '', 'image/png', 'img.png', 100, '', 'browser', '2026-01-01T00:00:00Z', 'dark', '') RETURNING id`,
			)
			.get(captureId) as { id: number };
		app.db
			.prepare(
				`INSERT INTO attachment_descriptions
             (attachment_kind, attachment_id, produced_text, final_text, confirmed, model_id, supersedes, created_at)
             VALUES ('capture', ?, 'Original text.', 'Original text.', 0, 'test-model', null, '2026-01-01T00:00:00Z')`,
			)
			.run(row.id);
		return row.id;
	}

	it('updates final_text and returns updated row', async () => {
		const captureId = insertCapture();
		const attId = insertDarkCapture(captureId);

		const res = await app.app.handle(
			authReq(`/api/captures/${captureId}/attachments/${attId}/description`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ final_text: 'Updated description.' }),
			}),
		);
		expect(res.status).toBe(200);
		const body = await json(res);
		expect(body.final_text).toBe('Updated description.');
	});

	it('updates confirmed flag', async () => {
		const captureId = insertCapture();
		const attId = insertDarkCapture(captureId);

		const res = await app.app.handle(
			authReq(`/api/captures/${captureId}/attachments/${attId}/description`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ confirmed: true }),
			}),
		);
		expect(res.status).toBe(200);
		expect((await json(res)).confirmed).toBe(true);
	});

	it('returns 400 when body is empty', async () => {
		const captureId = insertCapture();
		const attId = insertDarkCapture(captureId);

		const res = await app.app.handle(
			authReq(`/api/captures/${captureId}/attachments/${attId}/description`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({}),
			}),
		);
		expect(res.status).toBe(400);
	});

	it('returns 400 when final_text is empty string', async () => {
		const captureId = insertCapture();
		const attId = insertDarkCapture(captureId);

		const res = await app.app.handle(
			authReq(`/api/captures/${captureId}/attachments/${attId}/description`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ final_text: '' }),
			}),
		);
		expect(res.status).toBe(400);
	});

	it('returns 404 when description row does not exist', async () => {
		const captureId = insertCapture();
		// Dark attachment but no description row
		const row = app.db
			.prepare(
				`INSERT INTO capture_attachments
             (capture_id, signal_id, content_type, filename, size_bytes, stored_path, upload_source, created_at, extraction_status, extracted_text)
             VALUES (?, '', 'image/png', 'img.png', 100, '', 'browser', '2026-01-01T00:00:00Z', 'dark', '') RETURNING id`,
			)
			.get(captureId) as { id: number };

		const res = await app.app.handle(
			authReq(`/api/captures/${captureId}/attachments/${row.id}/description`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ final_text: 'New text.' }),
			}),
		);
		expect(res.status).toBe(404);
	});
});

// ─── Working attachment extraction_status ─────────────────────────────────────

describe('POST /api/working/:slug/attachments — extraction_status', () => {
	it('upload response includes extraction_status: pending', async () => {
		const slug = createWorking('Test Doc', '# Test\n\nContent.\n');
		const res = await uploadWorking(slug, makeFormData('note.txt', 'hello'));
		expect(res.status).toBe(200);
		const body = await json(res);
		expect(body.extraction_status).toBe('pending');
	});
});

describe('GET /api/working/:slug/attachments — extraction_status', () => {
	it('list includes extraction_status on items', async () => {
		const slug = createWorking('Test Doc 2', '# Test\n\nContent.\n');
		await uploadWorking(slug, makeFormData('note.txt', 'hello'));
		const res = await app.app.handle(authGet(`/api/working/${slug}/attachments`));
		expect(res.status).toBe(200);
		const body = await json(res);
		expect(body).toHaveLength(1);
		expect(body[0].extraction_status).toBeDefined();
	});
});

// ─── Working attachment description endpoints ─────────────────────────────────

describe('GET /api/working/:slug/attachments/:attId/description', () => {
	it('returns 409 when attachment is not dark', async () => {
		const slug = createWorking('Working Doc', '# Doc\n\nContent.\n');
		const uploadRes = await uploadWorking(slug, makeFormData('note.txt', 'hello'));
		const { id: attId } = await json(uploadRes);

		const res = await app.app.handle(
			authGet(`/api/working/${slug}/attachments/${attId}/description`),
		);
		expect(res.status).toBe(409);
		expect((await json(res)).error).toBe('Attachment is not dark');
	});

	it('returns 200 with description when dark and row exists', async () => {
		const slug = createWorking('Working Doc 2', '# Doc\n\nContent.\n');
		const uploadRes = await uploadWorking(slug, makeFormData('img.png', 'fake', 'image/png'));
		const { id: attId } = await json(uploadRes);
		const now = new Date().toISOString();
		app.db
			.prepare(`UPDATE working_attachments SET extraction_status = 'dark' WHERE id = ?`)
			.run(attId);
		app.db
			.prepare(
				`INSERT INTO attachment_descriptions
             (attachment_kind, attachment_id, produced_text, final_text, confirmed, model_id, supersedes, created_at)
             VALUES ('working', ?, 'A working image.', 'A working image.', 0, 'test-model', null, ?)`,
			)
			.run(attId, now);

		const res = await app.app.handle(
			authGet(`/api/working/${slug}/attachments/${attId}/description`),
		);
		expect(res.status).toBe(200);
		const body = await json(res);
		expect(body.final_text).toBe('A working image.');
		expect(body.confirmed).toBe(false);
	});
});

describe('PATCH /api/working/:slug/attachments/:attId/description', () => {
	it('updates final_text and returns updated row', async () => {
		const slug = createWorking('Working Patch Doc', '# Doc\n\nContent.\n');
		const row = app.db
			.prepare(
				`INSERT INTO working_attachments
             (slug, content_type, filename, size_bytes, stored_path, created_at, extraction_status, extracted_text)
             VALUES (?, 'image/png', 'img.png', 100, '', '2026-01-01T00:00:00Z', 'dark', '') RETURNING id`,
			)
			.get(slug) as { id: number };
		app.db
			.prepare(
				`INSERT INTO attachment_descriptions
             (attachment_kind, attachment_id, produced_text, final_text, confirmed, model_id, supersedes, created_at)
             VALUES ('working', ?, 'Original.', 'Original.', 0, 'test-model', null, '2026-01-01T00:00:00Z')`,
			)
			.run(row.id);

		const res = await app.app.handle(
			authReq(`/api/working/${slug}/attachments/${row.id}/description`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ final_text: 'Updated working description.' }),
			}),
		);
		expect(res.status).toBe(200);
		expect((await json(res)).final_text).toBe('Updated working description.');
	});

	it('sets confirmed flag to true', async () => {
		const slug = createWorking('Working Confirm Doc', '# Doc\n\nContent.\n');
		const row = app.db
			.prepare(
				`INSERT INTO working_attachments
             (slug, content_type, filename, size_bytes, stored_path, created_at, extraction_status, extracted_text)
             VALUES (?, 'image/png', 'img.png', 100, '', '2026-01-01T00:00:00Z', 'dark', '') RETURNING id`,
			)
			.get(slug) as { id: number };
		app.db
			.prepare(
				`INSERT INTO attachment_descriptions
             (attachment_kind, attachment_id, produced_text, final_text, confirmed, model_id, supersedes, created_at)
             VALUES ('working', ?, 'Desc.', 'Desc.', 0, 'test-model', null, '2026-01-01T00:00:00Z')`,
			)
			.run(row.id);

		const res = await app.app.handle(
			authReq(`/api/working/${slug}/attachments/${row.id}/description`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ confirmed: true }),
			}),
		);
		expect(res.status).toBe(200);
		expect((await json(res)).confirmed).toBe(true);
	});
});

// ─── Extraction queue error and unknown-format paths ─────────────────────────

describe('Extraction queue — failed and unknown-format paths', () => {
	it('sets status to failed when stored file does not exist', async () => {
		const captureId = insertCapture();
		const row = app.db
			.prepare(
				`INSERT INTO capture_attachments
             (capture_id, signal_id, content_type, filename, size_bytes, stored_path, upload_source, created_at, extraction_status, extracted_text)
             VALUES (?, '', 'text/plain', 'ghost.txt', 0, 'nonexistent-uuid', 'browser', '2026-01-01T00:00:00Z', 'pending', '') RETURNING id`,
			)
			.get(captureId) as { id: number };

		queueAttachment(
			row.id,
			'capture',
			'/tmp/absolutely-nonexistent-path-x123',
			'text/plain',
			app.db,
		);
		await __awaitQueueForTests();

		const updated = app.db
			.query('SELECT extraction_status FROM capture_attachments WHERE id = ?')
			.get(row.id) as { extraction_status: string };
		expect(updated.extraction_status).toBe('failed');
	});

	it('sets status to failed on subprocess error and queue continues processing subsequent items', async () => {
		const captureId = insertCapture();
		// A garbage PDF will cause pdftotext (or its absence) to throw
		const garbageRes = await uploadCapture(
			captureId,
			makeFormData('garbage.pdf', 'not a real pdf', 'application/pdf'),
		);
		expect(garbageRes.status).toBe(200);
		const { id: garbageId } = await json(garbageRes);

		// A valid text file enqueued after the failing item — queue must not stall
		const textRes = await uploadCapture(
			captureId,
			makeFormData('after.txt', 'good content', 'text/plain'),
		);
		expect(textRes.status).toBe(200);
		const { id: textId } = await json(textRes);

		await __awaitQueueForTests();

		const garbageRow = app.db
			.query('SELECT extraction_status FROM capture_attachments WHERE id = ?')
			.get(garbageId) as { extraction_status: string };
		expect(garbageRow.extraction_status).toBe('failed');

		const textRow = app.db
			.query('SELECT extraction_status, extracted_text FROM capture_attachments WHERE id = ?')
			.get(textId) as { extraction_status: string; extracted_text: string };
		expect(textRow.extraction_status).toBe('done');
		expect(textRow.extracted_text).toBe('good content');
	});

	it('sets status to done with empty extracted_text for unknown format (e.g. application/zip)', async () => {
		const captureId = insertCapture();
		const res = await uploadCapture(
			captureId,
			makeFormData('archive.zip', '\x50\x4B\x05\x06', 'application/zip'),
		);
		expect(res.status).toBe(200);
		const { id: attId } = await json(res);

		await __awaitQueueForTests();

		const row = app.db
			.query('SELECT extraction_status, extracted_text FROM capture_attachments WHERE id = ?')
			.get(attId) as { extraction_status: string; extracted_text: string };
		expect(row.extraction_status).toBe('done');
		expect(row.extracted_text).toBe('');
	});
});
