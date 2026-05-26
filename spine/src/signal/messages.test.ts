import { expect, test } from 'bun:test';
import { parseSignalMessage } from './messages';

const selfNumber = '+15551234567';

function frame(message: string, attachments: unknown[] = []) {
	return {
		jsonrpc: '2.0',
		method: 'receive',
		params: {
			envelope: {
				sourceNumber: selfNumber,
				syncMessage: {
					sentMessage: {
						destination: selfNumber,
						message,
						timestamp: 1_767_225_600_000,
						attachments,
					},
				},
			},
		},
	};
}

test('parses /track as a normal tracking message', () => {
	const parsed = parseSignalMessage(frame('/track drill is on the bench'), selfNumber);
	expect(parsed).toMatchObject({
		action: 'track',
		captureText: '/track drill is on the bench',
		trackText: 'drill is on the bench',
		displaced: false,
		capturedAt: '2026-01-01T00:00:00.000Z',
	});
});

test('parses /checkout as a displaced tracking message', () => {
	const parsed = parseSignalMessage(frame('/checkout drill to kitchen'), selfNumber);
	expect(parsed).toMatchObject({
		action: 'track',
		trackText: 'drill to kitchen',
		displaced: true,
	});
});

test('blank tracking commands preserve existing capture behavior', () => {
	const parsed = parseSignalMessage(frame('/track'), selfNumber);
	expect(parsed).toMatchObject({
		action: 'capture',
		captureText: '/track',
		trackText: null,
		displaced: false,
	});
});

test('existing /capture-style text remains a capture', () => {
	const parsed = parseSignalMessage(frame('/capture remember the drill'), selfNumber);
	expect(parsed).toMatchObject({
		action: 'capture',
		captureText: '/capture remember the drill',
		trackText: null,
	});
});

test('photo captions keep tracking text and attachment ids', () => {
	const parsed = parseSignalMessage(
		frame('/track breaker panel label', [{ id: 'photo-1', contentType: 'image/jpeg', size: 10 }]),
		selfNumber,
	);
	expect(parsed).toMatchObject({ action: 'track', trackText: 'breaker panel label' });
	expect(parsed?.attachments[0]?.id).toBe('photo-1');
});
