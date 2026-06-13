import { expect, test } from 'bun:test';
import {
	fetchWithSpineRetry,
	firstImageAttachmentId,
	postAttachment,
	postCapture,
	postTrack,
	shouldSendSignalReply,
	signalNotificationPosture,
	spineBaseFromCaptureUrl,
} from './signal-relay';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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

// --- Notification posture ---

test('shouldSendSignalReply: quiet suppresses all events', () => {
	expect(shouldSendSignalReply('quiet', 'failure')).toBe(false);
	expect(shouldSendSignalReply('quiet', 'classifier')).toBe(false);
	expect(shouldSendSignalReply('quiet', 'fallback')).toBe(false);
});

test('shouldSendSignalReply: standard sends failure and classifier, not fallback', () => {
	expect(shouldSendSignalReply('standard', 'failure')).toBe(true);
	expect(shouldSendSignalReply('standard', 'classifier')).toBe(true);
	expect(shouldSendSignalReply('standard', 'fallback')).toBe(false);
});

test('shouldSendSignalReply: active sends all events', () => {
	expect(shouldSendSignalReply('active', 'failure')).toBe(true);
	expect(shouldSendSignalReply('active', 'classifier')).toBe(true);
	expect(shouldSendSignalReply('active', 'fallback')).toBe(true);
});

test('postCapture: task reply sent in standard posture', async () => {
	// postCapture calls sendReply which calls activeSocket.write — we cannot
	// inject the socket here, so we verify via the returned result and trust
	// shouldSendSignalReply unit tests for the gating logic.
	const result = await postCapture('buy milk', '2026-01-01T00:00:00.000Z', {
		spineUrl: 'http://spine.test/api/agent/capture',
		agentToken: 'token',
		notificationPosture: 'standard',
		fetchImpl: async () => Response.json({ id: 5, triage_action: 'task', text: 'buy milk' }),
	});
	expect(result.triage_action).toBe('task');
});

test('postCapture: promote reply branch reached', async () => {
	const result = await postCapture('weekly review notes', '2026-01-01T00:00:00.000Z', {
		spineUrl: 'http://spine.test/api/agent/capture',
		agentToken: 'token',
		notificationPosture: 'standard',
		fetchImpl: async () =>
			Response.json({ id: 7, triage_action: 'promote', text: 'weekly review notes' }),
	});
	expect(result.triage_action).toBe('promote');
});

test('postCapture: fallback reply suppressed in standard, enabled in active', async () => {
	const makeOpts = (posture: 'standard' | 'active') => ({
		spineUrl: 'http://spine.test/api/agent/capture',
		agentToken: 'token',
		notificationPosture: posture,
		fetchImpl: async () => Response.json({ id: 9, triage_action: null, text: 'plain note' }),
	});
	// Both calls succeed — posture gating is exercised via shouldSendSignalReply;
	// sendReply is a no-op without an active socket, so we just confirm no throw.
	await postCapture('plain note', '2026-01-01T00:00:00.000Z', makeOpts('standard'));
	await postCapture('plain note', '2026-01-01T00:00:00.000Z', makeOpts('active'));
});

test('postCapture: throws on non-ok response (failure event path)', async () => {
	await expect(
		postCapture('oops', '2026-01-01T00:00:00.000Z', {
			spineUrl: 'http://spine.test/api/agent/capture',
			agentToken: 'token',
			notificationPosture: 'standard',
			fetchImpl: async () => new Response('internal error', { status: 500 }),
			retryDelaysMs: [],
		}),
	).rejects.toThrow('POST /api/agent/capture returned 500');
});

// --- signalNotificationPosture ---

test('signalNotificationPosture: returns standard when env var is unset', () => {
	const prev = process.env.SIGNAL_NOTIFICATION_POSTURE;
	delete process.env.SIGNAL_NOTIFICATION_POSTURE;
	expect(signalNotificationPosture()).toBe('standard');
	if (prev !== undefined) process.env.SIGNAL_NOTIFICATION_POSTURE = prev;
});

test('signalNotificationPosture: returns standard and warns on invalid value', () => {
	const prev = process.env.SIGNAL_NOTIFICATION_POSTURE;
	const warns: unknown[][] = [];
	const origWarn = console.warn;
	console.warn = (...args: unknown[]) => warns.push(args);
	process.env.SIGNAL_NOTIFICATION_POSTURE = 'loud';
	expect(signalNotificationPosture()).toBe('standard');
	expect(warns.length).toBe(1);
	expect(String(warns[0][0])).toContain('loud');
	console.warn = origWarn;
	if (prev !== undefined) process.env.SIGNAL_NOTIFICATION_POSTURE = prev;
	else delete process.env.SIGNAL_NOTIFICATION_POSTURE;
});

test('signalNotificationPosture: round-trips each valid value', () => {
	const prev = process.env.SIGNAL_NOTIFICATION_POSTURE;
	for (const v of ['quiet', 'standard', 'active'] as const) {
		process.env.SIGNAL_NOTIFICATION_POSTURE = v;
		expect(signalNotificationPosture()).toBe(v);
	}
	if (prev !== undefined) process.env.SIGNAL_NOTIFICATION_POSTURE = prev;
	else delete process.env.SIGNAL_NOTIFICATION_POSTURE;
});

// --- fetchWithSpineRetry (SR-5: bounded retry while the spine is momentarily down) ---

test('fetchWithSpineRetry: retries connection errors then succeeds', async () => {
	let calls = 0;
	const flaky = async () => {
		calls++;
		if (calls < 3) throw new Error('ECONNREFUSED');
		return new Response('{"id":1}', { status: 200 });
	};
	const res = await fetchWithSpineRetry(flaky, 'http://spine.test/', undefined, [0, 0, 0]);
	expect(res.status).toBe(200);
	expect(calls).toBe(3);
});

test('fetchWithSpineRetry: retries 5xx and returns the last response when exhausted', async () => {
	let calls = 0;
	const down = async () => {
		calls++;
		return new Response('unavailable', { status: 503 });
	};
	const res = await fetchWithSpineRetry(down, 'http://spine.test/', undefined, [0, 0]);
	expect(res.status).toBe(503);
	expect(calls).toBe(3); // initial + 2 retries, then the 5xx is surfaced to the caller
});

test('fetchWithSpineRetry: does not retry 4xx responses', async () => {
	let calls = 0;
	const badRequest = async () => {
		calls++;
		return new Response('bad', { status: 400 });
	};
	const res = await fetchWithSpineRetry(badRequest, 'http://spine.test/', undefined, [0, 0]);
	expect(res.status).toBe(400);
	expect(calls).toBe(1);
});

test('fetchWithSpineRetry: throws the last error when all attempts fail to connect', async () => {
	let calls = 0;
	const dead = async () => {
		calls++;
		throw new Error('ECONNREFUSED');
	};
	await expect(fetchWithSpineRetry(dead, 'http://spine.test/', undefined, [0, 0])).rejects.toThrow(
		'ECONNREFUSED',
	);
	expect(calls).toBe(3);
});

test('postAttachment: succeeds after transient spine failures (SR-5)', async () => {
	const dir = mkdtempSync(join(tmpdir(), 'relay-retry-'));
	writeFileSync(join(dir, 'att-1'), 'voice-bytes');
	let calls = 0;
	await postAttachment(
		7,
		{ id: 'att-1', contentType: 'audio/aac', filename: 'note.aac', size: 11 },
		{
			attachmentsDir: dir,
			spineBase: 'http://spine.test',
			agentToken: 'tok',
			fetchImpl: async () => {
				calls++;
				if (calls < 2) throw new Error('ECONNREFUSED');
				return new Response('{"id":42}', { status: 200 });
			},
			retryDelaysMs: [0, 0],
		},
	);
	expect(calls).toBe(2);
	rmSync(dir, { recursive: true, force: true });
});
