import { apiFetch } from './client';
import type { SearchResult } from '$lib/types';

export const searchKeys = {
	search: (q: string) => ['search', q] as const,
	similar: (id: number | string, kind: string) => ['similar', { id, kind }] as const,
	nearby: (timestamp: string, window_hours: number) =>
		['nearby', { timestamp, window_hours }] as const
};

export function fetchSearch(q: string): Promise<{ results: SearchResult[] }> {
	return apiFetch(`/api/search?q=${encodeURIComponent(q)}`);
}

export function fetchSimilar(
	id: number | string,
	kind: 'capture' | 'local-file' | 'working'
): Promise<{ results: SearchResult[] }> {
	return apiFetch(`/api/similar?id=${encodeURIComponent(id)}&kind=${kind}`);
}

export function fetchNearby(
	timestamp: string,
	window_hours = 72
): Promise<{ results: Array<{ id: number; kind: string; ts: string; snippet: string; machine_id?: string }> }> {
	return apiFetch(
		`/api/nearby?timestamp=${encodeURIComponent(timestamp)}&window_hours=${window_hours}`
	);
}
