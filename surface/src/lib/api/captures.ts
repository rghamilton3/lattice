import { apiFetch } from './client';
import type { Capture } from '$lib/types';

export const captureKeys = {
	list: (limit: number) => ['captures', 'list', { limit }] as const,
	detail: (id: number) => ['captures', 'detail', id] as const
};

export function fetchCaptures(limit = 50): Promise<Capture[]> {
	return apiFetch(`/api/captures?limit=${limit}`);
}

export function fetchCapture(id: number): Promise<Capture> {
	return apiFetch(`/api/captures/${id}`);
}
