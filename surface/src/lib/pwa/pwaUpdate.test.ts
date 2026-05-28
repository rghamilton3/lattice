import { describe, expect, it, vi } from 'vitest';
import { PwaRuntimeState } from '$lib/state/pwa.svelte';

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('PWA update runtime state', () => {
	it('shows user-controlled update states', () => {
		const pwa = new PwaRuntimeState();
		pwa.updateState = 'available';
		expect(pwa.showUpdateNotice).toBe(true);

		pwa.updateState = 'pending';
		expect(pwa.showUpdateNotice).toBe(true);

		pwa.updateState = 'failed';
		expect(pwa.showUpdateNotice).toBe(true);

		pwa.updateState = 'current';
		expect(pwa.showUpdateNotice).toBe(false);
	});

	it('defers update notices while text entry is active', () => {
		const pwa = new PwaRuntimeState();
		pwa.updateState = 'pending';
		pwa.activeTextEntry = true;

		expect(pwa.showUpdateNotice).toBe(false);

		pwa.activeTextEntry = false;
		expect(pwa.showUpdateNotice).toBe(true);
	});

	it('detects a waiting service worker and requests user-triggered activation', async () => {
		const pwa = new PwaRuntimeState();
		const postMessage = vi.fn();
		const registration = {
			waiting: { postMessage },
			addEventListener: vi.fn()
		} as unknown as ServiceWorkerRegistration;
		const serviceWorker = {
			controller: {} as ServiceWorker,
			addEventListener: vi.fn(),
			getRegistration: vi.fn().mockResolvedValue(registration)
		};

		pwa.initialize(serviceWorker as unknown as ServiceWorkerContainer);
		await flushPromises();

		expect(pwa.updateState).toBe('pending');
		pwa.requestUpdateActivation();
		expect(postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
	});
});
