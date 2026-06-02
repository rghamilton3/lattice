import { apiFetch, apiUpload } from './client';
import type {
	TrackBoardResponse,
	TrackCreateResponse,
	TrackDetailResponse,
	TrackFollowUp,
	TrackPhotoResponse,
	TrackSearchResponse
} from '$lib/types';

export const trackKeys = {
	search: (q: string) => ['tracks', 'search', q] as const,
	detail: (id: number) => ['tracks', 'detail', id] as const,
	board: (displaced: 'all' | 'only' = 'all') => ['tracks', 'board', displaced] as const,
	followups: () => ['tracks', 'followups'] as const
};

export function searchTracks(q: string): Promise<TrackSearchResponse> {
	return apiFetch(`/api/tracks/search?q=${encodeURIComponent(q)}`);
}

export function openTrackQuery(queryId: number, trackId: number): Promise<{ ok: boolean }> {
	return apiFetch(`/api/tracks/queries/${queryId}/open`, {
		method: 'POST',
		body: JSON.stringify({ track_id: trackId })
	});
}

export function fetchTrackDetail(trackId: number): Promise<TrackDetailResponse> {
	return apiFetch(`/api/tracks/${trackId}`);
}

export function createTrack(input: {
	text: string;
	captured_at: string;
	source?: string;
	displaced?: boolean;
	photo_ref?: string | null;
	supersedes?: number | null;
}): Promise<TrackCreateResponse> {
	return apiFetch('/api/tracks/', {
		method: 'POST',
		body: JSON.stringify({ source: 'surface-form', displaced: false, ...input })
	});
}

export function uploadTrackPhoto(file: File): Promise<TrackPhotoResponse> {
	const form = new FormData();
	form.append('file', file);
	return apiUpload('/api/tracks/photos', form);
}

export function fetchTrackBoard(displaced: 'all' | 'only' = 'all'): Promise<TrackBoardResponse> {
	return apiFetch(`/api/tracks/board?displaced=${displaced}`);
}

export function createTrackBin(name: string): Promise<{ bin: TrackBoardResponse['bins'][number] }> {
	return apiFetch('/api/tracks/bins', { method: 'POST', body: JSON.stringify({ name }) });
}

export function moveTrackCard(input: {
	item_phrase: string;
	from_track_id: number;
	to_bin_id: number;
	source?: 'surface-board' | 'surface-drag';
	captured_at?: string;
}): Promise<{ track_id: number; text: string; displaced: boolean; supersedes: number | null }> {
	return apiFetch('/api/tracks/board/move', {
		method: 'POST',
		body: JSON.stringify({
			source: 'surface-board',
			captured_at: new Date().toISOString(),
			...input
		})
	});
}

export function checkoutTrackCard(input: {
	item_phrase: string;
	from_track_id: number;
	context?: string;
	captured_at?: string;
}): Promise<{ track_id: number; text: string; displaced: boolean; supersedes: number | null }> {
	return apiFetch('/api/tracks/board/checkout', {
		method: 'POST',
		body: JSON.stringify({ captured_at: new Date().toISOString(), ...input })
	});
}

export function fetchTrackFollowups(): Promise<{ followups: TrackFollowUp[] }> {
	return apiFetch('/api/tracks/followups');
}

export function markFollowupStillAccurate(
	queryId: number
): Promise<{ ok: boolean; outcome: string }> {
	return apiFetch(`/api/tracks/followups/${queryId}/still-accurate`, { method: 'POST' });
}

export function markFollowupMoved(
	queryId: number,
	input: { text: string; captured_at?: string; displaced?: boolean; photo_ref?: string | null }
): Promise<{ ok: boolean; outcome: string; track_id: number }> {
	return apiFetch(`/api/tracks/followups/${queryId}/moved`, {
		method: 'POST',
		body: JSON.stringify({
			source: 'surface-followup',
			captured_at: new Date().toISOString(),
			displaced: false,
			...input
		})
	});
}

export function skipTrackFollowup(queryId: number): Promise<{ ok: boolean; outcome: string }> {
	return apiFetch(`/api/tracks/followups/${queryId}/skip`, { method: 'POST' });
}
