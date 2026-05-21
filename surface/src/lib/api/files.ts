import { apiFetch } from './client';
import type { FileEntry } from '$lib/types';

export const fileKeys = {
	detail: (id: number) => ['files', 'detail', id] as const
};

export function fetchFile(id: number): Promise<FileEntry> {
	return apiFetch(`/api/files/${id}`);
}

export function rawFileUrl(id: number): string {
	return `/api/files/${id}/raw`;
}
