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

type ArchiveAttentionListener = (input: ArchiveAttentionInput, message: string) => void;

const listeners = new Set<ArchiveAttentionListener>();

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

export function onArchiveAttention(listener: ArchiveAttentionListener): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

export function emitArchiveAttention(
	posture: NotificationPosture,
	input: ArchiveAttentionInput,
): void {
	if (!shouldSendArchiveAttention(posture, input)) return;
	const message = archiveAttentionMessage(input);
	if (listeners.size === 0) {
		console.info('[archive-attention]', message.replace(/\n/g, ' | '));
		return;
	}
	for (const listener of listeners) listener(input, message);
}

export function archiveNotificationPosture(): NotificationPosture {
	const value = process.env.ARCHIVE_NOTIFICATION_POSTURE;
	return value === 'quiet' || value === 'standard' || value === 'active' ? value : 'standard';
}
