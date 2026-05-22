// Canonical shapes of DB rows as returned by `bun:sqlite`. Routes should
// import these (or a `Pick<>` of them) rather than declare ad-hoc interfaces,
// so a column added in a migration causes a compile error at every read site.

export interface CaptureRow {
	id: number;
	text: string;
	source: string;
	captured_at: string;
	ingested_at: string;
	triaged_at: string | null;
	triage_action: string | null;
	task_due_date: string | null;
	task_priority: string | null;
	task_notes: string | null;
}

export interface FileIndexRow {
	id: number;
	machine_id: string;
	path: string;
	hash: string;
	mime_type: string;
	text: string;
	modified_at: string;
	size_bytes: number;
	indexed_at: string;
}

export interface CaptureAttachmentRow {
	id: number;
	capture_id: number;
	signal_id: string;
	content_type: string;
	filename: string;
	size_bytes: number;
	stored_path: string;
	created_at: string;
}
