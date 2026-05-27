import { expect, test } from 'bun:test';
import {
	firstImageAttachmentId,
	postCapture,
	postTrack,
	spineBaseFromCaptureUrl,
} from './signal-relay';

test('spineBaseFromCaptureUrl accepts capture or track endpoint env values', () => {
	expect(spineBaseFromCaptureUrl('http://127.0.0.1:3000/api/agent/capture')).toBe(
		'http://127.0.0.1:3000',
	);
	expect(spineBaseFromCaptureUrl('http://127.0.0.1:3000/api/agent/track')).toBe(
		'http://127.0.0.1:3000',
	);
});

test('postCapture sends existing Signal capture payload to capture endpoint', async () => {
	const requests: { input: string | URL | Request; init?: RequestInit }[] = [];
	await postCapture('remember this', '2026-01-01T00:00:00.000Z', {
		spineUrl: 'http://spine.test/api/agent/capture',
		agentToken: 'token',
		fetchImpl: async (input, init) => {
			requests.push({ input, init });
			return Response.json({ id: 1, triage_action: null, text: 'remember this' });
		},
	});

	expect(String(requests[0].input)).toBe('http://spine.test/api/agent/capture');
	expect(JSON.parse(String(requests[0].init?.body))).toEqual({
		text: 'remember this',
		source: 'signal',
		captured_at: '2026-01-01T00:00:00.000Z',
	});
});

test('postTrack sends normal and displaced payloads to track endpoint', async () => {
	const bodies: unknown[] = [];
	const fetchImpl = async (_input: string | URL | Request, init?: RequestInit) => {
		bodies.push(JSON.parse(String(init?.body)));
		return Response.json({ id: bodies.length });
	};

	await postTrack(
		{ text: 'drill on shelf', captured_at: '2026-01-01T00:00:00.000Z', displaced: false },
		{ spineBase: 'http://spine.test', agentToken: 'token', fetchImpl },
	);
	await postTrack(
		{
			text: 'drill to kitchen',
			captured_at: '2026-01-01T00:00:01.000Z',
			displaced: true,
			photo_ref: 'photo-1',
		},
		{ spineBase: 'http://spine.test', agentToken: 'token', fetchImpl },
	);

	expect(bodies).toEqual([
		{
			text: 'drill on shelf',
			captured_at: '2026-01-01T00:00:00.000Z',
			displaced: false,
			source: 'signal-text',
		},
		{
			text: 'drill to kitchen',
			captured_at: '2026-01-01T00:00:01.000Z',
			displaced: true,
			photo_ref: 'photo-1',
			source: 'signal-photo',
		},
	]);
});

test('firstImageAttachmentId ignores non-image attachments', () => {
	expect(
		firstImageAttachmentId([
			{ id: 'voice-1', contentType: 'audio/ogg' },
			{ id: 'file-1', contentType: 'application/pdf' },
			{ id: 'photo-1', contentType: 'image/jpeg' },
		]),
	).toBe('photo-1');
	expect(firstImageAttachmentId([{ id: 'voice-1', contentType: 'audio/ogg' }])).toBeNull();
});
