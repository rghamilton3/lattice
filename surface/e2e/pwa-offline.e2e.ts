import { expect, test, type Page } from '@playwright/test';

async function stubApis(page: Page, status: number) {
	await page.route('**/api/**', (route) => {
		if (new URL(route.request().url()).pathname === '/api/status') {
			return route.fulfill({
				status,
				body: status === 200 ? JSON.stringify({ agents: [], active_agent_count: 0 }) : '{}'
			});
		}
		return route.fulfill({ status: 200, body: '[]' });
	});
}

test.beforeEach(async ({ page }) => {
	await page.addInitScript(() => {
		try {
			localStorage.clear();
		} catch {
			/* ignore */
		}
	});
});

test('renders a degraded shell notice when live services are unavailable', async ({ page }) => {
	await stubApis(page, 503);

	await page.goto('/');
	await expect(page.getByRole('heading', { name: /Where you were/i })).toBeVisible();
	await expect(
		page.getByRole('status').filter({ hasText: 'Surface is in recovery mode' })
	).toBeVisible();
	await expect(page.getByText(/Your data has not been deleted/i)).toBeVisible();
	await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
});

test('distinguishes expired authorization from generic service failures', async ({ page }) => {
	await stubApis(page, 401);

	await page.goto('/');
	await expect(
		page.getByRole('status').filter({ hasText: 'Sign-in needs attention' })
	).toBeVisible();
	await expect(page.getByRole('button', { name: 'Reauthenticate' })).toBeVisible();
});
