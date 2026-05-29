import { ApiError, apiFetch } from './client';
import type {
	Annotation,
	AnnotationCreateInput,
	AnnotationListResponse,
	AnnotationTargetKind
} from '$lib/types';

export const annotationKeys = {
	all: ['annotations'] as const,
	list: (targetKind: AnnotationTargetKind | null, targetId: string | null) =>
		['annotations', 'list', targetKind, targetId] as const
};

export function fetchAnnotations(
	targetKind: AnnotationTargetKind,
	targetId: string
): Promise<AnnotationListResponse> {
	const params = new URLSearchParams({ target_kind: targetKind, target_id: targetId });
	return apiFetch(`/api/annotations?${params.toString()}`);
}

export function createAnnotation(
	input: AnnotationCreateInput
): Promise<{ annotation: Annotation }> {
	return apiFetch('/api/annotations', {
		method: 'POST',
		body: JSON.stringify(input)
	});
}

export async function deleteAnnotation(id: string): Promise<void> {
	const res = await fetch(`/api/annotations/${encodeURIComponent(id)}`, { method: 'DELETE' });
	if (!res.ok) {
		throw new ApiError(res.status, await res.text());
	}
}
