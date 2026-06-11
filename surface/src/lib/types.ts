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
			kind: 'annotation';
			id: string;
			score: number;
			snippet: string;
			body: string;
			path: string;
			title: string | null;
			target_kind: AnnotationTargetKind;
			target_id: string;
			annotation_id: string;
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
export type TriageAction = 'keep' | 'archive' | 'promote' | 'task' | 'skip';
export type ArchiveAction = 'keep' | 'archive' | 'recapture' | 'delete' | 'skip' | 'auto-kept';
export type InboxAction = TriageAction | ArchiveAction;

export interface InboxActionDescriptor {
	action: InboxAction;
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

export interface ArchiveDetail {
	id: number;
	url: string;
	title: string | null;
	archived_at: string;
	extracted_text: string;
	quality: ArchiveQuality;
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

// ── Tracking ─────────────────────────────────────────────────────────────────

export type TrackSource =
	| 'surface-manual'
	| 'surface-form'
	| 'surface-board'
	| 'surface-drag'
	| 'surface-followup'
	| string;

export interface TrackRecord {
	id: number;
	text: string;
	captured_at: string;
	ingested_at: string;
	source: TrackSource;
	displaced: boolean;
	photo_ref: string | null;
	supersedes: number | null;
}

export interface TrackDuplicateHint {
	track_id: number;
	text: string;
	captured_at: string;
	source: string;
	displaced: boolean;
	reason: string;
}

export interface TrackSearchResponse {
	query_id: number;
	primary: TrackRecord | null;
	history: TrackRecord[];
	empty_message: string | null;
	results: TrackRecord[];
}

export interface TrackDetailResponse {
	record: TrackRecord;
	same_item_history: TrackRecord[];
	related_location_tracks: TrackRecord[];
}

export interface TrackCreateResponse {
	id: number;
	possible_duplicates: TrackDuplicateHint[];
}

export interface TrackPhotoResponse {
	ref: string;
	filename: string;
	content_type: string;
	size_bytes: number;
	url: string;
}

export interface TrackBin {
	id: number;
	name: string;
	normalized_name: string;
	created_at: string;
	updated_at: string;
	archived_at: string | null;
}

export interface TrackBoardCard {
	item_key: string;
	item_phrase: string;
	current_track: TrackRecord;
	bin_id: number | null;
	bin_name: string | null;
	location_label: string | null;
	displaced: boolean;
	possible_duplicates: TrackDuplicateHint[];
}

export interface TrackBoardResponse {
	bins: TrackBin[];
	cards: TrackBoardCard[];
	unbinned: TrackBoardCard[];
	displaced_count: number;
}

export interface TrackFollowUp {
	query_id: number;
	query: string;
	queried_at: string;
	expires_at: string;
	opened_track: TrackRecord;
	affirmative_label: string;
}

// States of the spine extraction pipeline (017); all but `pending` are terminal.
// `dark` means the file yielded no text, so a machine description was (or will
// be) generated for it.
export type ExtractionStatus = 'pending' | 'done' | 'failed' | 'dark';

export interface BaseAttachment {
	id: number;
	filename: string;
	content_type: string;
	size_bytes: number;
	stored_path: string;
	created_at: string;
	extraction_status: ExtractionStatus;
}

// Head row of an attachment's description chain. `final_text` is what gets
// indexed; once `confirmed`, automated re-runs never overwrite it. `supersedes`
// means "superseded by" and is always null on API-returned head rows.
export interface AttachmentDescription {
	id: number;
	attachment_kind: 'capture' | 'working';
	attachment_id: number;
	produced_text: string;
	final_text: string;
	confirmed: boolean;
	model_id: string;
	supersedes: number | null;
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

export type AnnotationTargetKind = 'capture' | 'local_file' | 'working' | 'archive';

export interface Annotation {
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
	target_kind: AnnotationTargetKind;
	target_id: string;
	selection_start?: number | null;
	selection_end?: number | null;
	selection_text?: string | null;
	comment: string;
}

export interface AnnotationListResponse {
	annotations: Annotation[];
}

// ── Document reference ────────────────────────────────────────────────────────

export type DocRef =
	| { kind: 'capture'; id: number }
	| { kind: 'file'; id: number }
	| { kind: 'working'; slug: string }
	| { kind: 'archive'; id: number };

// ── Lateral action source ─────────────────────────────────────────────────────

export type LateralSource =
	| {
			kind: 'similar';
			id: number | string;
			docKind: 'capture' | 'local-file' | 'working' | 'archive';
	  }
	| { kind: 'mentions'; q: string }
	| { kind: 'nearby'; timestamp: string; window_hours: number };

// ── Per-pane content ──────────────────────────────────────────────────────────

export type PaneContent =
	| { kind: 'home' }
	| { kind: 'library'; query: string }
	| { kind: 'results'; source: LateralSource }
	| { kind: 'doc'; ref: DocRef; revealAnnotationId?: string }
	| { kind: 'editor'; slug: string }
	| { kind: 'tasks' }
	| { kind: 'tracking' }
	| { kind: 'tracking-detail'; trackId: number }
	| { kind: 'cluster'; clusterId: number };

// ── Resurfacing & Clustering ──────────────────────────────────────────────────

export interface ResurfacedItem {
	id: number;
	target_kind: 'capture' | 'working' | 'local-file';
	target_id: string;
	reason: string | null;
	snippet: string;
	title: string;
}

export interface ClusterMember {
	target_kind: 'capture' | 'working' | 'local-file';
	target_id: string;
	title: string;
	snippet: string;
}

export interface ClusterDetail {
	id: number;
	run_at: string;
	members: ClusterMember[];
}

// ── Workbench ─────────────────────────────────────────────────────────────────

export interface WorkbenchState {
	panes: [PaneContent] | [PaneContent, PaneContent];
	focusedPane: 0 | 1;
	vimMode: boolean;
}
