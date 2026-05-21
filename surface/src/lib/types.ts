// ── Spine API response types ──────────────────────────────────────────────────

export interface SearchResult {
	id: number;
	score: number;
	snippet: string;
	body: string;
	path: string;
	kind: 'capture' | 'local-file' | 'working';
	machine_id?: string;
	slug?: string;
}

export interface Capture {
	id: number;
	text: string;
	source: string;
	captured_at: string;
	ingested_at: string;
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
	| { type: 'similar'; id: string; kind: 'capture' | 'local-file' | 'working' }
	| { type: 'mentions'; q: string }
	| { type: 'nearby'; timestamp: string; window_hours: number };

// ── Per-pane content ──────────────────────────────────────────────────────────

export type PaneContent =
	| { kind: 'empty' }
	| { kind: 'search'; query: string }
	| { kind: 'results'; source: LateralSource }
	| { kind: 'doc'; ref: DocRef }
	| { kind: 'editor'; slug: string };

// ── Workbench ─────────────────────────────────────────────────────────────────

export interface WorkbenchState {
	panes: [PaneContent] | [PaneContent, PaneContent];
	focusedPane: 0 | 1;
	vimMode: boolean;
}
