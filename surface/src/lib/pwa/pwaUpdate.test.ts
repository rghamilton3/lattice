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

	it('treats the first controller claim as current, not an update', async () => {
		const pwa = new PwaRuntimeState();
		const controllerChangeHandlers: (() => void)[] = [];
		const serviceWorker = {
			controller: null,
			addEventListener: vi.fn((type: string, handler: () => void) => {
				if (type === 'controllerchange') controllerChangeHandlers.push(handler);
			}),
			getRegistration: vi.fn().mockResolvedValue(undefined)
		};

		pwa.initialize(serviceWorker as unknown as ServiceWorkerContainer);
		await flushPromises();

		// clients.claim() after first install fires controllerchange on an
		// uncontrolled page. That is not an update.
		for (const handler of controllerChangeHandlers) handler();
		expect(pwa.updateState).toBe('current');
		expect(pwa.showUpdateNotice).toBe(false);
	});

	it('flags an update when a new worker takes over a controlled page', async () => {
		const pwa = new PwaRuntimeState();
		const controllerChangeHandlers: (() => void)[] = [];
		const serviceWorker = {
			controller: {} as ServiceWorker,
			addEventListener: vi.fn((type: string, handler: () => void) => {
				if (type === 'controllerchange') controllerChangeHandlers.push(handler);
			}),
			getRegistration: vi.fn().mockResolvedValue(undefined)
		};

		pwa.initialize(serviceWorker as unknown as ServiceWorkerContainer);
		await flushPromises();

		for (const handler of controllerChangeHandlers) handler();
		expect(pwa.updateState).toBe('available');
		expect(pwa.showUpdateNotice).toBe(true);
	});

	it('reloads for an update only after the waiting worker takes control', async () => {
		const reload = vi.fn();
		vi.stubGlobal('window', { location: { reload } });
		try {
			const pwa = new PwaRuntimeState();
			const postMessage = vi.fn();
			const registration = {
				waiting: { postMessage },
				addEventListener: vi.fn()
			} as unknown as ServiceWorkerRegistration;
			const controllerChangeHandlers: (() => void)[] = [];
			const serviceWorker = {
				controller: {} as ServiceWorker,
				addEventListener: vi.fn((type: string, handler: () => void) => {
					if (type === 'controllerchange') controllerChangeHandlers.push(handler);
				}),
				getRegistration: vi.fn().mockResolvedValue(registration)
			};

			pwa.initialize(serviceWorker as unknown as ServiceWorkerContainer);
			await flushPromises();
			expect(pwa.updateState).toBe('pending');

			pwa.reloadForUpdate();
			expect(postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
			expect(reload).not.toHaveBeenCalled();

			for (const handler of controllerChangeHandlers) handler();
			expect(reload).toHaveBeenCalledTimes(1);
			// The takeover we requested must not re-flag an update.
			expect(pwa.updateState).toBe('pending');
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it('does not flag a bogus update when registration fails on an uncontrolled page', async () => {
		const logSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		try {
			const pwa = new PwaRuntimeState();
			const serviceWorker = {
				controller: null,
				addEventListener: vi.fn(),
				getRegistration: vi.fn().mockRejectedValue(new Error('registration broke'))
			};

			pwa.initialize(serviceWorker as unknown as ServiceWorkerContainer);
			await flushPromises();

			expect(pwa.updateState).toBe('unknown');
			expect(pwa.showUpdateNotice).toBe(false);
			expect(logSpy).toHaveBeenCalled();
		} finally {
			logSpy.mockRestore();
		}
	});

	it('flags a failed update check on a controlled page', async () => {
		const logSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		try {
			const pwa = new PwaRuntimeState();
			const serviceWorker = {
				controller: {} as ServiceWorker,
				addEventListener: vi.fn(),
				getRegistration: vi.fn().mockRejectedValue(new Error('update check broke'))
			};

			pwa.initialize(serviceWorker as unknown as ServiceWorkerContainer);
			await flushPromises();

			expect(pwa.updateState).toBe('failed');
			expect(pwa.showUpdateNotice).toBe(true);
		} finally {
			logSpy.mockRestore();
		}
	});

	it('lets the user dismiss the update notice for the session', () => {
		const pwa = new PwaRuntimeState();
		pwa.updateState = 'pending';
		expect(pwa.showUpdateNotice).toBe(true);

		pwa.dismissUpdate();
		expect(pwa.showUpdateNotice).toBe(false);
	});
});
