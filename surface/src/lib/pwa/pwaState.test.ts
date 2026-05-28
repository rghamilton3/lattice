import { describe, expect, it } from 'vitest';
import { detectDisplayMode, detectNetworkState, isActiveTextEntry } from './browserState';
import { readInstallDismissed, writeInstallDismissed } from './installPreference';

function storage(): Storage {
	const data = new Map<string, string>();
	return {
		get length() {
			return data.size;
		},
		clear: () => data.clear(),
		getItem: (key) => data.get(key) ?? null,
		key: (index) => Array.from(data.keys())[index] ?? null,
		removeItem: (key) => data.delete(key),
		setItem: (key, value) => data.set(key, String(value))
	};
}

describe('PWA browser helpers', () => {
	it('detects standalone display mode safely', () => {
		expect(detectDisplayMode({ matchMedia: () => ({ matches: true }) as MediaQueryList })).toBe(
			'standalone'
		);
		expect(detectDisplayMode({ matchMedia: () => ({ matches: false }) as MediaQueryList })).toBe(
			'browser'
		);
		expect(detectDisplayMode(undefined)).toBe('unknown');
	});

	it('detects online and offline network state', () => {
		expect(detectNetworkState({ onLine: true })).toBe('online');
		expect(detectNetworkState({ onLine: false })).toBe('offline');
		expect(detectNetworkState(undefined)).toBe('unknown');
	});

	it('classifies active text entry elements', () => {
		const input = { tagName: 'INPUT', type: 'text' } as unknown as Element;
		const checkbox = { tagName: 'INPUT', type: 'checkbox' } as unknown as Element;
		const textarea = { tagName: 'TEXTAREA' } as unknown as Element;
		const div = { tagName: 'DIV', isContentEditable: true } as unknown as Element;

		expect(isActiveTextEntry(input)).toBe(true);
		expect(isActiveTextEntry(checkbox)).toBe(false);
		expect(isActiveTextEntry(textarea)).toBe(true);
		expect(isActiveTextEntry(div)).toBe(true);
		expect(isActiveTextEntry(null)).toBe(false);
	});
});

describe('PWA install preference', () => {
	it('persists and clears dismissal state', () => {
		const s = storage();
		expect(readInstallDismissed(s)).toBe(false);
		writeInstallDismissed(true, s);
		expect(readInstallDismissed(s)).toBe(true);
		writeInstallDismissed(false, s);
		expect(readInstallDismissed(s)).toBe(false);
	});

	it('tolerates unavailable or throwing storage', () => {
		const broken = {
			getItem: () => {
				throw new Error('blocked');
			},
			setItem: () => {
				throw new Error('blocked');
			},
			removeItem: () => {
				throw new Error('blocked');
			}
		} as unknown as Storage;

		expect(readInstallDismissed(undefined)).toBe(false);
		expect(readInstallDismissed(broken)).toBe(false);
		expect(() => writeInstallDismissed(true, broken)).not.toThrow();
	});
});
