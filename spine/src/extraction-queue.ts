import type { Database } from 'bun:sqlite';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { extractText, isImageType } from './extract';
import { generateDescription } from './describe';
import {
	transcribeAudioFile,
	TerminalTranscriptionError,
	TransientTranscriptionError,
	type TranscribeOptions,
} from './transcribe';
import { getAsrModel } from './config';
import {
	emitTranscriptionAttention,
	transcriptionNotificationPosture,
} from './transcriptionEvents';
import { writeAttachmentIndex, writeWorkingAttachmentIndex, refreshIndex } from './search';

let _queueLock: Promise<void> = Promise.resolve();

// Test seam: lets the suite stub the ASR call without a network.
let _transcribeImpl: typeof transcribeAudioFile = transcribeAudioFile;
export function __setTranscribeImplForTests(impl: typeof transcribeAudioFile | null): void {
	_transcribeImpl = impl ?? transcribeAudioFile;
}

export function isAudioType(contentType: string): boolean {
	return contentType.toLowerCase().startsWith('audio/');
}

export function queueAttachment(
	id: number,
	kind: 'capture' | 'working',
	storedFullPath: string,
	contentType: string,
	db: Database,
): void {
	_queueLock = _queueLock
		.then(() => processOne(id, kind, storedFullPath, contentType, db))
		.catch((e) => {
			console.error('[extraction-queue] unhandled queue error for attachment', id, ':', e);
		});
}

interface SweepRow {
	id: number;
	content_type: string;
	stored_path: string;
}

// Outstanding work is defined by extraction_status, never by the in-memory
// queue: pending (never started), processing (crash-interrupted), and failed
// rows whose reason marks them transient (AI server was down) all re-enqueue.
const SWEEP_WHERE = `extraction_status IN ('pending', 'processing')
       OR (extraction_status = 'failed' AND extraction_failure_reason LIKE 'transient:%')`;

export async function sweepPending(db: Database, attachmentsDir: string): Promise<void> {
	const captureRows = db
		.query(`SELECT id, content_type, stored_path FROM capture_attachments WHERE ${SWEEP_WHERE}`)
		.all() as SweepRow[];
	const workingRows = db
		.query(`SELECT id, content_type, stored_path FROM working_attachments WHERE ${SWEEP_WHERE}`)
		.all() as SweepRow[];

	for (const row of captureRows) {
		queueAttachment(row.id, 'capture', join(attachmentsDir, row.stored_path), row.content_type, db);
	}
	for (const row of workingRows) {
		queueAttachment(row.id, 'working', join(attachmentsDir, row.stored_path), row.content_type, db);
	}

	// Wait for all enqueued work to drain before returning (startup guarantee)
	await _queueLock;
}

/**
 * Periodically re-enqueue audio attachments whose transcription failed
 * transiently (AI-server outage). Mirrors the embedding backfill loop: the
 * outage delays the transcript, it never drops the job. Returns a stop
 * function for tests.
 */
export function startTranscriptRetryLoop(
	db: Database,
	attachmentsDir: string,
	intervalMs = 600_000,
): () => void {
	const timer = setInterval(() => {
		for (const table of ['capture_attachments', 'working_attachments'] as const) {
			const kind = table === 'capture_attachments' ? 'capture' : 'working';
			const rows = db
				.query(
					`SELECT id, content_type, stored_path FROM ${table}
	         WHERE extraction_status = 'failed'
	           AND extraction_failure_reason LIKE 'transient:%'
	           AND content_type LIKE 'audio/%'`,
				)
				.all() as SweepRow[];
			for (const row of rows) {
				queueAttachment(row.id, kind, join(attachmentsDir, row.stored_path), row.content_type, db);
			}
		}
	}, intervalMs);
	timer.unref?.();
	return () => clearInterval(timer);
}

function markFailed(db: Database, table: string, id: number, reason: string): void {
	db.prepare(
		`UPDATE ${table} SET extraction_status = 'failed', extraction_failure_reason = ? WHERE id = ?`,
	).run(reason.slice(0, 500), id);
}

async function processOne(
	id: number,
	kind: 'capture' | 'working',
	storedFullPath: string,
	contentType: string,
	db: Database,
): Promise<void> {
	const table = kind === 'capture' ? 'capture_attachments' : 'working_attachments';

	if (!existsSync(storedFullPath)) {
		markFailed(db, table, id, 'terminal: stored file is missing');
		return;
	}

	// processing marks in-flight work so a crash here is distinguishable from
	// never-started; the startup sweep re-enqueues both.
	db.prepare(
		`UPDATE ${table} SET extraction_status = 'processing', extraction_failure_reason = '' WHERE id = ?`,
	).run(id);

	if (isAudioType(contentType) && getAsrModel()) {
		await transcribeOne(id, kind, storedFullPath, contentType, db);
		return;
	}

	try {
		const { text } = await extractText(storedFullPath, contentType);

		if (text) {
			db.prepare(
				`UPDATE ${table} SET extraction_status = 'done', extracted_text = ? WHERE id = ?`,
			).run(text, id);
			writeIndexFile(id, kind, text, db);
			refreshIndex();
			return;
		}

		// No text extracted - decide based on content type
		if (isImageType(contentType)) {
			// Image with no OCR text (or OCR unconfigured) - generate a VLM description
			db.prepare(`UPDATE ${table} SET extraction_status = 'dark' WHERE id = ?`).run(id);
			await generateDescription(id, kind, storedFullPath, db);
		} else {
			// Non-image file with no extractable text (e.g. binary, unknown format) - done with empty text
			db.prepare(
				`UPDATE ${table} SET extraction_status = 'done', extracted_text = '' WHERE id = ?`,
			).run(id);
		}
	} catch (e) {
		markFailed(db, table, id, String(e));
		console.warn(`[extraction-queue] failed to process attachment ${id} (${kind}):`, e);
	}
}

async function transcribeOne(
	id: number,
	kind: 'capture' | 'working',
	storedFullPath: string,
	contentType: string,
	db: Database,
): Promise<void> {
	const table = kind === 'capture' ? 'capture_attachments' : 'working_attachments';

	const head = db
		.query(
			`SELECT id, confirmed, final_text FROM attachment_descriptions
	     WHERE attachment_kind = ? AND attachment_id = ? AND supersedes IS NULL`,
		)
		.get(kind, id) as { id: number; confirmed: number; final_text: string } | null;

	// A confirmed transcript is the user's text: re-runs re-index it and stop.
	// Idempotent by design (TX-7/RH-4) - no ASR call, no superseding row.
	if (head?.confirmed) {
		db.prepare(
			`UPDATE ${table} SET extraction_status = 'done', extracted_text = ? WHERE id = ?`,
		).run(head.final_text, id);
		writeIndexFile(id, kind, head.final_text, db);
		refreshIndex();
		return;
	}

	const row = db.query(`SELECT filename FROM ${table} WHERE id = ?`).get(id) as {
		filename: string;
	} | null;

	try {
		const { text, modelId } = await _transcribeImpl({
			storedFullPath,
			filename: row?.filename ?? 'audio',
			contentType,
		} satisfies TranscribeOptions);

		const now = new Date().toISOString();
		db.transaction(() => {
			if (text) {
				const { lastInsertRowid } = db
					.prepare(
						`INSERT INTO attachment_descriptions
	               (attachment_kind, attachment_id, produced_text, final_text, confirmed, model_id, supersedes, created_at)
	             VALUES (?, ?, ?, ?, 0, ?, NULL, ?)`,
					)
					.run(kind, id, text, text, modelId, now);
				if (head) {
					db.prepare('UPDATE attachment_descriptions SET supersedes = ? WHERE id = ?').run(
						lastInsertRowid,
						head.id,
					);
				}
			}
			db.prepare(
				`UPDATE ${table} SET extraction_status = 'done', extracted_text = ? WHERE id = ?`,
			).run(text, id);
		})();

		writeIndexFile(id, kind, text, db);
		refreshIndex();
		emitForCapture(db, kind, id, 'complete', text.slice(0, 120) || '(empty transcript)');
	} catch (e) {
		const transient = e instanceof TransientTranscriptionError;
		const terminal = e instanceof TerminalTranscriptionError;
		const detail = e instanceof Error ? e.message : String(e);
		// Unknown errors are treated as transient: a silent permanent drop is the
		// failure mode to prevent, and the retry loop is bounded per pass anyway.
		const reason = terminal ? `terminal: ${detail}` : `transient: ${detail}`;
		markFailed(db, table, id, reason);
		console.warn(
			`[extraction-queue] transcription ${transient || !terminal ? 'transiently ' : ''}failed for attachment ${id} (${kind}):`,
			detail,
		);
		emitForCapture(
			db,
			kind,
			id,
			terminal ? 'failed_terminal' : 'failed_transient',
			detail.slice(0, 120),
		);
	}
}

function emitForCapture(
	db: Database,
	kind: 'capture' | 'working',
	attachmentId: number,
	type: 'complete' | 'failed_terminal' | 'failed_transient',
	excerpt: string,
): void {
	// Transcription attention is inbox-oriented; working-doc audio stays silent.
	if (kind !== 'capture') return;
	const row = db
		.query('SELECT capture_id FROM capture_attachments WHERE id = ?')
		.get(attachmentId) as { capture_id: number } | null;
	if (!row) return;
	emitTranscriptionAttention(transcriptionNotificationPosture(), {
		type,
		capture_id: row.capture_id,
		attachment_id: attachmentId,
		excerpt,
	});
}

function writeIndexFile(id: number, kind: 'capture' | 'working', text: string, db: Database): void {
	if (kind === 'capture') {
		const row = db
			.query(
				'SELECT id, capture_id, filename, content_type, size_bytes, created_at FROM capture_attachments WHERE id = ?',
			)
			.get(id) as {
			id: number;
			capture_id: number;
			filename: string;
			content_type: string;
			size_bytes: number;
			created_at: string;
		} | null;
		if (row)
			writeAttachmentIndex(
				row.id,
				row.capture_id,
				row.filename,
				row.content_type,
				row.size_bytes,
				row.created_at,
				text,
			);
	} else {
		const row = db
			.query(
				'SELECT id, slug, filename, content_type, size_bytes, created_at FROM working_attachments WHERE id = ?',
			)
			.get(id) as {
			id: number;
			slug: string;
			filename: string;
			content_type: string;
			size_bytes: number;
			created_at: string;
		} | null;
		if (row)
			writeWorkingAttachmentIndex(
				row.id,
				row.slug,
				row.filename,
				row.content_type,
				row.size_bytes,
				row.created_at,
				text,
			);
	}
}

/** @internal test-only - await the in-flight queue lock chain. */
export async function __awaitQueueForTests(): Promise<void> {
	await _queueLock;
}
