import { apiFetch } from './client';
import type { WorkingDoc, WorkingDocListItem } from '$lib/types';

export const workingKeys = {
	list: () => ['working', 'list'] as const,
	detail: (slug: string) => ['working', 'detail', slug] as const
};

export function fetchWorkingList(): Promise<WorkingDocListItem[]> {
	return apiFetch('/api/working');
}

export function fetchWorking(slug: string): Promise<WorkingDoc> {
	return apiFetch(`/api/working/${slug}`);
}

export interface CreateWorkingParams {
	title: string;
	content?: string;
	seed_capture_id?: number;
	seed_file_id?: number;
}

export function createWorking(params: CreateWorkingParams): Promise<{ slug: string }> {
	return apiFetch('/api/working', { method: 'POST', body: JSON.stringify(params) });
}

export function updateWorking(slug: string, content: string): Promise<{ ok: boolean }> {
	return apiFetch(`/api/working/${slug}`, { method: 'PUT', body: JSON.stringify({ content }) });
}

export function deleteWorking(slug: string): Promise<{ ok: boolean }> {
	return apiFetch(`/api/working/${slug}`, { method: 'DELETE' });
}
