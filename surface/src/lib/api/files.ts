import { apiFetch } from './client';
import type { FileEntry } from '$lib/types';

export interface FileListItem {
	id: number;
	machine_id: string;
	path: string;
	mime_type: string;
	modified_at: string;
}

export interface FileListPage {
	items: FileListItem[];
	next_cursor: string | null;
}

export const fileKeys = {
	list: (limit: number) => ['files', 'list', { limit }] as const,
	detail: (id: number) => ['files', 'detail', id] as const
};

export function fetchFileListPage(limit = 100, cursor?: string): Promise<FileListPage> {
	const params = new URLSearchParams({ limit: String(limit) });
	if (cursor) params.set('cursor', cursor);
	return apiFetch(`/api/files?${params.toString()}`);
}

export async function fetchFileList(limit = 100): Promise<FileListItem[]> {
	const page = await fetchFileListPage(limit);
	return page.items;
}

export function fetchFile(id: number): Promise<FileEntry> {
	return apiFetch(`/api/files/${id}`);
}

export function rawFileUrl(id: number): string {
	return `/api/files/${id}/raw`;
}
