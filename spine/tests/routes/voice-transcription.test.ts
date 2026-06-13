import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildTestApp, json, req, type TestApp } from '../helpers/app';
import {
	__awaitQueueForTests,
	__setTranscribeImplForTests,
	sweepPending,
	startTranscriptRetryLoop,
} from '../../src/extraction-queue';
import { TerminalTranscriptionError, TransientTranscriptionError } from '../../src/transcribe';
import { onTranscriptionAttention } from '../../src/transcriptionEvents';
import { attachmentsMdDir } from '../../src/search';

let app: TestApp;
let asrCalls: number;

beforeEach(async () => {
	process.env.LATTICE_ASR_MODEL = 'test-asr';
	asrCalls = 0;
	app = await buildTestApp();
});

afterEach(async () => {
	await __awaitQueueForTests();
	__setTranscribeImplForTests(null);
	delete process.env.LATTICE_ASR_MODEL;
	await app?.cleanup();
});

function stubAsr(text: string) {
	__setTranscribeImplForTests(async () => {
		asrCalls++;
		return { text, modelId: 'test-asr' };
	});
}

function stubAsrError(err: Error) {
	__setTranscribeImplForTests(async () => {
		asrCalls++;
		throw err;
	});
}

function agentHeaders(): Record<string, string> {
	return {
		authorization: 'Bearer test-token',
		'x-forwarded-proto': 'https',
		'content-type': 'application/json',
	};
}

function authHeaders(): Record<string, string> {
	return { 'x-forwarded-proto': 'https', 'x-authentik-username': 'test@local' };
}

async function createSignalCapture(text: string): Promise<number> {
	const res = await app.app.handle(
		req('/api/agent/capture', {
			method: 'POST',
			headers: agentHeaders(),
			body: JSON.stringify({ text, source: 'signal', captured_at: '2026-06-11T00:00:00Z' }),
		}),
	);
	expect(res.status).toBe(200);
	return (await json(res)).id;
}

async function uploadSignalAudio(captureId: number, signalId = 'voice-note.aac'): Promise<number> {
	const bytes = Buffer.from('fake-aac-audio-bytes');
	const res = await app.app.handle(
		req(`/api/agent/capture/${captureId}/attachments`, {
			method: 'POST',
			headers: agentHeaders(),
			body: JSON.stringify({
				signal_id: signalId,
				content_type: 'audio/aac',
				filename: 'voice-note.aac',
				data: bytes.toString('base64'),
				size_bytes: bytes.length,
			}),
		}),
	);
	expect(res.status).toBe(200);
	return (await json(res)).id;
}

function attRow(attId: number) {
	return app.db
		.query(
			'SELECT extraction_status, extraction_failure_reason, extracted_text FROM capture_attachments WHERE id = ?',
		)
		.get(attId) as {
		extraction_status: string;
		extraction_failure_reason: string;
		extracted_text: string;
	};
}

function headDescription(attId: number) {
	return app.db
		.query(
			`SELECT * FROM attachment_descriptions
		   WHERE attachment_kind = 'capture' AND attachment_id = ? AND supersedes IS NULL`,
		)
		.get(attId) as {
		id: number;
		produced_text: string;
		final_text: string;
		confirmed: number;
		model_id: string;
	} | null;
}

// ─── US1: healthy path ────────────────────────────────────────────────────────

describe('voice capture healthy path (US1)', () => {
	it('signal audio upload transcribes to done with indexed transcript and provenance', async () => {
		stubAsr('we should prototype the lattice resurfacing idea tomorrow');
		const captureId = await createSignalCapture('caption text from signal');
		const attId = await uploadSignalAudio(captureId);

		await __awaitQueueForTests();

		const row = attRow(attId);
		expect(row.extraction_status).toBe('done');
		expect(row.extracted_text).toBe('we should prototype the lattice resurfacing idea tomorrow');
		expect(row.extraction_failure_reason).toBe('');

		const desc = headDescription(attId);
		expect(desc).not.toBeNull();
		expect(desc!.final_text).toBe('we should prototype the lattice resurfacing idea tomorrow');
		expect(desc!.confirmed).toBe(0);
		expect(desc!.model_id).toBe('test-asr');

		// Transcript reaches the search index through the attachment-index path
		const md = readFileSync(join(attachmentsMdDir(), `${attId}.md`), 'utf-8');
		expect(md).toContain('lattice resurfacing idea');

		// SR-4: the caption text is untouched on the capture
		const cap = app.db.query('SELECT text FROM captures WHERE id = ?').get(captureId) as {
			text: string;
		};
		expect(cap.text).toBe('caption text from signal');
	});

	it('emits a completion attention event for capture attachments', async () => {
		stubAsr('short note');
		const seen: Array<{ type: string; capture_id: number; attachment_id: number }> = [];
		const off = onTranscriptionAttention((i) => seen.push(i));

		const captureId = await createSignalCapture('caption');
		const attId = await uploadSignalAudio(captureId);
		await __awaitQueueForTests();
		off();

		expect(seen).toHaveLength(1);
		expect(seen[0].type).toBe('complete');
		expect(seen[0].capture_id).toBe(captureId);
		expect(seen[0].attachment_id).toBe(attId);
	});

	it('non-audio signal uploads still extract through the existing path', async () => {
		const captureId = await createSignalCapture('caption');
		const bytes = Buffer.from('plain text attachment content');
		const res = await app.app.handle(
			req(`/api/agent/capture/${captureId}/attachments`, {
				method: 'POST',
				headers: agentHeaders(),
				body: JSON.stringify({
					signal_id: 'note.txt',
					content_type: 'text/plain',
					filename: 'note.txt',
					data: bytes.toString('base64'),
					size_bytes: bytes.length,
				}),
			}),
		);
		expect(res.status).toBe(200);
		const { id: attId } = await json(res);
		await __awaitQueueForTests();
		const row = attRow(attId);
		expect(row.extraction_status).toBe('done');
		expect(row.extracted_text).toContain('plain text attachment content');
	});
});

// ─── US2: failure classes and reconciliation ──────────────────────────────────

describe('transcription durability (US2)', () => {
	it('transient exhaustion persists failed with transient: reason; capture survives', async () => {
		stubAsrError(new TransientTranscriptionError('AI server unreachable'));
		const captureId = await createSignalCapture('caption');
		const attId = await uploadSignalAudio(captureId);
		await __awaitQueueForTests();

		const row = attRow(attId);
		expect(row.extraction_status).toBe('failed');
		expect(row.extraction_failure_reason).toStartWith('transient:');
		expect(app.db.query('SELECT id FROM captures WHERE id = ?').get(captureId)).not.toBeNull();
	});

	it('terminal failure persists terminal: reason and is NOT re-swept', async () => {
		stubAsrError(new TerminalTranscriptionError('undecodable audio'));
		const captureId = await createSignalCapture('caption');
		const attId = await uploadSignalAudio(captureId);
		await __awaitQueueForTests();

		expect(attRow(attId).extraction_failure_reason).toStartWith('terminal:');
		const callsAfterFail = asrCalls;

		await sweepPending(app.db, app.env.attachmentsDir);
		expect(asrCalls).toBe(callsAfterFail);
		expect(attRow(attId).extraction_status).toBe('failed');
	});

	it('transient-failed rows are re-swept and recover', async () => {
		stubAsrError(new TransientTranscriptionError('outage'));
		const captureId = await createSignalCapture('caption');
		const attId = await uploadSignalAudio(captureId);
		await __awaitQueueForTests();
		expect(attRow(attId).extraction_status).toBe('failed');

		stubAsr('recovered transcript');
		await sweepPending(app.db, app.env.attachmentsDir);

		const row = attRow(attId);
		expect(row.extraction_status).toBe('done');
		expect(row.extracted_text).toBe('recovered transcript');
		expect(row.extraction_failure_reason).toBe('');
	});

	it('processing (crash-interrupted) and pending rows are re-swept (TX-3)', async () => {
		stubAsr('post-crash transcript');
		const captureId = await createSignalCapture('caption');
		const attId = await uploadSignalAudio(captureId);
		await __awaitQueueForTests();

		// Simulate a crash mid-job: force the row back to processing
		app.db
			.prepare(`UPDATE capture_attachments SET extraction_status = 'processing' WHERE id = ?`)
			.run(attId);
		// And unconfirm nothing - sweep should finish it back to done
		await sweepPending(app.db, app.env.attachmentsDir);
		expect(attRow(attId).extraction_status).toBe('done');
	});

	it('the retry loop re-enqueues transient-failed audio rows', async () => {
		stubAsrError(new TransientTranscriptionError('outage'));
		const captureId = await createSignalCapture('caption');
		const attId = await uploadSignalAudio(captureId);
		await __awaitQueueForTests();
		expect(attRow(attId).extraction_status).toBe('failed');

		stubAsr('loop recovered');
		const stop = startTranscriptRetryLoop(app.db, app.env.attachmentsDir, 10);
		try {
			await new Promise((r) => setTimeout(r, 50));
			await __awaitQueueForTests();
		} finally {
			stop();
		}
		expect(attRow(attId).extraction_status).toBe('done');
		expect(attRow(attId).extracted_text).toBe('loop recovered');
	});
});

// ─── US3: manual retry endpoint ───────────────────────────────────────────────

describe('POST /api/captures/:id/attachments/:attId/retry-extraction (US3)', () => {
	it('404 on unknown attachment, 409 when not failed', async () => {
		stubAsr('ok');
		const captureId = await createSignalCapture('caption');
		const attId = await uploadSignalAudio(captureId);
		await __awaitQueueForTests();

		const notFound = await app.app.handle(
			req(`/api/captures/${captureId}/attachments/9999/retry-extraction`, {
				method: 'POST',
				headers: authHeaders(),
			}),
		);
		expect(notFound.status).toBe(404);

		const conflict = await app.app.handle(
			req(`/api/captures/${captureId}/attachments/${attId}/retry-extraction`, {
				method: 'POST',
				headers: authHeaders(),
			}),
		);
		expect(conflict.status).toBe(409);
	});

	it('resets a failed attachment to pending and re-runs it', async () => {
		stubAsrError(new TerminalTranscriptionError('undecodable audio'));
		const captureId = await createSignalCapture('caption');
		const attId = await uploadSignalAudio(captureId);
		await __awaitQueueForTests();
		expect(attRow(attId).extraction_status).toBe('failed');

		stubAsr('manual retry transcript');
		const res = await app.app.handle(
			req(`/api/captures/${captureId}/attachments/${attId}/retry-extraction`, {
				method: 'POST',
				headers: authHeaders(),
			}),
		);
		expect(res.status).toBe(200);
		expect((await json(res)).status).toBe('pending');

		await __awaitQueueForTests();
		const row = attRow(attId);
		expect(row.extraction_status).toBe('done');
		expect(row.extracted_text).toBe('manual retry transcript');
	});
});

// ─── US4: transcript view/edit/confirm protection ─────────────────────────────

describe('transcript description routes (US4)', () => {
	it('GET serves the transcript for a done audio attachment (gate relaxed)', async () => {
		stubAsr('original transcript');
		const captureId = await createSignalCapture('caption');
		const attId = await uploadSignalAudio(captureId);
		await __awaitQueueForTests();

		const res = await app.app.handle(
			req(`/api/captures/${captureId}/attachments/${attId}/description`, {
				headers: authHeaders(),
			}),
		);
		expect(res.status).toBe(200);
		const body = await json(res);
		expect(body.final_text).toBe('original transcript');
		expect(body.confirmed).toBe(false);
	});

	it('PATCH on an audio transcript refreshes the extracted_text snapshot', async () => {
		stubAsr('original transcript');
		const captureId = await createSignalCapture('caption');
		const attId = await uploadSignalAudio(captureId);
		await __awaitQueueForTests();

		const res = await app.app.handle(
			req(`/api/captures/${captureId}/attachments/${attId}/description`, {
				method: 'PATCH',
				headers: { ...authHeaders(), 'content-type': 'application/json' },
				body: JSON.stringify({ final_text: 'corrected transcript', confirmed: true }),
			}),
		);
		expect(res.status).toBe(200);
		const body = await json(res);
		expect(body.confirmed).toBe(true);

		expect(attRow(attId).extracted_text).toBe('corrected transcript');
		const md = readFileSync(join(attachmentsMdDir(), `${attId}.md`), 'utf-8');
		expect(md).toContain('corrected transcript');
	});

	it('a confirmed transcript is never overwritten by re-runs (TX-7/RH-4)', async () => {
		stubAsr('original transcript');
		const captureId = await createSignalCapture('caption');
		const attId = await uploadSignalAudio(captureId);
		await __awaitQueueForTests();

		await app.app.handle(
			req(`/api/captures/${captureId}/attachments/${attId}/description`, {
				method: 'PATCH',
				headers: { ...authHeaders(), 'content-type': 'application/json' },
				body: JSON.stringify({ final_text: 'my corrected words', confirmed: true }),
			}),
		);

		// Force re-runs through both reconciliation paths
		const callsBefore = asrCalls;
		stubAsr('MODEL OVERWRITE ATTEMPT');
		app.db
			.prepare(`UPDATE capture_attachments SET extraction_status = 'pending' WHERE id = ?`)
			.run(attId);
		await sweepPending(app.db, app.env.attachmentsDir);

		expect(asrCalls).toBe(callsBefore); // confirmed short-circuit: no ASR call
		const row = attRow(attId);
		expect(row.extraction_status).toBe('done');
		expect(row.extracted_text).toBe('my corrected words');
		const desc = headDescription(attId);
		expect(desc!.final_text).toBe('my corrected words');
		expect(desc!.confirmed).toBe(1);
	});

	it('an unconfirmed re-run supersedes the old transcript, preserving history', async () => {
		stubAsr('first pass');
		const captureId = await createSignalCapture('caption');
		const attId = await uploadSignalAudio(captureId);
		await __awaitQueueForTests();
		const first = headDescription(attId)!;

		stubAsr('second pass');
		app.db
			.prepare(`UPDATE capture_attachments SET extraction_status = 'pending' WHERE id = ?`)
			.run(attId);
		await sweepPending(app.db, app.env.attachmentsDir);

		const head = headDescription(attId)!;
		expect(head.final_text).toBe('second pass');
		expect(head.id).not.toBe(first.id);
		const old = app.db
			.query('SELECT supersedes FROM attachment_descriptions WHERE id = ?')
			.get(first.id) as { supersedes: number };
		expect(old.supersedes).toBe(head.id);
	});

	it('image attachments keep the dark-only gate (no regression)', async () => {
		const captureId = await createSignalCapture('caption');
		const bytes = Buffer.from('fake-png');
		const upload = await app.app.handle(
			req(`/api/agent/capture/${captureId}/attachments`, {
				method: 'POST',
				headers: agentHeaders(),
				body: JSON.stringify({
					signal_id: 'img.png',
					content_type: 'image/png',
					filename: 'img.png',
					data: bytes.toString('base64'),
					size_bytes: bytes.length,
				}),
			}),
		);
		const { id: attId } = await json(upload);
		await __awaitQueueForTests();
		// Force a non-dark status to assert the gate
		app.db
			.prepare(`UPDATE capture_attachments SET extraction_status = 'done' WHERE id = ?`)
			.run(attId);

		const res = await app.app.handle(
			req(`/api/captures/${captureId}/attachments/${attId}/description`, {
				headers: authHeaders(),
			}),
		);
		expect(res.status).toBe(409);
	});
});

// ─── NF-4: deletion removes audio + transcript together ───────────────────────

describe('capture deletion cleanup (NF-4)', () => {
	it('deleting a capture removes the audio file, index entry, and transcript rows', async () => {
		stubAsr('doomed transcript');
		const captureId = await createSignalCapture('caption');
		const attId = await uploadSignalAudio(captureId);
		await __awaitQueueForTests();

		const binPath = join(app.env.attachmentsDir, `${captureId}/voice-note.aac`);
		const mdPath = join(attachmentsMdDir(), `${attId}.md`);
		expect(existsSync(binPath)).toBe(true);
		expect(existsSync(mdPath)).toBe(true);
		expect(headDescription(attId)).not.toBeNull();

		// The delete endpoint targets task captures
		app.db.prepare(`UPDATE captures SET triage_action = 'task' WHERE id = ?`).run(captureId);
		const res = await app.app.handle(
			req(`/api/tasks/${captureId}`, { method: 'DELETE', headers: authHeaders() }),
		);
		expect(res.status).toBe(200);

		expect(existsSync(binPath)).toBe(false);
		expect(existsSync(mdPath)).toBe(false);
		expect(headDescription(attId)).toBeNull();
		expect(app.db.query('SELECT id FROM capture_attachments WHERE id = ?').get(attId)).toBeNull();
	});
});
