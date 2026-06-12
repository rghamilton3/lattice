import type { Database } from 'bun:sqlite';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { extractText, isImageType } from './extract';
import { generateDescription } from './describe';
import { writeAttachmentIndex, writeWorkingAttachmentIndex, refreshIndex } from './search';

let _queueLock: Promise<void> = Promise.resolve();

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

export async function sweepPending(db: Database, attachmentsDir: string): Promise<void> {
	const captureRows = db
		.query(
			`SELECT id, capture_id, filename, content_type, size_bytes, stored_path, created_at
         FROM capture_attachments WHERE extraction_status = 'pending'`,
		)
		.all() as Array<{
		id: number;
		capture_id: number;
		filename: string;
		content_type: string;
		size_bytes: number;
		stored_path: string;
		created_at: string;
	}>;

	const workingRows = db
		.query(
			`SELECT id, slug, filename, content_type, size_bytes, stored_path, created_at
         FROM working_attachments WHERE extraction_status = 'pending'`,
		)
		.all() as Array<{
		id: number;
		slug: string;
		filename: string;
		content_type: string;
		size_bytes: number;
		stored_path: string;
		created_at: string;
	}>;

	for (const row of captureRows) {
		const fullPath = join(attachmentsDir, row.stored_path);
		queueAttachment(row.id, 'capture', fullPath, row.content_type, db);
	}
	for (const row of workingRows) {
		const fullPath = join(attachmentsDir, row.stored_path);
		queueAttachment(row.id, 'working', fullPath, row.content_type, db);
	}

	// Wait for all enqueued work to drain before returning (startup guarantee)
	await _queueLock;
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
		db.prepare(`UPDATE ${table} SET extraction_status = 'failed' WHERE id = ?`).run(id);
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
		db.prepare(`UPDATE ${table} SET extraction_status = 'failed' WHERE id = ?`).run(id);
		console.warn(`[extraction-queue] failed to process attachment ${id} (${kind}):`, e);
	}
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
