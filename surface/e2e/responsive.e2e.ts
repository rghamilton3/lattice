import { expect, test, type Page } from '@playwright/test';

// Responsive design coverage for the Surface SPA (modification 010-mod-002).
// Verifies the contract in
// specs/010-surface-workbench/modifications/002-add-responsive-design/contracts/responsive-layout.md
//   G1 single-pane collapse, G2 primary actions reachable,
//   G3 touch-target sizing, G4 reflow / no overflow, G5 desktop regression.
//
// The split-collapse is CSS-only (Tailwind tablet: variants gated at width>=64rem,
// plain-CSS media queries at width<64rem), so it is validated by opening a split
// at desktop width and then resizing narrower: the two panes must restack from
// side-by-side to stacked without the split state being lost.

const DESKTOP = { width: 1280, height: 800 };
const TABLET = { width: 820, height: 1000 };
const PHONE = { width: 390, height: 780 };

async function openCaptureSplit(page: Page) {
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
		route.fulfill({ status: 200, body: JSON.stringify({ results: [] }) })
	);
	await page.goto('/?view=doc&ref=capture:1');
	await expect(page.getByText('Seed capture body')).toBeVisible();
	await page.getByRole('button', { name: /Split/i }).click();
	await expect(page.getByText('Seed capture body')).toHaveCount(2);
}

async function paneBoxes(page: Page) {
	const p1 = await page.getByRole('region', { name: 'Pane 1' }).boundingBox();
	const p2 = await page.getByRole('region', { name: 'Pane 2' }).boundingBox();
	if (!p1 || !p2) throw new Error('expected two pane regions to be present');
	return { p1, p2 };
}

test('G5 + G1: split is side-by-side at desktop, stacks when resized to phone', async ({
	page
}) => {
	await page.setViewportSize(DESKTOP);
	await openCaptureSplit(page);

	// G5 desktop regression: two panes side by side, same top edge.
	const desktop = await paneBoxes(page);
	expect(desktop.p2.x).toBeGreaterThan(desktop.p1.x + 100);
	expect(Math.abs(desktop.p2.y - desktop.p1.y)).toBeLessThan(12);

	// G1 collapse: resize narrower; split must restack vertically, not vanish.
	await page.setViewportSize(PHONE);
	await expect(page.getByText('Seed capture body')).toHaveCount(2);
	const phone = await paneBoxes(page);
	expect(phone.p2.y).toBeGreaterThan(phone.p1.y + 100);
	expect(Math.abs(phone.p2.x - phone.p1.x)).toBeLessThan(12);

	// G4: no page-level horizontal scrolling at phone width.
	await assertNoHorizontalOverflow(page);
	await page.screenshot({ path: 'test-results/responsive-split-phone.png' });
});

async function assertNoHorizontalOverflow(page: Page) {
	const overflows = await page.evaluate(
		() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
	);
	expect(overflows).toBe(false);
}

test('G1: split is stacked at tablet width', async ({ page }) => {
	await page.setViewportSize(TABLET);
	await openCaptureSplit(page);
	const { p1, p2 } = await paneBoxes(page);
	expect(p2.y).toBeGreaterThan(p1.y + 100);
	expect(Math.abs(p2.x - p1.x)).toBeLessThan(12);
});

test('G2: primary actions stay reachable at phone width', async ({ page }) => {
	await page.setViewportSize(PHONE);
	await page.goto('/');
	await expect(page.getByRole('heading', { name: /Where you were/i })).toBeVisible();

	// Capture and command-palette entry points remain in the viewport.
	await expect(page.locator('.capture-button')).toBeInViewport();
	await expect(page.locator('.palette-button')).toBeInViewport();
	await expect(page.locator('.nav-btn').first()).toBeInViewport();

	await assertNoHorizontalOverflow(page);
});

// G4 cross-feature: the views owned by other features (006 tasks/triage, 010
// search) must also reflow within a phone viewport, not just feature 010's home.
test('G4: tasks view does not overflow at phone width', async ({ page }) => {
	await page.setViewportSize(PHONE);
	await page.route('**/api/tasks', (route) =>
		route.fulfill({
			status: 200,
			body: JSON.stringify([
				{
					id: 1,
					text: 'A deliberately long task title that should wrap rather than force the layout to scroll sideways on a narrow phone screen',
					source: 'test',
					captured_at: '2026-05-21T11:00:00Z',
					ingested_at: '2026-05-21T11:00:00Z',
					triaged_at: '2026-05-21T11:00:00Z',
					triage_action: 'task',
					task_due_date: '2026-06-01',
					task_priority: 'high',
					task_notes: null,
					first_image_id: null
				}
			])
		})
	);
	await page.goto('/');
	await expect(page.getByRole('heading', { name: /Where you were/i })).toBeVisible();
	// At phone width the inline nav is collapsed into the toolbar menu.
	await page.getByRole('button', { name: 'Menu' }).click();
	await page.getByRole('menu').getByRole('menuitem', { name: 'Tasks' }).click();
	await expect(page.getByText(/deliberately long task title/)).toBeVisible();
	await assertNoHorizontalOverflow(page);
	await page.screenshot({ path: 'test-results/responsive-tasks-phone.png' });
});

test('G4: library search results do not overflow at phone width', async ({ page }) => {
	await page.setViewportSize(PHONE);
	await page.route('**/api/search**', (route) =>
		route.fulfill({
			status: 200,
			body: JSON.stringify({
				results: [
					{
						kind: 'capture',
						id: 1,
						score: 0.9,
						snippet: 'A long search snippet that keeps going and going '.repeat(4),
						body: 'b',
						path: '/c/1',
						modified_at: '2026-05-21T11:00:00Z'
					}
				]
			})
		})
	);
	const mod = process.platform === 'darwin' ? 'Meta' : 'Control';
	await page.goto('/');
	await expect(page.getByRole('heading', { name: /Where you were/i })).toBeVisible();
	await page.keyboard.press(`${mod}+/`);
	await page.getByPlaceholder('Filter your library…').fill('foo');
	await expect(page.getByText(/A long search snippet/).first()).toBeVisible();
	await assertNoHorizontalOverflow(page);
});

test('G4: triage (process mode) does not overflow at phone width', async ({ page }) => {
	await page.setViewportSize(PHONE);
	const captures = [
		{
			id: 1,
			text: 'A long capture body for triage that must wrap inside the narrow process-mode card without causing horizontal page scroll',
			source: 'desktop-hotkey',
			captured_at: '2026-05-21T11:00:00Z',
			ingested_at: '2026-05-21T11:00:00Z'
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
	await expect(page.getByRole('heading', { name: /Where you were/i })).toBeVisible();
	await page.getByRole('button', { name: /Process \d+ in/i }).click();
	await expect(page.getByText(/A long capture body for triage/)).toBeVisible();
	await assertNoHorizontalOverflow(page);
	await page.screenshot({ path: 'test-results/responsive-triage-phone.png' });
});

test.describe('coarse pointer (touch device)', () => {
	// Emulate a touch device: hasTouch makes Chromium report (pointer: coarse).
	// Avoid spreading a full device descriptor here because it sets
	// defaultBrowserType, which Playwright forbids inside a describe group.
	test.use({ viewport: { width: 393, height: 851 }, isMobile: true, hasTouch: true });

	test('G3: interactive controls meet the 44px minimum tap target', async ({ page }) => {
		await page.goto('/');
		await expect(page.getByRole('heading', { name: /Where you were/i })).toBeVisible();

		const coarse = await page.evaluate(() => matchMedia('(pointer: coarse)').matches);
		expect(coarse).toBe(true);

		const capture = await page.locator('.capture-button').boundingBox();
		const nav = await page.locator('.nav-btn').first().boundingBox();
		expect(capture?.height ?? 0).toBeGreaterThanOrEqual(44);
		expect(nav?.height ?? 0).toBeGreaterThanOrEqual(44);
	});
});

// Toolbar collapse: a single row at every width (no 2-bar wrap), inline icon nav
// in the tablet band, and a menu only at phone width where it stops fitting.
test('responsive toolbar stays a single row across the breakpoint band', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { name: /Where you were/i })).toBeVisible();
	for (const width of [1100, 1000, 800, 640, 480, 390]) {
		await page.setViewportSize({ width, height: 900 });
		// The toolbar is a single nowrap row pinned to the grid height, and the
		// shell clips overflow-x, so a too-wide toolbar would be silently cut off
		// rather than wrap. Assert its content actually fits within its own box.
		const fits = await page
			.locator('.toolbar')
			.evaluate((el) => el.scrollWidth <= el.clientWidth + 1);
		expect(fits, `toolbar content overflowed/clipped at ${width}px`).toBe(true);
		await page.screenshot({ path: `test-results/responsive-toolbar-${width}.png` });
	}
});

test('tablet band keeps inline nav and hides the status bar', async ({ page }) => {
	await page.setViewportSize({ width: 800, height: 1000 });
	await page.goto('/');
	await expect(page.getByRole('heading', { name: /Where you were/i })).toBeVisible();
	await expect(page.locator('.toolbar-nav')).toBeVisible();
	await expect(page.locator('.toolbar-menu-btn')).toBeHidden();
	await expect(page.locator('.statusbar')).toBeHidden();
});

test('phone collapses nav into a menu; Settings stays reachable', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 780 });
	await page.goto('/');
	await expect(page.getByRole('heading', { name: /Where you were/i })).toBeVisible();
	await expect(page.locator('.toolbar-nav')).toBeHidden();

	const trigger = page.getByRole('button', { name: 'Menu' });
	await expect(trigger).toBeVisible();
	await trigger.click();
	const menu = page.getByRole('menu', { name: 'Navigation menu' });
	await expect(menu).toBeVisible();
	await page.screenshot({ path: 'test-results/responsive-menu-390.png' });

	// Settings moved off the inline toolbar into the menu - regression guard.
	await menu.getByRole('menuitem', { name: 'Settings' }).click();
	await expect(page.locator('.settings-drawer')).toBeVisible();
});

test('phone menu navigates to Tasks', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 780 });
	await page.route('**/api/tasks', (route) => route.fulfill({ status: 200, body: '[]' }));
	await page.goto('/');
	await expect(page.getByRole('heading', { name: /Where you were/i })).toBeVisible();
	await page.getByRole('button', { name: 'Menu' }).click();
	await page.getByRole('menu').getByRole('menuitem', { name: 'Tasks' }).click();
	await expect(page.getByRole('heading', { name: 'Tasks' })).toBeVisible();
});
