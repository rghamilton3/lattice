import { describe, it, expect } from 'vitest';
import { shouldAdoptServerContent, clampPos } from './docSync';

describe('shouldAdoptServerContent', () => {
	it('adopts external changes when the editor matches the synced baseline', () => {
		// Doc was loaded as "a"; server now has "b" and the user has not edited.
		expect(shouldAdoptServerContent('a', 'b', 'a')).toBe(true);
	});

	it('does not clobber un-synced local edits', () => {
		// User typed "ab"; a save round-trip refetch returns the older "a".
		// The editor is ahead of the baseline, so it must not be overwritten.
		expect(shouldAdoptServerContent('ab', 'a', 'a')).toBe(false);
	});

	it('is a no-op when the server matches the editor', () => {
		expect(shouldAdoptServerContent('a', 'a', 'a')).toBe(false);
	});

	it('does not adopt when local edits coincidentally differ from a stale baseline', () => {
		// current !== baseline means the user has edits; never overwrite.
		expect(shouldAdoptServerContent('xyz', 'b', 'a')).toBe(false);
	});
});

describe('clampPos', () => {
	it('keeps in-range positions', () => {
		expect(clampPos(3, 10)).toBe(3);
	});
	it('clamps past the end (shorter server content)', () => {
		expect(clampPos(12, 5)).toBe(5);
	});
	it('clamps negative positions', () => {
		expect(clampPos(-1, 5)).toBe(0);
	});
});
