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

test('shows a user-controlled reload affordance for service worker updates', async ({ page }) => {
	await page.addInitScript(() => {
		const waiting = { postMessage: () => undefined };
		const registration = { waiting, addEventListener: () => undefined };
		const serviceWorker = Object.assign(new EventTarget(), {
			controller: {},
			getRegistration: async () => registration,
			register: async () => registration
		});
		Object.defineProperty(navigator, 'serviceWorker', { value: serviceWorker, configurable: true });
	});

	await page.goto('/');

	await expect(
		page.getByRole('status').filter({ hasText: 'A Surface update is ready' })
	).toBeVisible();
	await expect(page.getByRole('button', { name: 'Reload' })).toBeVisible();
});

test('does not interrupt command palette focus with update messaging', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('button', { name: /Find anything|Command palette/i }).click();
	const palette = page.getByRole('dialog', { name: 'Command palette' });
	await expect(palette).toBeVisible();
	await palette.getByRole('textbox').fill('search');

	await page.evaluate(() => navigator.serviceWorker.dispatchEvent(new Event('controllerchange')));

	await expect(
		page.getByRole('status').filter({ hasText: 'A Surface update is ready' })
	).toBeHidden();
	await expect(palette.getByRole('textbox')).toBeFocused();
	await expect(palette.getByRole('textbox')).toHaveValue('search');
});
