import { describe, expect, it, afterEach } from 'bun:test';
import {
	emitTranscriptionAttention,
	onTranscriptionAttention,
	shouldSendTranscriptionAttention,
	transcriptionNotificationPosture,
	type TranscriptionAttentionInput,
} from '../../src/transcriptionEvents';

function input(type: TranscriptionAttentionInput['type']): TranscriptionAttentionInput {
	return { type, capture_id: 1, attachment_id: 2, excerpt: 'hello' };
}

describe('shouldSendTranscriptionAttention', () => {
	it('quiet drops everything', () => {
		expect(shouldSendTranscriptionAttention('quiet', input('complete'))).toBe(false);
		expect(shouldSendTranscriptionAttention('quiet', input('failed_terminal'))).toBe(false);
		expect(shouldSendTranscriptionAttention('quiet', input('failed_transient'))).toBe(false);
	});

	it('standard passes completions and terminal failures only', () => {
		expect(shouldSendTranscriptionAttention('standard', input('complete'))).toBe(true);
		expect(shouldSendTranscriptionAttention('standard', input('failed_terminal'))).toBe(true);
		expect(shouldSendTranscriptionAttention('standard', input('failed_transient'))).toBe(false);
	});

	it('active passes everything', () => {
		expect(shouldSendTranscriptionAttention('active', input('complete'))).toBe(true);
		expect(shouldSendTranscriptionAttention('active', input('failed_terminal'))).toBe(true);
		expect(shouldSendTranscriptionAttention('active', input('failed_transient'))).toBe(true);
	});
});

describe('emitTranscriptionAttention', () => {
	it('delivers to listeners and unsubscribes cleanly', () => {
		const seen: TranscriptionAttentionInput[] = [];
		const off = onTranscriptionAttention((i) => seen.push(i));
		emitTranscriptionAttention('standard', input('complete'));
		emitTranscriptionAttention('standard', input('failed_transient')); // gated out
		off();
		emitTranscriptionAttention('standard', input('complete')); // after unsubscribe
		expect(seen).toHaveLength(1);
		expect(seen[0].type).toBe('complete');
	});
});

describe('transcriptionNotificationPosture', () => {
	const prev = process.env.TRANSCRIPTION_NOTIFICATION_POSTURE;
	afterEach(() => {
		if (prev === undefined) delete process.env.TRANSCRIPTION_NOTIFICATION_POSTURE;
		else process.env.TRANSCRIPTION_NOTIFICATION_POSTURE = prev;
	});

	it('defaults to standard and accepts the three postures', () => {
		delete process.env.TRANSCRIPTION_NOTIFICATION_POSTURE;
		expect(transcriptionNotificationPosture()).toBe('standard');
		process.env.TRANSCRIPTION_NOTIFICATION_POSTURE = 'quiet';
		expect(transcriptionNotificationPosture()).toBe('quiet');
		process.env.TRANSCRIPTION_NOTIFICATION_POSTURE = 'bogus';
		expect(transcriptionNotificationPosture()).toBe('standard');
	});
});
