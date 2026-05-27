import { apiFetch } from './client';
import type { ArchiveAction, ArchiveActionResponse, InboxPage } from '$lib/types';

export const inboxKeys = {
	list: (limit: number) => ['inbox', 'list', { limit }] as const
};

export function fetchInbox(limit = 50): Promise<InboxPage> {
	return apiFetch(`/api/inbox?limit=${limit}`);
}

export function archiveRawUrl(id: number): string {
	return `/api/archives/${id}/raw`;
}

export function applyArchiveAction(
	id: number,
	action: ArchiveAction
): Promise<ArchiveActionResponse> {
	return apiFetch(`/api/archives/${id}/action`, {
		method: 'POST',
		body: JSON.stringify({ action })
	});
}
