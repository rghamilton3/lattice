import { apiFetch } from './client';
import { logError } from '$lib/utils/logError';
import type { Capture } from '$lib/types';

export const captureKeys = {
	list: (limit: number) => ['captures', 'list', { limit }] as const,
	listAll: (limit: number) => ['captures', 'list-all', { limit }] as const,
	detail: (id: number) => ['captures', 'detail', id] as const
};

export function fetchCaptures(limit = 50, all = false): Promise<Capture[]> {
	const params = `limit=${limit}${all ? '&all=1' : ''}`;
	return apiFetch(`/api/captures?${params}`);
}

export function fetchCapture(id: number): Promise<Capture> {
	return apiFetch(`/api/captures/${id}`);
}

export interface CreateCaptureParams {
	text: string;
	source: string;
}

export function createCapture(params: CreateCaptureParams): Promise<{ id: number }> {
	return apiFetch('/api/captures', { method: 'POST', body: JSON.stringify(params) });
}

export type TriageAction = 'keep' | 'archive' | 'promote' | 'task' | 'skip';

export const TRIAGE_ACTION_LABEL: Record<TriageAction, string> = {
	keep: 'Kept',
	archive: 'Archived',
	promote: 'Promoted',
	task: 'Made task',
	skip: 'Skipped'
};

export async function triageCapture(id: number, action: TriageAction): Promise<void> {
	try {
		await apiFetch(`/api/captures/${id}/triage`, {
			method: 'POST',
			body: JSON.stringify({ action })
		});
	} catch (err) {
		logError('triageCapture', err);
		throw err;
	}
}
