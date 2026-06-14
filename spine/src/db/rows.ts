// Canonical shapes of DB rows as returned by `bun:sqlite`. Routes should
// import these (or a `Pick<>` of them) rather than declare ad-hoc interfaces,
// so a column added in a migration causes a compile error at every read site.

export type ExtractionStatus = 'pending' | 'processing' | 'done' | 'failed' | 'dark';

export interface AttachmentDescriptionRow {
	id: number;
	attachment_kind: 'capture' | 'working';
	attachment_id: number;
	produced_text: string;
	final_text: string;
	confirmed: number;
	model_id: string;
	supersedes: number | null;
	created_at: string;
}

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
	task_completed_at: string | null;
	first_image_id: number | null;
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

export interface AgentStatusRow {
	machine_id: string;
	state: string;
	last_scan_at: string | null;
	last_indexed: number;
	last_skipped: number;
	last_errors: number;
	spine_ok: number;
	last_error_msg: string | null;
	reported_at: string;
}

export interface WorkingAttachmentRow {
	id: number;
	slug: string;
	content_type: string;
	filename: string;
	size_bytes: number;
	stored_path: string;
	created_at: string;
	extraction_status: ExtractionStatus;
	extraction_failure_reason: string;
	extracted_text: string;
}

export interface CaptureAttachmentRow {
	id: number;
	capture_id: number;
	signal_id: string;
	content_type: string;
	filename: string;
	size_bytes: number;
	stored_path: string;
	upload_source: string;
	created_at: string;
	extraction_status: ExtractionStatus;
	extraction_failure_reason: string;
	extracted_text: string;
}

export interface TrackRow {
	id: number;
	text: string;
	captured_at: string;
	ingested_at: string;
	source: string;
	displaced: number;
	photo_ref: string | null;
	supersedes: number | null;
}

export interface TrackQueryRow {
	id: number;
	query: string;
	queried_at: string;
	opened_track_id: number | null;
	loop_closed_at: string | null;
	loop_outcome: 'still_accurate' | 'moved' | 'skipped' | 'expired' | null;
}

export interface TrackBinRow {
	id: number;
	name: string;
	normalized_name: string;
	created_at: string;
	updated_at: string;
	archived_at: string | null;
}

export interface TrackPhoto {
	ref: string;
	filename: string;
	content_type: string;
	size_bytes: number;
	stored_path: string;
	created_at: string;
}

export interface TrackCreateRequest {
	text: string;
	captured_at: string;
	source: string;
	displaced: boolean;
	photo_ref?: string | null;
	supersedes?: number | null;
}

export interface TrackCreateResponse {
	id: number;
	possible_duplicates: TrackDuplicateHint[];
}

export interface TrackSearchResult {
	id: number;
	text: string;
	captured_at: string;
	ingested_at: string;
	source: string;
	displaced: boolean;
	photo_ref: string | null;
	supersedes: number | null;
}

export interface TrackSearchResponse {
	query_id: number;
	primary: TrackSearchResult | null;
	history: TrackSearchResult[];
	empty_message: string | null;
	results: TrackSearchResult[];
}

export interface TrackDuplicateHint {
	track_id: number;
	text: string;
	captured_at: string;
	source: string;
	displaced: boolean;
	reason: string;
}

export interface TrackFollowUp {
	query_id: number;
	query: string;
	queried_at: string;
	expires_at: string;
	opened_track: TrackSearchResult;
	affirmative_label: string;
}

export interface TrackDetailResponse {
	record: TrackSearchResult;
	same_item_history: TrackSearchResult[];
	related_location_tracks: TrackSearchResult[];
}

export interface TrackBoardCard {
	item_key: string;
	item_phrase: string;
	current_track: TrackSearchResult;
	bin_id: number | null;
	bin_name: string | null;
	location_label: string | null;
	displaced: boolean;
	possible_duplicates: TrackDuplicateHint[];
}

export interface TrackBoardResponse {
	bins: TrackBinRow[];
	cards: TrackBoardCard[];
	unbinned: TrackBoardCard[];
	displaced_count: number;
}

export interface TrackBinCreateResponse {
	bin: TrackBinRow;
}

export interface TrackBoardActionResponse {
	track_id: number;
	text: string;
	displaced: boolean;
	supersedes: number | null;
}

export interface TrackPhotoCreateResponse {
	ref: string;
	filename: string;
	content_type: string;
	size_bytes: number;
	url: string;
}

export type InferenceRole = 'embed' | 'rerank' | 'expand' | 'asr' | 'vlm';

// The 'global' row holds shared URL/key defaults that roles inherit.
export type InferenceConfigKey = InferenceRole | 'global';

export interface InferenceConfigRow {
	role: InferenceConfigKey;
	api_url: string | null;
	model: string | null;
	api_key: string | null;
	updated_at: string;
}

export interface AgentTokenRow {
	id: number;
	token: string;
	created_at: string;
	active: number; // SQLite boolean: 1 = active, 0 = inactive
}
