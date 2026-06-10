// API Contract: /api/resurfaced
// Implemented in: spine/src/routes/resurfaced.ts

// GET /api/resurfaced
// Returns today's surfaced items that have not been dismissed.
// "Today" = rows where DATE(surfaced_at) = DATE('now') in SQLite.

export interface ResurfacedItem {
	id: number;
	target_kind: 'capture' | 'working' | 'local-file';
	target_id: string;
	reason: string | null;
	snippet: string; // first ~200 chars of document text
	title: string;   // capture text truncated, working doc title, or file basename
}

export interface GetResurfacedResponse {
	items: ResurfacedItem[];
}

// POST /api/resurfaced/:id/dismiss
// Body: none
// Sets dismissed_at = now() on the surfaced row.
// 404 if id not found.

export interface DismissResurfacedResponse {
	ok: true;
}
