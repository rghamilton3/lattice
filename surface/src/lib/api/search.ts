import { apiFetch } from './client';
import type { SearchResult } from '$lib/types';

export type DocKind = 'capture' | 'local-file' | 'working' | 'archive';

export interface NearbyResult {
	id: number;
	kind: DocKind;
	ts: string;
	snippet: string;
	machine_id?: string;
}

export const searchKeys = {
	search: (q: string) => ['search', q] as const,
	similar: (id: number | string, kind: string) => ['similar', { id, kind }] as const,
	nearby: (timestamp: string, window_hours: number) =>
		['nearby', { timestamp, window_hours }] as const
};

export interface SearchResponse {
	results: SearchResult[];
	/** True when results are BM25 keyword-only because the inference endpoint is unavailable. */
	degraded: boolean;
}

export function fetchSearch(q: string): Promise<SearchResponse> {
	return apiFetch(`/api/search?q=${encodeURIComponent(q)}`);
}

export function fetchSimilar(
	id: number | string,
	kind: DocKind
): Promise<{ results: SearchResult[] }> {
	return apiFetch(`/api/similar?id=${encodeURIComponent(id)}&kind=${kind}`);
}

export function fetchNearby(
	timestamp: string,
	window_hours = 72
): Promise<{ results: NearbyResult[] }> {
	return apiFetch(
		`/api/nearby?timestamp=${encodeURIComponent(timestamp)}&window_hours=${window_hours}`
	);
}
