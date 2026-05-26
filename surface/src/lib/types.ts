// ── Spine API response types ──────────────────────────────────────────────────

export type SearchResult =
	| {
			kind: 'capture';
			id: number;
			score: number;
			snippet: string;
			body: string;
			path: string;
			modified_at: string;
	  }
	| {
			kind: 'local-file';
			id: number;
			score: number;
			snippet: string;
			body: string;
			path: string;
			machine_id: string;
			modified_at: string;
	  }
	| {
			kind: 'working';
			id: number;
			score: number;
			snippet: string;
			body: string;
			path: string;
			slug: string;
			modified_at: string;
	  }
	| {
			kind: 'archive';
			id: number;
			score: number;
			snippet: string;
			body: string;
			path: string;
			url: string;
			title: string | null;
			modified_at: string;
	  }
	| {
			kind: 'capture-attachment';
			id: number;
			score: number;
			snippet: string;
			body: string;
			path: string;
			capture_id: number;
			filename: string;
			modified_at: string;
	  }
	| {
			kind: 'working-attachment';
			id: number;
			score: number;
			snippet: string;
			body: string;
			path: string;
			slug: string;
			filename: string;
			modified_at: string;
	  };

export interface Capture {
	id: number;
	text: string;
	source: string;
	captured_at: string;
	ingested_at: string;
	triaged_at: string | null;
	triage_action: string | null;
	task_due_date: string | null;
	task_priority: 'high' | 'medium' | 'low' | null;
	task_notes: string | null;
	first_image_id: number | null;
}

export type ArchiveQuality = 'good' | 'degraded' | 'failed';
export type ArchiveAction = 'keep' | 'archive' | 'recapture' | 'delete' | 'skip' | 'auto-kept';

export interface InboxActionDescriptor {
	action: string;
	label: string;
	shortcut: string;
	tone?: 'primary' | 'neutral' | 'destructive';
}

export type InboxItem =
	| {
			item_type: 'capture';
			id: string;
			capture_id: number;
			title: string;
			summary: string;
			source: string;
			created_at: string;
			capture: Capture;
			actions: InboxActionDescriptor[];
	  }
	| {
			item_type: 'archive_recapture' | 'archive_recent';
			id: string;
			archive_id: number;
			title: string;
			summary: string;
			url: string;
			source: string | null;
			quality: ArchiveQuality;
			created_at: string;
			actions: InboxActionDescriptor[];
	  };

export interface InboxPage {
	items: InboxItem[];
	next_cursor: string | null;
}

export interface ArchiveActionResponse {
	ok: boolean;
	url: string;
}

export type TaskPriority = 'high' | 'medium' | 'low';

export interface Task {
	id: number;
	text: string;
	source: string;
	captured_at: string;
	task_due_date: string | null;
	task_priority: TaskPriority | null;
	task_notes: string | null;
	task_completed_at: string | null;
}

export interface BaseAttachment {
	id: number;
	filename: string;
	content_type: string;
	size_bytes: number;
	stored_path: string;
	created_at: string;
}

export interface CaptureAttachment extends BaseAttachment {
	capture_id: number;
	upload_source: string;
}

export interface WorkingAttachment extends BaseAttachment {
	slug: string;
}

export interface FileEntry {
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

export interface WorkingDoc {
	slug: string;
	title: string;
	content: string;
	modified_at: string;
}

export interface WorkingDocListItem {
	slug: string;
	title: string;
	modified_at: string;
}

// ── Document reference ────────────────────────────────────────────────────────

export type DocRef =
	| { kind: 'capture'; id: number }
	| { kind: 'file'; id: number }
	| { kind: 'working'; slug: string };

// ── Lateral action source ─────────────────────────────────────────────────────

export type LateralSource =
	| { kind: 'similar'; id: number | string; docKind: 'capture' | 'local-file' | 'working' }
	| { kind: 'mentions'; q: string }
	| { kind: 'nearby'; timestamp: string; window_hours: number };

// ── Per-pane content ──────────────────────────────────────────────────────────

export type PaneContent =
	| { kind: 'home' }
	| { kind: 'library'; query: string }
	| { kind: 'results'; source: LateralSource }
	| { kind: 'doc'; ref: DocRef }
	| { kind: 'editor'; slug: string }
	| { kind: 'tasks' };

// ── Workbench ─────────────────────────────────────────────────────────────────

export interface WorkbenchState {
	panes: [PaneContent] | [PaneContent, PaneContent];
	focusedPane: 0 | 1;
	vimMode: boolean;
}
