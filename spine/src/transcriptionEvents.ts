import type { NotificationPosture } from './archiveEvents';

export type TranscriptionAttentionType = 'complete' | 'failed_terminal' | 'failed_transient';

export interface TranscriptionAttentionInput {
	type: TranscriptionAttentionType;
	capture_id: number;
	attachment_id: number;
	// First ~120 chars of the transcript on completion; failure reason on failure.
	excerpt: string;
}

type TranscriptionAttentionListener = (input: TranscriptionAttentionInput, message: string) => void;

const listeners = new Set<TranscriptionAttentionListener>();

export function shouldSendTranscriptionAttention(
	posture: NotificationPosture,
	input: TranscriptionAttentionInput,
): boolean {
	if (posture === 'quiet') return false;
	// Standard: completions and terminal failures (the recoverable surface state).
	// Active additionally surfaces transient exhaustion.
	if (input.type === 'failed_transient') return posture === 'active';
	return true;
}

export function transcriptionAttentionMessage(input: TranscriptionAttentionInput): string {
	const label = input.type === 'complete' ? 'Transcript ready' : 'Transcription failed (retryable)';
	return `${label}: ${input.excerpt}\ncapture #${input.capture_id} attachment #${input.attachment_id}`;
}

export function onTranscriptionAttention(listener: TranscriptionAttentionListener): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

export function emitTranscriptionAttention(
	posture: NotificationPosture,
	input: TranscriptionAttentionInput,
): void {
	if (!shouldSendTranscriptionAttention(posture, input)) return;
	const message = transcriptionAttentionMessage(input);
	if (listeners.size === 0) {
		console.info('[transcription-attention]', message.replace(/\n/g, ' | '));
		return;
	}
	for (const listener of listeners) listener(input, message);
}

export function transcriptionNotificationPosture(): NotificationPosture {
	const value = process.env.TRANSCRIPTION_NOTIFICATION_POSTURE;
	return value === 'quiet' || value === 'standard' || value === 'active' ? value : 'standard';
}
