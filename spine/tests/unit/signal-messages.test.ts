import { describe, expect, it } from 'bun:test';
import {
	placeholderText,
	parseSignalMessage,
	isRpcError,
	type ParseSkipReason,
	type ParseDebugHook,
} from '../../src/signal/messages';

const SELF = '+15551234567';

function envelope(overrides: Record<string, unknown> = {}, dataMessage: unknown = null) {
	return {
		jsonrpc: '2.0',
		method: 'receive',
		params: {
			envelope: {
				sourceNumber: SELF,
				timestamp: 1_700_000_000_000,
				dataMessage,
				...overrides,
			},
		},
	};
}

describe('placeholderText', () => {
	it('labels audio attachments as voice notes', () => {
		expect(placeholderText([{ contentType: 'audio/aac' }])).toBe('[voice note]');
	});

	it('uses filename when present', () => {
		expect(placeholderText([{ filename: 'image.jpg' }])).toBe('[attachment: image.jpg]');
	});

	it("falls back to 'attachment' when no filename and no audio match", () => {
		expect(placeholderText([{ contentType: 'image/png' }])).toBe('[attachment]');
	});

	it('joins multiple labels with commas', () => {
		expect(placeholderText([{ contentType: 'audio/aac' }, { filename: 'doc.pdf' }, {}])).toBe(
			'[voice note, attachment: doc.pdf, attachment]',
		);
	});
});

describe('parseSignalMessage', () => {
	it('returns null for non-receive method', () => {
		const msg = envelope({}, { message: 'hi' });
		msg.method = 'send';
		expect(parseSignalMessage(msg, SELF)).toBeNull();
	});

	it('returns null when message is not an object', () => {
		expect(parseSignalMessage('string', SELF)).toBeNull();
		expect(parseSignalMessage(null, SELF)).toBeNull();
		expect(parseSignalMessage(42, SELF)).toBeNull();
	});

	it('returns null when envelope is missing', () => {
		const msg = { method: 'receive', params: {} };
		expect(parseSignalMessage(msg, SELF)).toBeNull();
	});

	it("returns null when sourceNumber doesn't match self", () => {
		const msg = envelope({ sourceNumber: '+19999999999' }, { message: 'hi' });
		expect(parseSignalMessage(msg, SELF)).toBeNull();
	});

	it('returns null when dataMessage is null and no syncMessage exists', () => {
		const msg = envelope({}, null);
		expect(parseSignalMessage(msg, SELF)).toBeNull();
	});

	it('parses a Note-to-Self sync sent message', () => {
		const msg = {
			method: 'receive',
			params: {
				envelope: {
					sourceNumber: SELF,
					timestamp: 1_700_000_000_000,
					syncMessage: {
						sentMessage: {
							destination: SELF,
							timestamp: 1_700_000_000_500,
							message: '  note to self  ',
						},
					},
				},
			},
		};
		const parsed = parseSignalMessage(msg, SELF);
		expect(parsed).toEqual({
			action: 'capture',
			captureText: 'note to self',
			trackText: null,
			displaced: false,
			// sentMessage.timestamp takes precedence over envelope.timestamp.
			capturedAt: new Date(1_700_000_000_500).toISOString(),
			attachments: [],
			sourceNumber: SELF,
			sourceTimestamp: 1_700_000_000_500,
		});
	});

	it('parses sync sent attachments', () => {
		const msg = {
			method: 'receive',
			params: {
				envelope: {
					sourceNumber: SELF,
					timestamp: 1_700_000_000_000,
					syncMessage: {
						sentMessage: {
							destination: SELF,
							message: '',
							attachments: [{ contentType: 'audio/aac' }],
						},
					},
				},
			},
		};
		const parsed = parseSignalMessage(msg, SELF);
		expect(parsed?.captureText).toBe('[voice note]');
		expect(parsed?.attachments.length).toBe(1);
	});

	it('parses direct data-message attachments', () => {
		const msg = envelope(
			{},
			{
				message: 'see file',
				attachments: [{ id: 'att-1', contentType: 'application/pdf', filename: 'doc.pdf' }],
			},
		);
		const parsed = parseSignalMessage(msg, SELF);
		expect(parsed?.captureText).toBe('see file');
		expect(parsed?.attachments).toEqual([
			{ id: 'att-1', contentType: 'application/pdf', filename: 'doc.pdf' },
		]);
	});

	it('returns null for sync sent to someone else', () => {
		const msg = {
			method: 'receive',
			params: {
				envelope: {
					sourceNumber: SELF,
					timestamp: 1_700_000_000_000,
					syncMessage: {
						sentMessage: {
							destination: '+19999999999',
							timestamp: 1_700_000_000_500,
							message: 'hey friend',
						},
					},
				},
			},
		};
		expect(parseSignalMessage(msg, SELF)).toBeNull();
	});

	it('returns null for sync sent to a group (no destination)', () => {
		const msg = {
			method: 'receive',
			params: {
				envelope: {
					sourceNumber: SELF,
					timestamp: 1_700_000_000_000,
					syncMessage: {
						sentMessage: {
							message: 'group message',
						},
					},
				},
			},
		};
		expect(parseSignalMessage(msg, SELF)).toBeNull();
	});

	it('returns null when text is empty and no attachments', () => {
		const msg = envelope({}, { message: '   ' });
		expect(parseSignalMessage(msg, SELF)).toBeNull();
	});

	it('parses a plain text message', () => {
		const msg = envelope({}, { message: '  hello world  ' });
		const parsed = parseSignalMessage(msg, SELF);
		expect(parsed).toEqual({
			action: 'capture',
			captureText: 'hello world',
			trackText: null,
			displaced: false,
			capturedAt: new Date(1_700_000_000_000).toISOString(),
			attachments: [],
			sourceNumber: SELF,
			sourceTimestamp: 1_700_000_000_000,
		});
	});

	it('exposes sourceNumber and sourceTimestamp for reaction targeting', () => {
		const msg = envelope({ timestamp: 1_800_000_000_000 }, { message: 'hi' });
		const parsed = parseSignalMessage(msg, SELF);
		expect(parsed?.sourceNumber).toBe(SELF);
		expect(parsed?.sourceTimestamp).toBe(1_800_000_000_000);
	});

	it('uses now() for sourceTimestamp when envelope.timestamp is missing', () => {
		const fixed = new Date('2026-05-21T12:00:00.000Z');
		const msg = envelope({ timestamp: undefined }, { message: 'hi' });
		const parsed = parseSignalMessage(msg, SELF, () => fixed);
		expect(parsed?.sourceTimestamp).toBe(fixed.getTime());
	});

	it('uses payload timestamp before envelope timestamp', () => {
		const msg = envelope(
			{ timestamp: 1_700_000_000_000 },
			{ message: 'hi', timestamp: 1_800_000_000_000 },
		);
		const parsed = parseSignalMessage(msg, SELF);
		expect(parsed?.capturedAt).toBe(new Date(1_800_000_000_000).toISOString());
		expect(parsed?.sourceTimestamp).toBe(1_800_000_000_000);
	});

	it('uses placeholder text when message is empty but attachments are present', () => {
		const msg = envelope(
			{},
			{
				message: '',
				attachments: [{ contentType: 'audio/aac' }],
			},
		);
		const parsed = parseSignalMessage(msg, SELF);
		expect(parsed?.captureText).toBe('[voice note]');
		expect(parsed?.attachments.length).toBe(1);
	});

	it('uses real message when both text and attachments are present', () => {
		const msg = envelope(
			{},
			{
				message: 'see attached',
				attachments: [{ filename: 'doc.pdf' }],
			},
		);
		const parsed = parseSignalMessage(msg, SELF);
		expect(parsed?.captureText).toBe('see attached');
		expect(parsed?.attachments.length).toBe(1);
	});

	it('falls back to current time when envelope.timestamp is missing', () => {
		const fixed = new Date('2026-05-21T12:00:00.000Z');
		const msg = envelope({ timestamp: undefined }, { message: 'hi' });
		const parsed = parseSignalMessage(msg, SELF, () => fixed);
		expect(parsed?.capturedAt).toBe(fixed.toISOString());
	});
});

describe('parseSignalMessage debug hook', () => {
	function mkHook(): { reasons: ParseSkipReason[]; hook: ParseDebugHook } {
		const reasons: ParseSkipReason[] = [];
		return { reasons, hook: { skip: (r) => reasons.push(r) } };
	}

	it('reports each skip reason exactly once per invocation', () => {
		const cases: Array<[ParseSkipReason, unknown]> = [
			['wrong-method', { method: 'send', params: {} }],
			['no-envelope', { method: 'receive', params: {} }],
			['wrong-sender', envelope({ sourceNumber: '+19999999999' }, { message: 'hi' })],
			[
				'wrong-destination',
				{
					method: 'receive',
					params: {
						envelope: {
							sourceNumber: SELF,
							timestamp: 1_700_000_000_000,
							syncMessage: { sentMessage: { destination: '+19999999999', message: 'hi' } },
						},
					},
				},
			],
			['no-message-payload', envelope({}, null)],
			['empty-payload', envelope({}, { message: '   ' })],
		];
		for (const [expected, msg] of cases) {
			const { reasons, hook } = mkHook();
			expect(parseSignalMessage(msg, SELF, undefined, hook)).toBeNull();
			expect(reasons).toEqual([expected]);
		}
	});

	it('does not call skip on a successful parse', () => {
		const { reasons, hook } = mkHook();
		const msg = envelope({}, { message: 'hi' });
		expect(parseSignalMessage(msg, SELF, undefined, hook)).not.toBeNull();
		expect(reasons).toEqual([]);
	});
});

describe('isRpcError', () => {
	it('returns true for objects with an error key', () => {
		expect(isRpcError({ error: { code: -1, message: 'boom' } })).toBe(true);
	});

	it('returns false for non-objects', () => {
		expect(isRpcError(null)).toBe(false);
		expect(isRpcError('err')).toBe(false);
	});

	it('returns false when error is not an object', () => {
		expect(isRpcError({ error: 'string' })).toBe(false);
	});
});
