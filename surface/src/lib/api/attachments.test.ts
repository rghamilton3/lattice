import { describe, expect, it, vi } from 'vitest';
import { displayFailureReason, isAudioAttachment, retryExtraction } from './attachments';

describe('retryExtraction', () => {
	it('posts to the retry endpoint through the shared API client', async () => {
		const fetchMock = vi.fn(
			async () =>
				new Response('{"status":"pending"}', {
					status: 200,
					headers: { 'content-type': 'application/json' }
				})
		);
		vi.stubGlobal('fetch', fetchMock);

		await expect(retryExtraction(7, 42)).resolves.toEqual({ status: 'pending' });
		expect(fetchMock).toHaveBeenCalledWith('/api/captures/7/attachments/42/retry-extraction', {
			headers: { 'Content-Type': 'application/json' },
			method: 'POST'
		});

		vi.unstubAllGlobals();
	});
});

describe('displayFailureReason', () => {
	it('strips the transient/terminal retry-policy prefixes', () => {
		expect(displayFailureReason('transient: ASR endpoint unreachable')).toBe(
			'ASR endpoint unreachable'
		);
		expect(displayFailureReason('terminal: audio could not be decoded')).toBe(
			'audio could not be decoded'
		);
	});

	it('passes through unprefixed reasons and empty strings', () => {
		expect(displayFailureReason('something else')).toBe('something else');
		expect(displayFailureReason('')).toBe('');
	});
});

describe('isAudioAttachment', () => {
	it('matches audio content types only', () => {
		expect(isAudioAttachment({ content_type: 'audio/aac' })).toBe(true);
		expect(isAudioAttachment({ content_type: 'image/png' })).toBe(false);
	});
});
