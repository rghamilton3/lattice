import { afterEach, expect, test, describe } from 'bun:test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTestDb } from './testSupport/db';
import { TEST_AGENT_TOKEN, browserGet } from './testSupport/http';
import { buildApp } from './app';

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function setup(withSurfaceBuild: boolean) {
	const ctx = createTestDb();
	cleanup = ctx.cleanup;
	let surfaceBuild: string | undefined;
	if (withSurfaceBuild) {
		surfaceBuild = join(ctx.dir, 'surface-build');
		mkdirSync(surfaceBuild, { recursive: true });
		writeFileSync(
			join(surfaceBuild, 'index.html'),
			'<!doctype html><html><body>spa-shell</body></html>',
		);
	}
	const app = buildApp({
		db: ctx.db,
		agentToken: TEST_AGENT_TOKEN,
		allowHttp: true,
		devUser: undefined,
		surfaceBuild,
		attachmentsDir: join(ctx.dir, 'attachments'),
		archiveDir: join(ctx.dir, 'archive'),
	});
	return { ...ctx, app };
}

describe('SPA-shell fallback for /cluster/:id', () => {
	test('serves index.html on a hard load of /cluster/:id', async () => {
		const { app } = setup(true);
		// Shell assets are served without auth, like the rest of the static surface.
		const res = await app.handle(new Request('http://spine.test/cluster/42'));
		expect(res.status).toBe(200);
		expect(await res.text()).toContain('spa-shell');
	});

	test('does not shadow the JSON API at /api/cluster/:id', async () => {
		const { app } = setup(true);
		const res = await app.handle(browserGet('/api/cluster/42'));
		expect(res.status).toBe(404);
		expect(res.headers.get('content-type') ?? '').not.toContain('text/html');
	});

	test('is absent when no surface build is configured', async () => {
		const { app } = setup(false);
		const res = await app.handle(new Request('http://spine.test/cluster/42'));
		expect(res.status).toBe(404);
	});
});
