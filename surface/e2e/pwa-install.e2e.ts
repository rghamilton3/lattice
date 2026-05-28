import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
	await page.addInitScript(() => {
		try {
			localStorage.clear();
		} catch {
			/* ignore */
		}
	});
	await page.route('**/api/status', (route) =>
		route.fulfill({ status: 200, body: JSON.stringify({ agents: [], active_agent_count: 0 }) })
	);
	await page.route('**/api/**', (route) => route.fulfill({ status: 200, body: '[]' }));
});

test('exposes installable manifest metadata and app shell', async ({ page }) => {
	const manifest = await page.request.get('/manifest.webmanifest');
	expect(manifest.ok()).toBe(true);
	expect(await manifest.json()).toMatchObject({
		name: 'Lattice Surface',
		short_name: 'Surface',
		start_url: '/',
		scope: '/',
		display: 'standalone'
	});

	await page.goto('/');
	await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
		'href',
		'/manifest.webmanifest'
	);
	await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#1f2937');
	await expect(page.getByRole('heading', { name: /Where you were/i })).toBeVisible();
});

test('preserves deep-link browser use while install UI remains progressive', async ({ page }) => {
	await page.goto('/?view=doc&ref=not-a-ref');
	await expect(page.getByRole('heading', { name: /Where you were/i })).toBeVisible();
	await expect(page.getByRole('status').filter({ hasText: 'Invalid link' })).toBeVisible();

	await page.evaluate(() => {
		const event = new Event('beforeinstallprompt') as Event & {
			prompt: () => Promise<void>;
			userChoice: Promise<{ outcome: 'accepted'; platform: string }>;
		};
		event.prompt = async () => undefined;
		event.userChoice = Promise.resolve({ outcome: 'accepted', platform: 'test' });
		window.dispatchEvent(event);
	});

	await expect(page.getByRole('status').filter({ hasText: 'Install Surface' })).toBeVisible();
});

test('keeps primary shell controls reachable on narrow viewports', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/');

	await expect(page.getByRole('navigation').getByRole('button', { name: 'Home' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Quick capture' })).toBeVisible();
	await expect(page.getByRole('button', { name: /Find anything|Command palette/i })).toBeVisible();
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
		true
	);
});
