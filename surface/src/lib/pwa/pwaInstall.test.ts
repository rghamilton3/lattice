import { describe, expect, it } from 'vitest';
import { PwaRuntimeState } from '$lib/state/pwa.svelte';
import type { BeforeInstallPromptEvent } from './types';

function installEvent(outcome: 'accepted' | 'dismissed' = 'accepted'): BeforeInstallPromptEvent {
	return {
		preventDefault: () => undefined,
		prompt: async () => undefined,
		userChoice: Promise.resolve({ outcome, platform: 'test' })
	} as BeforeInstallPromptEvent;
}

describe('PWA install runtime state', () => {
	it('captures install availability and hides it after dismissal', () => {
		const pwa = new PwaRuntimeState();
		pwa.displayMode = 'browser';
		pwa.captureInstallEvent(installEvent());

		expect(pwa.installAvailable).toBe(true);
		pwa.dismissInstall();
		expect(pwa.installAvailable).toBe(false);
		expect(pwa.installDismissed).toBe(true);
	});

	it('marks installed launches as standalone and clears the install event', () => {
		const pwa = new PwaRuntimeState();
		pwa.captureInstallEvent(installEvent());
		pwa.markInstalled();

		expect(pwa.displayMode).toBe('standalone');
		expect(pwa.installEvent).toBeNull();
		expect(pwa.installAvailable).toBe(false);
	});

	it('dismisses the prompt when the browser install choice is dismissed', async () => {
		const pwa = new PwaRuntimeState();
		pwa.displayMode = 'browser';
		pwa.captureInstallEvent(installEvent('dismissed'));

		await pwa.promptInstall();

		expect(pwa.installDismissed).toBe(true);
		expect(pwa.installEvent).toBeNull();
	});
});
