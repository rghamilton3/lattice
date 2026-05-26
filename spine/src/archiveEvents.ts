import type { ArchiveQuality } from './archiveQuality';

export type NotificationPosture = 'quiet' | 'standard' | 'active';
export type ArchiveAttentionType = 'archive_recapture' | 'archive_recent';

export interface ArchiveAttentionInput {
	type: ArchiveAttentionType;
	title: string;
	url: string;
	archive_id: number;
	quality: ArchiveQuality;
}

export function shouldSendArchiveAttention(
	posture: NotificationPosture,
	input: ArchiveAttentionInput,
): boolean {
	if (posture === 'quiet') return false;
	if (input.type === 'archive_recapture') return posture === 'standard' || posture === 'active';
	return posture === 'active';
}

export function archiveAttentionMessage(input: ArchiveAttentionInput): string {
	const label =
		input.type === 'archive_recapture' ? 'Archive needs recapture' : 'Archive ready to review';
	return `${label}: ${input.title || input.url}\n${input.url}\nquality: ${input.quality}\narchive #${input.archive_id}`;
}
