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
	  };

export interface Capture {
	id: number;
	text: string;
	source: string;
	captured_at: string;
	ingested_at: string;
	triaged_at: string | null;
	triage_action: string | null;
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
	| { kind: 'search'; query: string }
	| { kind: 'results'; source: LateralSource }
	| { kind: 'doc'; ref: DocRef }
	| { kind: 'editor'; slug: string }
	| { kind: 'library' };

// ── Workbench ─────────────────────────────────────────────────────────────────

export interface WorkbenchState {
	panes: [PaneContent] | [PaneContent, PaneContent];
	focusedPane: 0 | 1;
	vimMode: boolean;
}
