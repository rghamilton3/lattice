import { describe, it, expect } from 'vitest';
import { parseRef } from './deeplink';

describe('parseRef', () => {
	it('returns null for empty / missing colon input', () => {
		expect(parseRef('')).toBeNull();
		expect(parseRef('working')).toBeNull();
		expect(parseRef(':slug')).toBeNull(); // leading colon → empty kind
	});

	it('parses working:slug', () => {
		expect(parseRef('working:my-doc')).toEqual({ kind: 'working', slug: 'my-doc' });
	});

	it('parses capture:123', () => {
		expect(parseRef('capture:123')).toEqual({ kind: 'capture', id: 123 });
	});

	it('parses file:42', () => {
		expect(parseRef('file:42')).toEqual({ kind: 'file', id: 42 });
	});

	it('rejects capture / file with id <= 0', () => {
		expect(parseRef('capture:0')).toBeNull();
		expect(parseRef('capture:-1')).toBeNull();
		expect(parseRef('file:0')).toBeNull();
		expect(parseRef('file:-7')).toBeNull();
	});

	it('rejects non-numeric capture / file ids', () => {
		expect(parseRef('capture:abc')).toBeNull();
		expect(parseRef('file:xyz')).toBeNull();
	});

	it('rejects unknown kinds', () => {
		expect(parseRef('unknown:foo')).toBeNull();
	});

	it('preserves extra colons in the slug value', () => {
		expect(parseRef('working:has:colons')).toEqual({ kind: 'working', slug: 'has:colons' });
	});
});
