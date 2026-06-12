import { expect, it, beforeEach, afterEach } from 'bun:test';
import { buildTestApp, req, type TestApp } from '../helpers/app';
import { emitTranscriptionAttention } from '../../src/transcriptionEvents';

let app: TestApp;

beforeEach(async () => {
	app = await buildTestApp();
});

afterEach(async () => {
	await app?.cleanup();
});

it('bridges transcription attention onto the capture SSE stream', async () => {
	const res = await app.app.handle(
		req('/api/captures/stream', {
			headers: { 'x-forwarded-proto': 'https', 'x-authentik-username': 'test@local' },
		}),
	);
	expect(res.status).toBe(200);
	expect(res.headers.get('content-type')).toBe('text/event-stream');

	const reader = (res.body as ReadableStream<Uint8Array>).getReader();
	const decoder = new TextDecoder();

	// First chunk is the ": connected" comment
	const first = await reader.read();
	expect(decoder.decode(first.value)).toContain(': connected');

	emitTranscriptionAttention('standard', {
		type: 'complete',
		capture_id: 7,
		attachment_id: 3,
		excerpt: 'hello from the transcript',
	});

	const second = await reader.read();
	const frame = decoder.decode(second.value);
	expect(frame).toContain('event: attachment_transcribed');
	const data = JSON.parse(frame.split('data: ')[1].split('\n')[0]);
	expect(data).toEqual({
		type: 'complete',
		capture_id: 7,
		attachment_id: 3,
		excerpt: 'hello from the transcript',
	});

	emitTranscriptionAttention('standard', {
		type: 'failed_terminal',
		capture_id: 7,
		attachment_id: 3,
		excerpt: 'undecodable audio',
	});
	const third = await reader.read();
	expect(decoder.decode(third.value)).toContain('event: attachment_extraction_failed');

	await reader.cancel();
});
