import { describe, expect, it, vi } from 'vitest';
import { deleteAnnotation } from './annotations';

describe('deleteAnnotation', () => {
	it('uses the shared API client and accepts 204 responses', async () => {
		const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
		vi.stubGlobal('fetch', fetchMock);

		await expect(deleteAnnotation('ann_123')).resolves.toBeUndefined();
		expect(fetchMock).toHaveBeenCalledWith('/api/annotations/ann_123', {
			headers: { 'Content-Type': 'application/json' },
			method: 'DELETE'
		});

		vi.unstubAllGlobals();
	});
});
