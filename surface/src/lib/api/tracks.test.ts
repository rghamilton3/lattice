import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	checkoutTrackCard,
	createTrack,
	createTrackBin,
	fetchTrackBoard,
	fetchTrackDetail,
	fetchTrackFollowups,
	markFollowupMoved,
	markFollowupStillAccurate,
	moveTrackCard,
	openTrackQuery,
	searchTracks,
	skipTrackFollowup,
	trackKeys,
	uploadTrackPhoto
} from './tracks';

afterEach(() => {
	vi.unstubAllGlobals();
});

function mockJson(body: unknown) {
	const fetchMock = vi.fn<typeof fetch>(
		async () =>
			new Response(JSON.stringify(body), {
				status: 200,
				headers: { 'content-type': 'application/json' }
			})
	);
	vi.stubGlobal('fetch', fetchMock);
	return fetchMock;
}

describe('trackKeys', () => {
	it('returns stable tracking query keys', () => {
		expect(trackKeys.search('drill')).toEqual(['tracks', 'search', 'drill']);
		expect(trackKeys.detail(7)).toEqual(['tracks', 'detail', 7]);
		expect(trackKeys.board()).toEqual(['tracks', 'board', 'all']);
		expect(trackKeys.board('only')).toEqual(['tracks', 'board', 'only']);
		expect(trackKeys.followups()).toEqual(['tracks', 'followups']);
	});
});

describe('tracking API wrappers', () => {
	it('calls search, query-open, and detail endpoints', async () => {
		const fetchMock = mockJson({ ok: true });

		await searchTracks('keys & shelf');
		await openTrackQuery(3, 9);
		await fetchTrackDetail(9);

		expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/tracks/search?q=keys%20%26%20shelf');
		expect(fetchMock.mock.calls[1]).toEqual([
			'/api/tracks/queries/3/open',
			{
				headers: { 'Content-Type': 'application/json' },
				method: 'POST',
				body: '{"track_id":9}'
			}
		]);
		expect(fetchMock.mock.calls[2]?.[0]).toBe('/api/tracks/9');
	});

	it('posts browser-created tracks and uploads photos', async () => {
		const fetchMock = mockJson({ id: 12, possible_duplicates: [] });
		await createTrack({ text: 'keys by router', captured_at: '2026-01-01T00:00:00.000Z' });

		expect(fetchMock.mock.calls[0]).toEqual([
			'/api/tracks/',
			{
				headers: { 'Content-Type': 'application/json' },
				method: 'POST',
				body: JSON.stringify({
					source: 'surface-form',
					displaced: false,
					text: 'keys by router',
					captured_at: '2026-01-01T00:00:00.000Z'
				})
			}
		]);

		const uploadMock = vi.fn(
			async () =>
				new Response(JSON.stringify({ ref: 'photo-1' }), {
					status: 200,
					headers: { 'content-type': 'application/json' }
				})
		);
		vi.stubGlobal('fetch', uploadMock);
		const file = new File(['image'], 'item.png', { type: 'image/png' });
		await uploadTrackPhoto(file);

		const [url, init] = uploadMock.mock.calls[0] as unknown as [string, RequestInit];
		expect(url).toBe('/api/tracks/photos');
		expect(init.method).toBe('POST');
		expect(init.body).toBeInstanceOf(FormData);
		expect((init.body as FormData).get('file')).toBe(file);
	});

	it('calls board, bin, move, and checkout endpoints with defaults', async () => {
		const fetchMock = mockJson({ ok: true });

		await fetchTrackBoard('only');
		await createTrackBin('Workbench');
		await moveTrackCard({ item_phrase: 'drill', from_track_id: 4, to_bin_id: 2 });
		await checkoutTrackCard({ item_phrase: 'drill', from_track_id: 5, context: 'with me' });

		expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/tracks/board?displaced=only');
		expect(fetchMock.mock.calls[1]).toEqual([
			'/api/tracks/bins',
			{
				headers: { 'Content-Type': 'application/json' },
				method: 'POST',
				body: '{"name":"Workbench"}'
			}
		]);
		const moveBody = JSON.parse((fetchMock.mock.calls[2]?.[1] as RequestInit).body as string) as {
			source: string;
			captured_at: string;
			item_phrase: string;
			from_track_id: number;
			to_bin_id: number;
		};
		expect(moveBody).toMatchObject({
			source: 'surface-board',
			item_phrase: 'drill',
			from_track_id: 4,
			to_bin_id: 2
		});
		expect(Date.parse(moveBody.captured_at)).not.toBeNaN();
		const checkoutBody = JSON.parse(
			(fetchMock.mock.calls[3]?.[1] as RequestInit).body as string
		) as {
			captured_at: string;
			item_phrase: string;
			from_track_id: number;
			context: string;
		};
		expect(checkoutBody).toMatchObject({
			item_phrase: 'drill',
			from_track_id: 5,
			context: 'with me'
		});
		expect(Date.parse(checkoutBody.captured_at)).not.toBeNaN();
	});

	it('calls follow-up endpoints and uses surface-followup for moved records', async () => {
		const fetchMock = mockJson({ ok: true });

		await fetchTrackFollowups();
		await markFollowupStillAccurate(1);
		await markFollowupMoved(2, { text: 'keys moved to kitchen drawer' });
		await skipTrackFollowup(3);

		expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/tracks/followups');
		expect(fetchMock.mock.calls[1]).toEqual([
			'/api/tracks/followups/1/still-accurate',
			{ headers: { 'Content-Type': 'application/json' }, method: 'POST' }
		]);
		const movedBody = JSON.parse((fetchMock.mock.calls[2]?.[1] as RequestInit).body as string) as {
			source: string;
			captured_at: string;
			displaced: boolean;
			text: string;
		};
		expect(movedBody).toMatchObject({
			source: 'surface-followup',
			displaced: false,
			text: 'keys moved to kitchen drawer'
		});
		expect(Date.parse(movedBody.captured_at)).not.toBeNaN();
		expect(fetchMock.mock.calls[3]).toEqual([
			'/api/tracks/followups/3/skip',
			{ headers: { 'Content-Type': 'application/json' }, method: 'POST' }
		]);
	});
});
