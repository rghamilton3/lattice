import type { Database } from 'bun:sqlite';
import { deleteAnnotationIndex, refreshIndex, writeAnnotationIndex } from './search';

export const ANNOTATION_TARGET_KINDS = ['capture', 'local_file', 'working', 'archive'] as const;

export type AnnotationTargetKind = (typeof ANNOTATION_TARGET_KINDS)[number];

export interface AnnotationRow {
	id: string;
	target_kind: AnnotationTargetKind;
	target_id: string;
	selection_start: number | null;
	selection_end: number | null;
	selection_text: string | null;
	comment: string;
	created_at: string;
	updated_at: string;
}

export interface AnnotationCreateInput {
	target_kind: string;
	target_id: string;
	selection_start?: number | null;
	selection_end?: number | null;
	selection_text?: string | null;
	comment: string;
}

export class AnnotationValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'AnnotationValidationError';
	}
}

export class AnnotationNotFoundError extends Error {
	constructor(message = 'Annotation not found') {
		super(message);
		this.name = 'AnnotationNotFoundError';
	}
}

export class AnnotationTargetNotFoundError extends Error {
	constructor(message = 'Annotation target not found') {
		super(message);
		this.name = 'AnnotationTargetNotFoundError';
	}
}

export function isAnnotationTargetKind(value: string): value is AnnotationTargetKind {
	return (ANNOTATION_TARGET_KINDS as readonly string[]).includes(value);
}

export function validateAnnotationInput(input: AnnotationCreateInput): AnnotationCreateInput & {
	target_kind: AnnotationTargetKind;
	target_id: string;
	selection_start: number | null;
	selection_end: number | null;
	selection_text: string | null;
	comment: string;
} {
	if (!isAnnotationTargetKind(input.target_kind)) {
		throw new AnnotationValidationError('Invalid target kind');
	}

	const targetId = String(input.target_id ?? '').trim();
	if (!targetId) throw new AnnotationValidationError('Target id is required');

	const comment = String(input.comment ?? '').trim();
	if (!comment) throw new AnnotationValidationError('Comment is required');

	const selectionStart = input.selection_start ?? null;
	const selectionEnd = input.selection_end ?? null;
	if ((selectionStart === null) !== (selectionEnd === null)) {
		throw new AnnotationValidationError('Selection offsets must be provided together');
	}
	if (selectionStart !== null && selectionEnd !== null) {
		if (!Number.isInteger(selectionStart) || !Number.isInteger(selectionEnd)) {
			throw new AnnotationValidationError('Selection offsets must be integers');
		}
		if (selectionStart < 0 || selectionEnd <= selectionStart) {
			throw new AnnotationValidationError('Selection offsets are invalid');
		}
	}

	const selectionText = input.selection_text == null ? null : String(input.selection_text).trim();
	if (input.selection_text != null && !selectionText) {
		throw new AnnotationValidationError('Selection text cannot be empty');
	}

	return {
		...input,
		target_kind: input.target_kind,
		target_id: targetId,
		selection_start: selectionStart,
		selection_end: selectionEnd,
		selection_text: selectionText,
		comment,
	};
}

function targetExists(db: Database, kind: AnnotationTargetKind, id: string): boolean {
	if (kind === 'capture') {
		return Boolean(db.query('SELECT 1 FROM captures WHERE id = ?').get(Number(id)));
	}
	if (kind === 'local_file') {
		return Boolean(db.query('SELECT 1 FROM file_index WHERE id = ?').get(Number(id)));
	}
	if (kind === 'working') {
		return Boolean(db.query('SELECT 1 FROM working_docs WHERE slug = ?').get(id));
	}
	return Boolean(
		db
			.query(
				`SELECT 1 FROM archives
				 WHERE id = ? AND quality = 'good' AND superseded_by IS NULL AND deleted_at IS NULL`,
			)
			.get(Number(id)),
	);
}

export function listAnnotations(
	db: Database,
	targetKind: string,
	targetId: string,
): AnnotationRow[] {
	if (!isAnnotationTargetKind(targetKind))
		throw new AnnotationValidationError('Invalid target kind');
	const id = String(targetId ?? '').trim();
	if (!id) throw new AnnotationValidationError('Target id is required');
	return db
		.query(
			`SELECT id, target_kind, target_id, selection_start, selection_end, selection_text, comment, created_at, updated_at
			 FROM annotations
			 WHERE target_kind = ? AND target_id = ?
			 ORDER BY created_at ASC`,
		)
		.all(targetKind, id) as AnnotationRow[];
}

export function createAnnotation(db: Database, rawInput: AnnotationCreateInput): AnnotationRow {
	const input = validateAnnotationInput(rawInput);
	if (!targetExists(db, input.target_kind, input.target_id)) {
		throw new AnnotationTargetNotFoundError();
	}

	const id = `ann_${crypto.randomUUID()}`;
	const now = new Date().toISOString();
	const annotation = db.transaction(() => {
		db.prepare(
			`INSERT INTO annotations
			 (id, target_kind, target_id, selection_start, selection_end, selection_text, comment, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		).run(
			id,
			input.target_kind,
			input.target_id,
			input.selection_start,
			input.selection_end,
			input.selection_text,
			input.comment,
			now,
			now,
		);
		return db.query('SELECT * FROM annotations WHERE id = ?').get(id) as AnnotationRow;
	})();

	writeAnnotationIndex(annotation);
	refreshIndex();
	return annotation;
}

export function deleteAnnotation(db: Database, id: string): void {
	const row = db.query('SELECT id FROM annotations WHERE id = ?').get(id) as { id: string } | null;
	if (!row) throw new AnnotationNotFoundError();
	db.prepare('DELETE FROM annotations WHERE id = ?').run(id);
	deleteAnnotationIndex(id);
	refreshIndex();
}
