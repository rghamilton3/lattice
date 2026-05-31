import { describe, expect, it, vi } from 'vitest';
import { deleteAnnotation, updateAnnotation } from './annotations';

describe('updateAnnotation', () => {
	it('patches the annotation comment through the shared API client', async () => {
		const fetchMock = vi.fn(
			async () =>
				new Response('{"annotation":{"id":"ann_123","comment":"updated"}}', {
					status: 200,
					headers: { 'content-type': 'application/json' }
				})
		);
		vi.stubGlobal('fetch', fetchMock);

		await expect(updateAnnotation('ann_123', 'updated')).resolves.toMatchObject({
			annotation: { id: 'ann_123', comment: 'updated' }
		});
		const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
		expect(url).toBe('/api/annotations/ann_123');
		expect(init).toMatchObject({
			headers: { 'Content-Type': 'application/json' },
			method: 'PATCH'
		});
		expect(init?.body).toBe('{"comment":"updated"}');

		vi.unstubAllGlobals();
	});
});

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
