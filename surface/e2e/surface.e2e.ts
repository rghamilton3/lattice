import { expect, test, type Page } from '@playwright/test';

const isMac = process.platform === 'darwin';
const mod = isMac ? 'Meta' : 'Control';
const editorSlug = 'vim-mode-test';

async function stubWorkingEditor(page: Page) {
	await page.route(`**/api/working/${editorSlug}`, (route) => {
		if (route.request().method() === 'GET') {
			return route.fulfill({
				status: 200,
				body: JSON.stringify({
					slug: editorSlug,
					title: 'Vim mode test',
					content: 'Seed editor body'
				})
			});
		}
		return route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) });
	});
	await page.route('**/api/working', (route) => {
		if (route.request().method() === 'POST') {
			return route.fulfill({
				status: 200,
				body: JSON.stringify({ slug: editorSlug })
			});
		}
		return route.fulfill({ status: 200, body: '[]' });
	});
}

async function openWorkingEditor(page: Page) {
	await stubWorkingEditor(page);
	await page.goto('/');
	await page.getByRole('heading', { name: /Where you were/i }).waitFor();
	await page.keyboard.press(`${mod}+Shift+J`);
	const dialog = page.getByRole('dialog', { name: 'New working doc' });
	await dialog.getByRole('textbox').fill('Vim mode test');
	await dialog.getByRole('button', { name: 'create' }).click();
	await expect(page.getByLabel(`Markdown editor for ${editorSlug}.md`)).toBeVisible();
}

async function mockBackNavigationData(page: Page) {
	const capture = {
		id: 1,
		text: 'Seed capture body',
		source: 'test',
		captured_at: '2026-05-21T11:00:00Z',
		ingested_at: '2026-05-21T11:00:00Z',
		triaged_at: null,
		triage_action: null,
		task_due_date: null,
		task_priority: null,
		task_notes: null,
		first_image_id: null
	};
	const working = {
		slug: 'notes',
		title: 'Notes',
		content: 'Working notes body',
		modified_at: '2026-05-21T11:05:00Z'
	};
	const inboxItem = {
		item_type: 'capture',
		id: 'capture:1',
		capture_id: 1,
		title: capture.text,
		summary: capture.text,
		source: capture.source,
		created_at: capture.ingested_at,
		capture,
		actions: [
			{ action: 'keep', label: 'Keep', shortcut: 'k', tone: 'primary' },
			{ action: 'archive', label: 'Archive', shortcut: 'a', tone: 'neutral' },
			{ action: 'skip', label: 'Skip', shortcut: 'Space', tone: 'neutral' }
		]
	};

	await page.route('**/api/inbox?**', (route) =>
		route.fulfill({ status: 200, body: JSON.stringify({ items: [inboxItem], next_cursor: null }) })
	);
	await page.route('**/api/captures/1', (route) =>
		route.fulfill({ status: 200, body: JSON.stringify(capture) })
	);
	await page.route('**/api/captures?**', (route) =>
		route.fulfill({ status: 200, body: JSON.stringify({ items: [capture], next_cursor: null }) })
	);
	await page.route('**/api/working/notes', (route) => {
		if (route.request().method() === 'DELETE') {
			return route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) });
		}
		return route.fulfill({ status: 200, body: JSON.stringify(working) });
	});
	await page.route('**/api/working', (route) =>
		route.fulfill({
			status: 200,
			body: JSON.stringify([
				{ slug: working.slug, title: working.title, modified_at: working.modified_at }
			])
		})
	);
	await page.route('**/api/files?**', (route) =>
		route.fulfill({ status: 200, body: JSON.stringify({ items: [], next_cursor: null }) })
	);
	await page.route('**/api/search**', (route) =>
		route.fulfill({
			status: 200,
			body: JSON.stringify({
				results: [
					{
						kind: 'working',
						id: 2,
						score: 0.8,
						snippet: 'Working notes body',
						body: 'Working notes body',
						path: '/w/notes',
						slug: working.slug,
						modified_at: working.modified_at
					}
				]
			})
		})
	);
}

async function mockTrackingData(page: Page) {
	let nextTrackId = 4;
	let nextBinId = 2;
	let failNextCreate = false;
	let failNextMovedFollowup = false;
	let bins = [{ id: 1, name: 'Router Shelf', normalized_name: 'router shelf' }];
	let cards = [
		{
			item_key: 'keys',
			item_phrase: 'keys',
			current_track: {
				id: 1,
				text: 'keys by the router',
				captured_at: '2026-01-02T00:00:00.000Z',
				source: 'signal-text',
				displaced: false,
				photo_ref: 'photo-keys',
				supersedes: null
			},
			bin_id: 1,
			bin_name: 'Router Shelf',
			location_label: 'Router Shelf',
			displaced: false,
			possible_duplicates: []
		}
	];
	let unbinned = [
		{
			item_key: 'bike-lock',
			item_phrase: 'bike lock',
			current_track: {
				id: 2,
				text: 'bike lock in hallway shelf',
				captured_at: '2026-01-03T00:00:00.000Z',
				source: 'surface-form',
				displaced: false,
				photo_ref: null,
				supersedes: null
			},
			bin_id: null,
			bin_name: null,
			location_label: 'hallway shelf',
			displaced: false,
			possible_duplicates: []
		}
	];
	let followups = [
		{
			query_id: 7,
			query: 'keys',
			queried_at: '2026-01-01T00:00:00.000Z',
			expires_at: '2026-01-08T00:00:00.000Z',
			opened_track: cards[0].current_track,
			affirmative_label: 'Still there'
		},
		{
			query_id: 8,
			query: 'bike lock',
			queried_at: '2026-01-01T00:00:00.000Z',
			expires_at: '2026-01-08T00:00:00.000Z',
			opened_track: unbinned[0].current_track,
			affirmative_label: 'Still there'
		},
		{
			query_id: 9,
			query: 'flashlight',
			queried_at: '2026-01-01T00:00:00.000Z',
			expires_at: '2026-01-08T00:00:00.000Z',
			opened_track: {
				id: 6,
				text: 'flashlight in toolbox',
				captured_at: '2026-01-02T00:00:00.000Z',
				source: 'signal-text',
				displaced: false,
				photo_ref: null,
				supersedes: null
			},
			affirmative_label: 'Still there'
		}
	];
	const detail = (id: number) => ({
		record:
			[...cards, ...unbinned].find((card) => card.current_track.id === id)?.current_track ??
			cards[0].current_track,
		same_item_history: [
			{
				id: 3,
				text: 'keys in kitchen bowl',
				captured_at: '2026-01-01T00:00:00.000Z',
				source: 'signal-text',
				displaced: false,
				photo_ref: 'photo-history',
				supersedes: null
			}
		],
		related_location_tracks: [unbinned[0].current_track]
	});
	const board = (displacedOnly: boolean) => {
		const filteredCards = displacedOnly ? cards.filter((card) => card.displaced) : cards;
		const filteredUnbinned = displacedOnly ? unbinned.filter((card) => card.displaced) : unbinned;
		return {
			bins,
			cards: filteredCards,
			unbinned: filteredUnbinned,
			displaced_count: [...cards, ...unbinned].filter((card) => card.displaced).length
		};
	};

	await page.route('**/api/tracks/**', async (route) => {
		const request = route.request();
		const url = new URL(request.url());
		const path = url.pathname;
		const method = request.method();
		if (path === '/api/tracks/search' && method === 'GET') {
			return route.fulfill({
				status: 200,
				body: JSON.stringify({
					query_id: 5,
					primary: cards[0].current_track,
					history: [detail(1).same_item_history[0]],
					results: [cards[0].current_track, detail(1).same_item_history[0]],
					empty_message: null
				})
			});
		}
		if (path === '/api/tracks/queries/5/open' && method === 'POST') {
			return route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) });
		}
		if (path === '/api/tracks/board' && method === 'GET') {
			return route.fulfill({
				status: 200,
				body: JSON.stringify(board(url.searchParams.get('displaced') === 'only'))
			});
		}
		if (path === '/api/tracks/followups' && method === 'GET') {
			return route.fulfill({ status: 200, body: JSON.stringify({ followups }) });
		}
		if (path === '/api/tracks/photos' && method === 'POST') {
			return route.fulfill({
				status: 201,
				body: JSON.stringify({
					ref: 'photo-1',
					filename: 'photo.png',
					content_type: 'image/png',
					size_bytes: 4,
					url: '/api/tracks/photos/photo-1/raw'
				})
			});
		}
		if (path.match(/^\/api\/tracks\/photos\/.+\/raw$/) && method === 'GET') {
			return route.fulfill({
				status: 200,
				contentType: 'image/png',
				body: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
			});
		}
		if (path === '/api/tracks/' && method === 'POST') {
			if (failNextCreate) {
				failNextCreate = false;
				return route.fulfill({ status: 500, body: 'temporary save issue' });
			}
			const body = request.postDataJSON() as { text: string; photo_ref?: string | null };
			const track = {
				id: nextTrackId++,
				text: body.text,
				captured_at: '2026-01-04T00:00:00.000Z',
				source: 'surface-form',
				displaced: false,
				photo_ref: body.photo_ref ?? null,
				supersedes: null
			};
			unbinned = [
				...unbinned,
				{
					item_key: body.text.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
					item_phrase: body.text.split(' in ')[0] ?? body.text,
					current_track: track,
					bin_id: null,
					bin_name: null,
					location_label: body.text.split(' in ')[1] ?? null,
					displaced: false,
					possible_duplicates: []
				}
			];
			return route.fulfill({
				status: 201,
				body: JSON.stringify({ id: track.id, possible_duplicates: [] })
			});
		}
		if (path === '/api/tracks/bins' && method === 'POST') {
			const body = request.postDataJSON() as { name: string };
			const normalizedName = body.name.trim().toLowerCase().replace(/\s+/g, ' ');
			const existing = bins.find((candidate) => candidate.normalized_name === normalizedName);
			if (existing) {
				return route.fulfill({
					status: 409,
					body: JSON.stringify({ error: 'bin already exists', bin: existing })
				});
			}
			const bin = {
				id: nextBinId++,
				name: body.name,
				normalized_name: normalizedName
			};
			bins = [...bins, bin];
			return route.fulfill({ status: 201, body: JSON.stringify({ bin }) });
		}
		if (path === '/api/tracks/board/move' && method === 'POST') {
			const body = request.postDataJSON() as {
				item_phrase: string;
				from_track_id: number;
				to_bin_id: number;
			};
			const bin = bins.find((candidate) => candidate.id === body.to_bin_id) ?? bins[0];
			const sourceCard = [...cards, ...unbinned].find(
				(card) => card.current_track.id === body.from_track_id
			);
			const moved = {
				...(sourceCard ?? unbinned[0]),
				current_track: {
					...(sourceCard ?? unbinned[0]).current_track,
					id: nextTrackId++,
					text: `${body.item_phrase} in ${bin.name}`,
					supersedes: body.from_track_id
				},
				bin_id: bin.id,
				bin_name: bin.name,
				location_label: bin.name,
				displaced: false
			};
			cards = [...cards.filter((card) => card.item_key !== moved.item_key), moved];
			unbinned = unbinned.filter((card) => card.item_key !== moved.item_key);
			return route.fulfill({
				status: 201,
				body: JSON.stringify({
					track_id: moved.current_track.id,
					text: moved.current_track.text,
					displaced: false,
					supersedes: body.from_track_id
				})
			});
		}
		if (path === '/api/tracks/board/checkout' && method === 'POST') {
			const body = request.postDataJSON() as {
				item_phrase: string;
				from_track_id: number;
				context: string;
			};
			cards = cards.map((card) =>
				card.current_track.id === body.from_track_id
					? {
							...card,
							current_track: {
								...card.current_track,
								id: nextTrackId++,
								text: `${body.item_phrase} checked out: ${body.context}`,
								displaced: true,
								supersedes: body.from_track_id
							},
							displaced: true
						}
					: card
			);
			return route.fulfill({
				status: 201,
				body: JSON.stringify({
					track_id: nextTrackId,
					text: `${body.item_phrase} checked out: ${body.context}`,
					displaced: true,
					supersedes: body.from_track_id
				})
			});
		}
		if (path.includes('/api/tracks/followups/') && method === 'POST') {
			if (path.endsWith('/moved') && failNextMovedFollowup) {
				failNextMovedFollowup = false;
				return route.fulfill({ status: 500, body: 'temporary moved issue' });
			}
			const queryId = Number(path.split('/')[4]);
			followups = followups.filter((followup) => followup.query_id !== queryId);
			return route.fulfill({ status: 200, body: JSON.stringify({ ok: true, outcome: 'closed' }) });
		}
		const detailMatch = path.match(/^\/api\/tracks\/(\d+)$/);
		if (detailMatch && method === 'GET') {
			return route.fulfill({
				status: 200,
				body: JSON.stringify(detail(Number(detailMatch[1])))
			});
		}
		return route.fulfill({ status: 404, body: 'tracking mock missing' });
	});

	return {
		failNextCreate: () => {
			failNextCreate = true;
		},
		failNextMovedFollowup: () => {
			failNextMovedFollowup = true;
		}
	};
}

test.use({ serviceWorkers: 'block' });

async function routePreviewDoc(
	page: Page,
	content: string,
	options: { saveStatus?: number; saveBody?: string } = {}
) {
	let savedContent = content;
	const saveStatus = options.saveStatus ?? 200;
	const saveBody =
		options.saveBody ?? (saveStatus >= 400 ? 'save failed' : JSON.stringify({ ok: true }));
	await page.unroute('**/api/**');
	await page.route('**/api/lateral**', (route) =>
		route.fulfill({ status: 200, body: JSON.stringify({ results: [] }) })
	);
	await page.route('**/api/similar**', (route) =>
		route.fulfill({ status: 200, body: JSON.stringify({ results: [] }) })
	);
	await page.route('**/api/working/preview-doc/attachments**', (route) =>
		route.fulfill({ status: 200, body: '[]' })
	);
	await page.route('**/api/working/preview-doc', async (route) => {
		if (route.request().method() === 'PUT') {
			if (saveStatus < 400) {
				const body = route.request().postDataJSON() as { content?: string };
				savedContent = body.content ?? savedContent;
			}
			return route.fulfill({ status: saveStatus, body: saveBody });
		}
		return route.fulfill({
			status: 200,
			body: JSON.stringify({ slug: 'preview-doc', title: 'Preview Doc', content: savedContent })
		});
	});
	await page.route('**/api/**', (route) => {
		const url = route.request().url();
		if (
			url.includes('/api/working/preview-doc') ||
			url.includes('/api/lateral') ||
			url.includes('/api/similar')
		) {
			return route.fallback();
		}
		return route.fulfill({ status: 200, body: '[]' });
	});
}

async function openPreviewWorkingEditor(
	page: Page,
	content: string,
	options: { saveStatus?: number; saveBody?: string } = {}
) {
	await page.addInitScript(() => {
		localStorage.setItem('lattice.session', JSON.stringify({ vimMode: false }));
	});
	await routePreviewDoc(page, content, options);

	await page.goto('/?ref=working:preview-doc');
	// The install-unsupported notice renders shortly after mount in this
	// environment; a bare isVisible() check can race it and leave the notice
	// intercepting toolbar clicks. Wait for it, then dismiss.
	const dismissInstall = page.getByRole('button', { name: 'Dismiss' });
	await dismissInstall.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {});
	if (await dismissInstall.isVisible()) await dismissInstall.click();
	await page.getByRole('button', { name: /Edit/i }).click();
	await expect(page.getByLabel('Markdown editor for preview-doc.md')).toBeVisible();
	return page.locator('.cm-content').first();
}

async function openPreviewSplit(page: Page) {
	const dismiss = page.getByRole('button', { name: 'Dismiss' });
	if (await dismiss.isVisible()) await dismiss.click();
	const splitButton = page.getByRole('button', { name: 'Open preview in split pane' });
	await splitButton.click();
	await expect(page.getByRole('region', { name: 'Pane 2' })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
	await page.addInitScript(() => {
		try {
			localStorage.clear();
		} catch {
			/* ignore */
		}
	});
	// API requests go nowhere in preview — stub them so queries resolve fast.
	await page.route('**/api/**', (route) => {
		const url = route.request().url();
		if (
			url.includes('/api/working/preview-doc') ||
			url.includes('/api/lateral') ||
			url.includes('/api/similar')
		) {
			return route.fallback();
		}
		return route.fulfill({ status: 200, body: '[]' });
	});
	// Object-shaped endpoints (resurfacing/clusters are on by default) — a bare
	// `[]` would be the wrong shape for these.
	await page.route('**/api/resurfaced**', (route) =>
		route.fulfill({ status: 200, body: JSON.stringify({ items: [] }) })
	);
	await page.route('**/api/cluster/**', (route) =>
		route.fulfill({ status: 200, body: JSON.stringify({ clusterId: null }) })
	);
});

test('home view renders the canonical landing greeting', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { name: /Where you were/i })).toBeVisible();
});

test('tracking workspace searches, opens history, and restores stable detail links', async ({
	page
}) => {
	await mockTrackingData(page);
	await page.goto('/');
	await page.getByRole('button', { name: 'Tracking follow-ups' }).click();

	await expect(
		page.getByRole('heading', { name: 'Find and place real-world items' })
	).toBeVisible();
	await page.getByLabel('Item or place').fill('keys by router');
	await page.getByRole('button', { name: 'Search' }).click();
	await expect(page.getByText('Best match', { exact: true })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'keys by the router' })).toBeVisible();
	await expect(page.getByAltText('Photo preview for keys by the router')).toBeVisible();
	await expect(page.getByText('photo attached').first()).toBeVisible();
	await expect(page.getByAltText('Photo preview for keys in kitchen bowl')).toBeVisible();
	await page.getByRole('button', { name: 'Open record' }).click();

	const detailRegion = page.getByLabel('Tracking record detail');
	await expect(page.getByRole('region', { name: 'Pane 1' })).toContainText('Same item history');
	await expect(page.getByText('keys in kitchen bowl')).toBeVisible();
	await expect(detailRegion.getByText('bike lock in hallway shelf')).toBeVisible();

	await page.goto('/?track=1');
	await expect(page.getByRole('heading', { name: 'keys by the router' })).toBeVisible();
});

test('tracking workspace creates records, moves cards by drag/drop and keyboard controls, and filters checkouts', async ({
	page
}) => {
	const tracking = await mockTrackingData(page);
	await page.goto('/?view=tracking');

	await page.getByRole('button', { name: 'Save track' }).click();
	await expect(page.getByRole('alert')).toContainText('Write the item and where it is');

	await page.getByLabel('Item and place').fill('camera in desk drawer');
	tracking.failNextCreate();
	await page.getByRole('button', { name: 'Save track' }).click();
	await expect(page.getByRole('alert')).toContainText('Save did not finish');
	await expect(page.getByLabel('Item and place')).toHaveValue('camera in desk drawer');

	await page.getByLabel('Item and place').fill('camera in desk drawer');
	await page.getByLabel('Optional photo').setInputFiles({
		name: 'camera.png',
		mimeType: 'image/png',
		buffer: Buffer.from([1, 2, 3, 4])
	});
	await page.getByRole('button', { name: 'Save track' }).click();
	await expect(page.getByText(/Saved track \d+\./)).toBeVisible();
	await expect(page.getByRole('heading', { name: 'camera' })).toBeVisible();

	const bikeCard = page.locator('article.board-card', { hasText: 'bike lock' });
	await bikeCard.getByRole('button', { name: 'Create bin from hallway shelf' }).click();
	await expect(page.getByText('Created bin hallway shelf.')).toBeVisible();

	await page.getByPlaceholder('garage shelf').fill('Office Shelf');
	await page.getByRole('button', { name: 'Create bin', exact: true }).click();
	await expect(page.getByText('Created bin Office Shelf.')).toBeVisible();
	await page.getByPlaceholder('garage shelf').fill('office shelf');
	await page.getByRole('button', { name: 'Create bin', exact: true }).click();
	await expect(page.getByText('Place already exists: Office Shelf.')).toBeVisible();
	const officeBin = page.locator('article.bin-card', { hasText: 'Office Shelf' });
	const cameraCard = page.locator('article.board-card', { hasText: 'camera' });
	const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
	await cameraCard.dispatchEvent('dragstart', { dataTransfer });
	await officeBin.dispatchEvent('dragenter', { dataTransfer });
	await officeBin.dispatchEvent('dragover', { dataTransfer });
	await officeBin.dispatchEvent('drop', { dataTransfer });
	await expect(officeBin.locator('article.board-card', { hasText: 'camera' })).toContainText(
		'Office Shelf'
	);
	await expect(page.getByText('Moved camera to Office Shelf.')).toBeVisible();
	await bikeCard.getByRole('button', { name: 'Move' }).click();
	await bikeCard.getByLabel('Destination bin').selectOption({ label: 'Office Shelf' });
	await bikeCard.getByRole('button', { name: 'Place' }).click();
	await expect(bikeCard).toContainText('Office Shelf');

	await bikeCard.getByLabel('Checkout context').fill('with neighbor');
	await bikeCard.getByRole('button', { name: 'Check out' }).click();
	await expect(bikeCard).toContainText('away');
	await page.getByLabel('Show only away items').check();
	await expect(page.locator('article.board-card')).toHaveCount(1);
	await expect(page.locator('article.board-card')).toContainText('bike lock');
});

test('tracking follow-ups close still, moved, and skipped rows without reappearing', async ({
	page
}) => {
	const tracking = await mockTrackingData(page);
	await page.goto('/?view=tracking');

	const keysFollowup = page.locator('article.followup-row', { hasText: 'keys' });
	await keysFollowup.getByRole('button', { name: 'Still there' }).click();
	await expect(keysFollowup).toHaveCount(0);

	const bikeFollowup = page.locator('article.followup-row', { hasText: 'bike lock' });
	await bikeFollowup.getByLabel('Moved place for bike lock').fill('bike lock in garage');
	tracking.failNextMovedFollowup();
	await bikeFollowup.getByRole('button', { name: 'Moved' }).click();
	await expect(page.getByRole('alert')).toContainText('Follow-up did not finish');
	await expect(bikeFollowup.getByLabel('Moved place for bike lock')).toHaveValue(
		'bike lock in garage'
	);
	await bikeFollowup.getByRole('button', { name: 'Moved' }).click();
	await expect(bikeFollowup).toHaveCount(0);

	const flashlightFollowup = page.locator('article.followup-row', { hasText: 'flashlight' });
	await flashlightFollowup.getByRole('button', { name: 'Skip' }).click();
	await expect(flashlightFollowup).toHaveCount(0);

	await expect(page.getByLabel('Tracking follow-ups')).toHaveCount(0);
});

test('quick capture: c → type → ⌘↵ shows toast', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('heading', { name: /Where you were/i }).waitFor();

	await page.keyboard.press('c');
	const dialog = page.getByRole('dialog', { name: 'Quick capture' });
	await expect(dialog).toBeVisible();

	await dialog.getByRole('textbox').fill('a test thought');
	await page.keyboard.press(`${mod}+Enter`);

	await expect(
		page.getByRole('status').filter({ hasText: /Captured|inbox updated/i })
	).toBeVisible();
});

test('command palette: ⌘K → "search" → Enter switches the pane to library', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('heading', { name: /Where you were/i }).waitFor();

	await page.keyboard.press(`${mod}+k`);
	const palette = page.getByRole('dialog', { name: 'Command palette' });
	await expect(palette).toBeVisible();

	await palette.getByRole('textbox').fill('search');
	await page.keyboard.press('Enter');

	await expect(page.getByPlaceholder('Filter your library…')).toBeVisible();
});

test('command palette: ? opens palette and focuses the search input', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('heading', { name: /Where you were/i }).waitFor();

	await page.keyboard.press('?');
	const palette = page.getByRole('dialog', { name: 'Command palette' });
	const input = palette.getByRole('textbox', { name: 'Command palette search' });

	await expect(palette).toBeVisible();
	await expect(input).toBeFocused();
});

test('settings drawer cycles each theme and updates <html data-theme>', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('heading', { name: /Where you were/i }).waitFor();

	await page.getByRole('button', { name: 'Settings' }).click();
	const drawer = page.getByRole('dialog', { name: 'Settings' });
	await expect(drawer).toBeVisible();

	for (const theme of ['dark', 'sepia', 'light'] as const) {
		await drawer.getByRole('button', { name: theme }).click();
		await expect
			.poll(() => page.evaluate(() => document.documentElement.dataset.theme))
			.toBe(theme);
	}
});

test('invalid document deep link falls back with a visible status message', async ({ page }) => {
	await page.goto('/?view=doc&ref=not-a-ref');
	await expect(page.getByRole('heading', { name: /Where you were/i })).toBeVisible();
	await expect(page.getByRole('status').filter({ hasText: 'Invalid link' })).toBeVisible();
});

test('working editor shows the editor-local default Vim off state', async ({ page }) => {
	await openWorkingEditor(page);

	await expect(page.getByRole('button', { name: /Vim mode: off/i })).toBeVisible();
});

test('working editor Vim control toggles the editor-local state on', async ({ page }) => {
	await openWorkingEditor(page);

	await page.getByRole('button', { name: /Vim mode: off/i }).click();
	await expect(page.getByRole('button', { name: /Vim mode: on/i })).toBeVisible();
});

test('settings Vim mode control updates the editor indicator', async ({ page }) => {
	await openWorkingEditor(page);

	await page.getByRole('button', { name: 'Settings' }).click();
	const drawer = page.getByRole('dialog', { name: 'Settings' });
	await drawer.getByLabel('Vim mode').check();

	await expect(page.getByRole('button', { name: /Vim mode: on/i })).toBeVisible();
});

test('Ctrl+Alt+V updates the editor indicator', async ({ page }) => {
	await openWorkingEditor(page);

	await page.keyboard.press('Control+Alt+V');
	await expect(page.getByRole('button', { name: /Vim mode: on/i })).toBeVisible();
});

test('global shortcut keys stay suppressed while focus is in CodeMirror', async ({ page }) => {
	await openWorkingEditor(page);

	await page.locator('.cm-content').click();
	await page.keyboard.press('c');

	await expect(page.getByRole('dialog', { name: 'Quick capture' })).toBeHidden();
});

test('Tab key inserts indent in CodeMirror instead of tabbing out', async ({ page }) => {
	await openWorkingEditor(page);

	const editor = page.locator('.cm-content');
	await editor.click();
	await page.keyboard.press('Tab');

	await expect(editor).toBeFocused();
	const lineText = await page.locator('.cm-line').first().textContent();
	expect(lineText!.length).toBeGreaterThan(lineText!.trimStart().length);
});

test('back from a home-opened document returns to Home', async ({ page }) => {
	await mockBackNavigationData(page);
	await page.goto('/');

	await page.getByRole('button', { name: 'Open capture: Seed capture body' }).click();
	await expect(page.getByText('Seed capture body')).toBeVisible();

	await page.getByRole('button', { name: 'Back to previous view' }).click();
	await expect(page.getByRole('heading', { name: /Where you were/i })).toBeVisible();
});

test('back from a library search result restores the search context', async ({ page }) => {
	await mockBackNavigationData(page);
	await page.goto('/');
	await page.getByRole('heading', { name: /Where you were/i }).waitFor();
	await page.keyboard.press(`${mod}+/`);

	const input = page.getByPlaceholder('Filter your library…');
	await input.fill('alpha');
	await page.getByRole('button', { name: 'Open notes.md', exact: true }).click();
	await expect(page.getByText('Working notes body')).toBeVisible();

	await page.getByRole('button', { name: 'Back to previous view' }).click();
	await expect(input).toBeVisible();
	await expect(input).toHaveValue('alpha');
});

test('direct document deep link back falls back inside Surface', async ({ page }) => {
	await mockBackNavigationData(page);
	await page.goto('/?view=doc&ref=capture:1');
	await expect(page.getByText('Seed capture body')).toBeVisible();

	await page.getByRole('button', { name: 'Back to previous view' }).click();
	await expect(page.getByPlaceholder('Filter your library…')).toBeVisible();
	await expect(page.locator('.doc-view').filter({ hasText: 'Seed capture body' })).toBeHidden();
});

test('back controls are named, keyboard-operable, and do not strand focus', async ({ page }) => {
	await mockBackNavigationData(page);
	await page.goto('/');
	await page.getByRole('heading', { name: /Where you were/i }).waitFor();
	await page.keyboard.press(`${mod}+/`);

	const input = page.getByPlaceholder('Filter your library…');
	await input.fill('alpha');
	await page.getByRole('button', { name: 'Open notes.md', exact: true }).click();
	await expect(page.getByText('Working notes body')).toBeVisible();

	const readingBack = page.getByRole('button', { name: 'Back to previous view' });
	await expect(readingBack).toBeVisible();
	await page.getByRole('button', { name: 'Edit' }).click();

	const editorBack = page.getByRole('button', { name: 'Back to previous view' });
	await expect(editorBack).toBeVisible();
	await editorBack.focus();
	await page.keyboard.press('Space');
	await expect(page.getByText('Working notes body')).toBeVisible();

	const documentBack = page.getByRole('button', { name: 'Back to previous view' });
	await documentBack.focus();
	await page.keyboard.press('Enter');
	await expect(input).toBeVisible();
	await expect(input).toHaveValue('alpha');
	await expect(documentBack).toBeHidden();
	await expect
		.poll(() => page.evaluate(() => document.activeElement?.getAttribute('aria-label')))
		.not.toBe('Back to previous view');
});

test('deleting from editor skips the now-unavailable reading view', async ({ page }) => {
	await mockBackNavigationData(page);
	page.on('dialog', (dialog) => dialog.accept());
	await page.goto('/');
	await page.getByRole('heading', { name: /Where you were/i }).waitFor();
	await page.keyboard.press(`${mod}+/`);

	const input = page.getByPlaceholder('Filter your library…');
	await input.fill('alpha');
	await page.getByRole('button', { name: 'Open notes.md', exact: true }).click();
	await expect(page.getByText('Working notes body')).toBeVisible();
	await page.getByRole('button', { name: 'Edit' }).click();
	await page.getByRole('button', { name: 'Delete working document' }).click();

	await expect(input).toBeVisible();
	await expect(input).toHaveValue('alpha');
	await expect(page.getByRole('button', { name: 'Delete working document' })).toBeHidden();
});

test('shortcut keys do not open capture while typing in library search', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('heading', { name: /Where you were/i }).waitFor();

	await page.keyboard.press(`${mod}+/`);
	const input = page.getByPlaceholder('Filter your library…');
	await expect(input).toBeVisible();
	await input.fill('alpha');
	await page.keyboard.press('c');

	await expect(page.getByRole('dialog', { name: 'Quick capture' })).toBeHidden();
	await expect(input).toHaveValue('alphac');
});

test('capture deep link can split and open similar results without replacing original', async ({
	page
}) => {
	await page.route('**/api/captures/1', (route) =>
		route.fulfill({
			status: 200,
			body: JSON.stringify({
				id: 1,
				text: 'Seed capture body',
				source: 'test',
				captured_at: '2026-05-21T11:00:00Z',
				ingested_at: '2026-05-21T11:00:00Z',
				triaged_at: null,
				triage_action: null,
				task_due_date: null,
				task_priority: null,
				task_notes: null,
				first_image_id: null
			})
		})
	);
	await page.route('**/api/similar**', (route) =>
		route.fulfill({
			status: 200,
			body: JSON.stringify({
				results: [
					{
						kind: 'capture',
						id: 2,
						score: 0.91,
						snippet: 'Related capture snippet',
						body: 'Related capture snippet',
						path: '/c/2',
						modified_at: '2026-05-21T11:05:00Z'
					}
				]
			})
		})
	);

	await page.goto('/?view=doc&ref=capture:1');
	await expect(page.getByText('Seed capture body')).toBeVisible();
	await page.getByRole('button', { name: /Split/i }).click();
	await expect(page.getByText('Seed capture body')).toHaveCount(2);
	await page
		.getByRole('button', { name: /Similar/i })
		.first()
		.click();
	await expect(page.getByText('Seed capture body')).toBeVisible();
	await expect(
		page.getByRole('button', { name: /capture Related capture snippet/i })
	).toBeVisible();
});

test('process mode: k / a / space advances queue and renders done card', async ({ page }) => {
	const captures = [
		{
			id: 1,
			text: 'one',
			source: 'desktop-hotkey',
			captured_at: '2026-05-21T11:00:00Z',
			ingested_at: '2026-05-21T11:00:00Z'
		},
		{
			id: 2,
			text: 'two',
			source: 'desktop-hotkey',
			captured_at: '2026-05-21T11:01:00Z',
			ingested_at: '2026-05-21T11:01:00Z'
		},
		{
			id: 3,
			text: 'three',
			source: 'desktop-hotkey',
			captured_at: '2026-05-21T11:02:00Z',
			ingested_at: '2026-05-21T11:02:00Z'
		}
	];
	await page.route('**/api/captures**', (route) => {
		if (route.request().method() === 'GET')
			return route.fulfill({
				status: 200,
				body: JSON.stringify({ items: captures, next_cursor: null })
			});
		return route.fulfill({ status: 200, body: '{}' });
	});

	await page.goto('/');
	await page.getByRole('heading', { name: /Where you were/i }).waitFor();
	await page.getByRole('button', { name: /Process 10 in 5 min/i }).click();

	// Three captures, three keystrokes (k, a, space=skip) → done card.
	await expect(page.getByText('one')).toBeVisible();
	await page.keyboard.press('k');
	await expect(page.getByText('two')).toBeVisible();
	await page.keyboard.press('a');
	await expect(page.getByText('three')).toBeVisible();
	await page.keyboard.press(' ');

	await expect(page.getByRole('heading', { name: 'Inbox processed.' })).toBeVisible();
});

test('search facets: toggle kind off filters results', async ({ page }) => {
	const results = [
		{ kind: 'capture', id: 1, score: 0.9, snippet: 'cap snippet', body: 'b', path: '/c/1' },
		{
			kind: 'working',
			id: 2,
			score: 0.8,
			snippet: 'wk snippet',
			body: 'b',
			path: '/w/notes',
			slug: 'notes'
		},
		{
			kind: 'local-file',
			id: 3,
			score: 0.7,
			snippet: 'fl snippet',
			body: 'b',
			path: '/f/3',
			machine_id: 'm'
		}
	];
	await page.route('**/api/search**', (route) =>
		route.fulfill({ status: 200, body: JSON.stringify({ results }) })
	);

	const isMacLocal = process.platform === 'darwin';
	const modLocal = isMacLocal ? 'Meta' : 'Control';
	await page.goto('/');
	await page.getByRole('heading', { name: /Where you were/i }).waitFor();
	await page.keyboard.press(`${modLocal}+/`);

	const input = page.getByPlaceholder('Filter your library…');
	await input.fill('foo');

	await expect(page.getByText('cap snippet')).toBeVisible();
	await expect(page.getByText('wk snippet')).toBeVisible();
	await expect(page.getByText('fl snippet')).toBeVisible();

	// Toggle "working" off; that row should disappear.
	await page.getByRole('button', { name: /Hide working results/i }).click();
	await expect(page.getByText('wk snippet')).toBeHidden();
	await expect(page.getByText('cap snippet')).toBeVisible();
});

test('quick capture: 500 keeps modal open with failure message', async ({ page }) => {
	await page.route('**/api/captures**', (route) => {
		if (route.request().method() === 'POST')
			return route.fulfill({ status: 500, body: 'server boom' });
		return route.fulfill({ status: 200, body: '[]' });
	});

	await page.goto('/');
	await page.getByRole('heading', { name: /Where you were/i }).waitFor();

	await page.keyboard.press('c');
	const dialog = page.getByRole('dialog', { name: 'Quick capture' });
	await expect(dialog).toBeVisible();

	await dialog.getByRole('textbox').fill('this will fail');
	await page.keyboard.press(`${mod}+Enter`);

	// Modal stays open and surfaces the failure inline.
	await expect(dialog).toBeVisible();
	await expect(dialog.getByText('Save failed — try again')).toBeVisible();
});

test('working doc editor keeps preview closed until split pane is requested', async ({ page }) => {
	await openPreviewWorkingEditor(
		page,
		'# Preview Title\n\n- first item\n- **second item**\n\n> quoted\n\n```ts\nconst ok = true;\n```\n\n[docs](https://example.com)'
	);

	await expect(page.getByRole('region', { name: 'Pane 2' })).toBeHidden();
	await expect(page.getByRole('button', { name: 'Back to previous view' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Open preview in split pane' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Insert diagram' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Save working document' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Delete working document' })).toBeVisible();
	await expect(page.getByRole('button', { name: /Vim/i })).toBeVisible();

	await openPreviewSplit(page);
	const preview = page.getByRole('region', { name: 'Pane 2' });
	await expect(preview.getByRole('heading', { name: 'Preview Title' })).toBeVisible();
	await expect(preview.getByText('first item')).toBeVisible();
	await expect(preview.getByText('second item')).toBeVisible();
	await expect(preview.getByText('quoted')).toBeVisible();
	await expect(preview.getByText('const ok = true;')).toBeVisible();
	await expect(preview.getByRole('link', { name: 'docs' })).toBeVisible();
	await expect(preview.getByRole('button', { name: /Similar/i })).toBeVisible();
	await expect(preview.getByRole('button', { name: /Mentions/i })).toBeVisible();
	await expect(preview.getByRole('button', { name: /Attach/i })).toBeVisible();
	await expect(preview.getByRole('button', { name: /Edit/i })).toBeVisible();
	await expect(preview.getByRole('button', { name: /Split/i })).toBeVisible();
});

test('working doc editor inserts a mermaid diagram snippet', async ({ page }) => {
	const editor = await openPreviewWorkingEditor(page, '# Diagram Draft\n\n');

	await editor.click();
	await page.getByRole('button', { name: 'Insert diagram' }).click();

	await expect(editor).toContainText('```mermaid');
	await expect(editor).toContainText('flowchart TD');
	await expect(editor).toContainText('A[Start] --> B[Next]');
	await expect(page.locator('.editor-save-status').getByText('unsaved')).toBeVisible();
});

test('working doc split preview refreshes after successful save', async ({ page }) => {
	const editor = await openPreviewWorkingEditor(page, '# Old Title\n\nold body');
	await openPreviewSplit(page);

	await editor.click();
	await page.keyboard.press(`${mod}+a`);
	await page.keyboard.type('# Saved Title\n\nnew body');
	await page.getByRole('button', { name: 'Save working document' }).click();

	const preview = page.getByRole('region', { name: 'Pane 2' });
	await expect(preview.getByRole('heading', { name: 'Saved Title' })).toBeVisible({
		timeout: 2000
	});
	await expect(preview.getByText('new body')).toBeVisible();
	await expect(page.getByText('Preview refreshed from saved content.')).toBeVisible();
});

test('working doc preview layout remains reachable on narrow viewports', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 760 });
	await openPreviewWorkingEditor(
		page,
		'# Narrow Title\n\nA long preview line that should stay inside the pane.'
	);

	await expect(page.getByRole('button', { name: 'Back to previous view' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Open preview in split pane' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Insert diagram' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Save working document' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Delete working document' })).toBeVisible();
	await expect(page.getByRole('button', { name: /Vim/i })).toBeVisible();
	await expect(page.getByLabel('Markdown editor for preview-doc.md')).toBeVisible();
	await expect(page.getByRole('region', { name: 'Pane 2' })).toBeHidden();
	await expect
		.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
		.toBe(true);
});

test('working doc editor keyboard navigation reaches controls and preview without a trap', async ({
	page
}) => {
	await openPreviewWorkingEditor(page, '# Keyboard Title\n\n[focus link](https://example.com)');
	await openPreviewSplit(page);
	await page
		.getByRole('region', { name: 'Pane 1' })
		.getByRole('button', { name: 'Back to previous view' })
		.focus();

	const reached = {
		back: true,
		split: false,
		diagram: false,
		save: false,
		delete: false,
		vim: false,
		previewLink: false
	};

	for (let i = 0; i < 20; i += 1) {
		await page.keyboard.press('Tab');
		const active = await page.evaluate(() => {
			const element = document.activeElement as HTMLElement | null;
			return {
				aria: element?.getAttribute('aria-label') ?? '',
				text: element?.textContent ?? '',
				inEditor: element?.closest('.cm-content') !== null
			};
		});
		if (active.inEditor) {
			await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
		}
		reached.back ||= active.aria === 'Back to previous view';
		reached.split ||= active.aria === 'Open preview in split pane';
		reached.diagram ||= active.aria === 'Insert diagram';
		reached.save ||= active.aria === 'Save working document';
		reached.delete ||= active.aria === 'Delete working document';
		reached.vim ||= /vim/i.test(active.text);
		reached.previewLink ||= active.text.trim() === 'focus link';
	}

	expect(reached).toEqual({
		back: true,
		split: true,
		diagram: true,
		save: true,
		delete: true,
		vim: true,
		previewLink: true
	});
});

test('working doc split preview keeps saved content until save', async ({ page }) => {
	const editor = await openPreviewWorkingEditor(page, '# Fresh Title\n\nbody');
	await openPreviewSplit(page);
	const preview = page.getByRole('region', { name: 'Pane 2' });

	await expect(preview.getByRole('heading', { name: 'Fresh Title' })).toBeVisible();
	await editor.click();
	await page.keyboard.type('\nunsaved edit');

	await expect(
		page.getByText('Preview shows saved content. Unsaved edits are not included until Save.')
	).toBeVisible();
	await expect(preview.getByRole('heading', { name: 'Fresh Title' })).toBeVisible();
	await expect(preview.getByText('unsaved edit')).toBeHidden();
});

test('working doc save failure preserves editing and recoverable preview status', async ({
	page
}) => {
	await openPreviewWorkingEditor(page, '# Previous Preview', {
		saveStatus: 500,
		saveBody: 'save failed'
	});
	await openPreviewSplit(page);
	const editor = page.locator('.cm-content').first();
	await editor.click();
	await page.keyboard.type('\nunsaved edit');
	const saveButton = page.getByRole('button', { name: 'Save working document' });
	await expect(saveButton).toBeEnabled();
	const failedSave = page.waitForResponse(
		(response) =>
			response.url().includes('/api/working/preview-doc') &&
			response.request().method() === 'PUT' &&
			response.status() === 500
	);
	await saveButton.click();
	await failedSave;

	await expect(page.getByText('action failed')).toBeVisible();
	await expect(
		page.getByText('Preview still shows last saved content. Save again to refresh it.')
	).toBeVisible();
	await expect(page.getByRole('region', { name: 'Pane 2' }).getByRole('heading')).toHaveText(
		'Previous Preview'
	);
	await expect(page.getByRole('button', { name: 'Save working document' })).toBeEnabled();
});

// ─── AttachmentRail extraction status display ─────────────────────────────────

async function routePreviewDocWithAttachments(
	page: Page,
	attachments: object[],
	descriptionRoutes: Record<number, object | 404> = {}
) {
	// Catch-all registered first → lowest priority; specific routes below override it.
	// More specific routes must be registered AFTER less specific ones (last-registered-wins).
	await page.route('**/api/**', (route) => route.fulfill({ status: 200, body: '[]' }));
	await page.route('**/api/lateral**', (route) =>
		route.fulfill({ status: 200, body: JSON.stringify({ results: [] }) })
	);
	await page.route('**/api/similar**', (route) =>
		route.fulfill({ status: 200, body: JSON.stringify({ results: [] }) })
	);
	await page.route('**/api/working/preview-doc', (route) =>
		route.fulfill({
			status: 200,
			body: JSON.stringify({ slug: 'preview-doc', title: 'Preview Doc', content: '# Preview' })
		})
	);
	await page.route('**/api/working/preview-doc/attachments**', (route) =>
		route.fulfill({ status: 200, body: JSON.stringify(attachments) })
	);
	// Description routes registered last → override the attachments list route above
	for (const [id, fixture] of Object.entries(descriptionRoutes)) {
		const status = fixture === 404 ? 404 : 200;
		const body =
			fixture === 404 ? JSON.stringify({ error: 'No description yet' }) : JSON.stringify(fixture);
		await page.route(`**/api/working/preview-doc/attachments/${id}/description**`, (route) =>
			route.fulfill({ status, body })
		);
	}
}

test('attachment rail shows extraction status badges for pending, failed, and dark attachments', async ({
	page
}) => {
	const attachments = [
		{
			id: 1,
			filename: 'doc.pdf',
			content_type: 'application/pdf',
			size_bytes: 1024,
			extraction_status: 'pending'
		},
		{
			id: 2,
			filename: 'bad.pdf',
			content_type: 'application/pdf',
			size_bytes: 512,
			extraction_status: 'failed'
		},
		{
			id: 3,
			filename: 'chart.png',
			content_type: 'image/png',
			size_bytes: 2048,
			extraction_status: 'dark'
		}
	];
	await routePreviewDocWithAttachments(page, attachments);
	await page.goto('/?ref=working:preview-doc');

	const rail = page.getByRole('complementary', { name: 'Attachments' });
	await expect(rail).toBeVisible();
	await expect(rail.getByText('extracting…')).toBeVisible();
	await expect(rail.getByText('failed')).toBeVisible();
	await expect(
		rail.getByRole('button', { name: 'Toggle machine description for chart.png' })
	).toBeVisible();
});

test('dark attachment description panel shows description text and Confirm button', async ({
	page
}) => {
	const attachments = [
		{
			id: 1,
			filename: 'photo.jpg',
			content_type: 'image/jpeg',
			size_bytes: 3000,
			extraction_status: 'dark'
		}
	];
	const description = {
		id: 10,
		attachment_kind: 'working',
		attachment_id: 1,
		produced_text: 'A photo of a garden.',
		final_text: 'A photo of a garden.',
		confirmed: false,
		model_id: 'test-vlm',
		supersedes: null,
		created_at: '2026-01-01T00:00:00Z'
	};
	await routePreviewDocWithAttachments(page, attachments, { 1: description });
	await page.goto('/?ref=working:preview-doc');

	const rail = page.getByRole('complementary', { name: 'Attachments' });
	const descButton = rail.getByRole('button', { name: 'Toggle machine description for photo.jpg' });
	await expect(descButton).toBeVisible();
	await descButton.click();

	const textarea = rail.getByLabel('Machine description for photo.jpg', { exact: true });
	await expect(textarea).toBeVisible();
	await expect(textarea).toHaveValue('A photo of a garden.');
	await expect(rail.getByRole('button', { name: 'Confirm' })).toBeVisible();
});
