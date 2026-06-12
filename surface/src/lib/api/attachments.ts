import { apiFetch, apiUpload } from './client';
import type { AttachmentDescription, CaptureAttachment, WorkingAttachment } from '$lib/types';

export const attachmentKeys = {
	captureList: (captureId: number) => ['attachments', 'capture', captureId] as const,
	workingList: (slug: string) => ['attachments', 'working', slug] as const,
	captureDescription: (captureId: number, attachmentId: number) =>
		['attachments', 'capture', captureId, 'description', attachmentId] as const,
	workingDescription: (slug: string, attachmentId: number) =>
		['attachments', 'working', slug, 'description', attachmentId] as const
};

// At least one field must be present (server 400s on `{}` or empty final_text);
// un-confirming an already-confirmed description is rejected with 409.
export interface DescriptionPatch {
	final_text?: string;
	confirmed?: boolean;
}

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

export function isAudioAttachment(att: { content_type: string }): boolean {
	return att.content_type.startsWith('audio/');
}

// Spine prefixes failure reasons with 'transient: ' or 'terminal: ' for its
// own retry policy; strip them for display (the distinction is not actionable
// for the user: Retry works either way).
export function displayFailureReason(reason: string): string {
	return reason.replace(/^(transient|terminal): /, '');
}

export function retryExtraction(
	captureId: number,
	attachmentId: number
): Promise<{ status: 'pending' }> {
	return apiFetch(`/api/captures/${captureId}/attachments/${attachmentId}/retry-extraction`, {
		method: 'POST'
	});
}

export function fetchAttachmentDescription(
	captureId: number,
	attachmentId: number
): Promise<AttachmentDescription> {
	return apiFetch(`/api/captures/${captureId}/attachments/${attachmentId}/description`);
}

export function updateAttachmentDescription(
	captureId: number,
	attachmentId: number,
	patch: DescriptionPatch
): Promise<AttachmentDescription> {
	return apiFetch(`/api/captures/${captureId}/attachments/${attachmentId}/description`, {
		method: 'PATCH',
		body: JSON.stringify(patch)
	});
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

export function fetchWorkingAttachmentDescription(
	slug: string,
	attachmentId: number
): Promise<AttachmentDescription> {
	return apiFetch(`/api/working/${slug}/attachments/${attachmentId}/description`);
}

export function updateWorkingAttachmentDescription(
	slug: string,
	attachmentId: number,
	patch: DescriptionPatch
): Promise<AttachmentDescription> {
	return apiFetch(`/api/working/${slug}/attachments/${attachmentId}/description`, {
		method: 'PATCH',
		body: JSON.stringify(patch)
	});
}
