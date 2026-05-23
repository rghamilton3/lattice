import { apiFetch, apiUpload } from './client';
import type { CaptureAttachment, WorkingAttachment } from '$lib/types';

export const attachmentKeys = {
	captureList: (captureId: number) => ['attachments', 'capture', captureId] as const,
	workingList: (slug: string) => ['attachments', 'working', slug] as const
};

export function fetchAttachments(captureId: number): Promise<CaptureAttachment[]> {
	return apiFetch(`/api/captures/${captureId}/attachments`);
}

export function uploadAttachment(captureId: number, file: File): Promise<CaptureAttachment> {
	const fd = new FormData();
	fd.append('file', file);
	return apiUpload(`/api/captures/${captureId}/attachments`, fd);
}

export function deleteAttachment(captureId: number, attachmentId: number): Promise<void> {
	return apiFetch(`/api/captures/${captureId}/attachments/${attachmentId}`, {
		method: 'DELETE'
	});
}

export function attachmentRawUrl(captureId: number, attachmentId: number): string {
	return `/api/captures/${captureId}/attachments/${attachmentId}/raw`;
}

export function fetchWorkingAttachments(slug: string): Promise<WorkingAttachment[]> {
	return apiFetch(`/api/working/${slug}/attachments`);
}

export function uploadWorkingAttachment(slug: string, file: File): Promise<WorkingAttachment> {
	const fd = new FormData();
	fd.append('file', file);
	return apiUpload(`/api/working/${slug}/attachments`, fd);
}

export function deleteWorkingAttachment(slug: string, attachmentId: number): Promise<void> {
	return apiFetch(`/api/working/${slug}/attachments/${attachmentId}`, {
		method: 'DELETE'
	});
}

export function workingAttachmentRawUrl(slug: string, attachmentId: number): string {
	return `/api/working/${slug}/attachments/${attachmentId}/raw`;
}
