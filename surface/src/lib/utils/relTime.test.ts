import { describe, it, expect } from 'vitest';
import { relTime } from './relTime';

describe('relTime', () => {
	const NOW = new Date('2026-05-21T12:00:00Z').getTime();

	it('returns "just now" for < 1 minute', () => {
		expect(relTime('2026-05-21T11:59:30Z', NOW)).toBe('just now');
	});

	it('formats minutes / hours / days', () => {
		expect(relTime('2026-05-21T11:30:00Z', NOW)).toBe('30m ago');
		expect(relTime('2026-05-21T09:00:00Z', NOW)).toBe('3h ago');
		expect(relTime('2026-05-19T12:00:00Z', NOW)).toBe('2d ago');
	});

	it('returns empty string for invalid input (no NaN leakage)', () => {
		expect(relTime('not a date', NOW)).toBe('');
		expect(relTime('', NOW)).toBe('');
	});
});
