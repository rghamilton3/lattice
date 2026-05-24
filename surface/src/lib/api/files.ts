import { apiFetch } from './client';
import type { FileEntry } from '$lib/types';

export interface FileListItem {
	id: number;
	machine_id: string;
	path: string;
	mime_type: string;
	modified_at: string;
}

export const fileKeys = {
	list: (limit: number) => ['files', 'list', { limit }] as const,
	detail: (id: number) => ['files', 'detail', id] as const
};

export function fetchFileList(limit = 100): Promise<FileListItem[]> {
	return apiFetch(`/api/files?limit=${limit}`);
}

export function fetchFile(id: number): Promise<FileEntry> {
	return apiFetch(`/api/files/${id}`);
}

export function rawFileUrl(id: number): string {
	return `/api/files/${id}/raw`;
}
