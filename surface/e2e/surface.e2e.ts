import { expect, test } from '@playwright/test';

const isMac = process.platform === 'darwin';
const mod = isMac ? 'Meta' : 'Control';

test.beforeEach(async ({ page }) => {
	await page.addInitScript(() => {
		try {
			localStorage.clear();
		} catch {
			/* ignore */
		}
	});
	// API requests go nowhere in preview — stub them so queries resolve fast.
	await page.route('**/api/**', (route) => route.fulfill({ status: 200, body: '[]' }));
});

test('home view renders the canonical landing greeting', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { name: /Where you were/i })).toBeVisible();
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
