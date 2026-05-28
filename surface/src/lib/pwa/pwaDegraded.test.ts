import { describe, expect, it } from 'vitest';
import { PwaRuntimeState } from '$lib/state/pwa.svelte';

describe('PWA degraded runtime state', () => {
	it('classifies offline before service failures', () => {
		const pwa = new PwaRuntimeState();
		pwa.setNetworkState(false);
		pwa.classifyServiceError(500);

		expect(pwa.degradedKind).toBe('offline');
	});

	it('classifies authorization, missing-resource, and service failures', () => {
		const pwa = new PwaRuntimeState();
		pwa.setNetworkState(true);

		pwa.classifyServiceError(401);
		expect(pwa.degradedKind).toBe('authorization-required');

		pwa.classifyServiceError(404);
		expect(pwa.degradedKind).toBe('missing-resource');

		pwa.classifyServiceError(503);
		expect(pwa.degradedKind).toBe('service-unavailable');
	});

	it('recovers to live state after successful checks', () => {
		const pwa = new PwaRuntimeState();
		pwa.classifyServiceError(500);
		expect(pwa.degradedKind).toBe('service-unavailable');

		pwa.markServiceLive();
		expect(pwa.degradedKind).toBeNull();
	});
});
