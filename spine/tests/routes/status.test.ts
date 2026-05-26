import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildTestApp, json, req, type TestApp } from '../helpers/app';

let app: TestApp;
const TOKEN = 'test-token';

beforeEach(async () => {
	app = await buildTestApp({ agentToken: TOKEN });
});

afterEach(async () => {
	await app?.cleanup();
});

function agentPost(path: string, body: unknown) {
	return req(path, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			authorization: `Bearer ${TOKEN}`,
		},
		body: JSON.stringify(body),
	});
}

function seedStatus(overrides: Record<string, unknown> = {}) {
	return app.app.handle(
		agentPost('/api/agent/status', {
			machine_id: 'host1',
			state: 'idle',
			last_scan_at: '2026-01-01T00:00:00.000Z',
			last_indexed: 10,
			last_skipped: 3,
			last_errors: 0,
			spine_ok: true,
			last_error_msg: null,
			...overrides,
		}),
	);
}

describe('GET /api/status', () => {
	it('returns empty agents list when no agent has reported', async () => {
		const res = await app.app.handle(req('/api/status'));
		expect(res.status).toBe(200);
		const body = await json(res);
		expect(body).toMatchObject({
			ready: true,
			state: 'ready',
			agents: [],
			active_agent_count: 0,
		});
		expect(body.checks.storage).toMatchObject({
			ok: true,
			message: 'Storage is initialized',
			applied_migrations: expect.any(Number),
		});
	});

	it('reports starting when storage is not initialized yet', async () => {
		app.db.exec('DROP TABLE schema_migrations');

		const res = await app.app.handle(req('/api/status'));
		const body = await json(res);

		expect(body.ready).toBe(false);
		expect(body.state).toBe('starting');
		expect(body.checks.storage).toEqual({
			ok: false,
			message: 'Storage is not initialized',
			applied_migrations: 0,
		});
	});

	it('returns the platform status contract shape', async () => {
		const res = await app.app.handle(req('/api/status'));
		const body = await json(res);

		expect(Object.keys(body).sort()).toEqual([
			'active_agent_count',
			'agents',
			'checks',
			'ready',
			'state',
		]);
		expect(Object.keys(body.checks).sort()).toEqual([
			'access_boundary',
			'configuration',
			'static_assets',
			'storage',
		]);
		expect(Object.keys(body.checks.configuration).sort()).toEqual(['message', 'ok']);
		expect(Object.keys(body.checks.storage).sort()).toEqual([
			'applied_migrations',
			'message',
			'ok',
		]);
	});

	it('reports unhealthy when configured static assets are unavailable', async () => {
		await app.cleanup();
		app = await buildTestApp({
			agentToken: TOKEN,
			surfaceBuild: '/tmp/lattice-missing-surface-build',
		});

		const res = await app.app.handle(req('/api/status'));
		const body = await json(res);

		expect(body.ready).toBe(false);
		expect(body.state).toBe('unhealthy');
		expect(body.checks.static_assets).toEqual({
			ok: false,
			message: 'Configured static asset path is unavailable',
		});
	});

	it('reports healthy when configured static assets are available', async () => {
		const surfaceBuild = mkdtempSync(join(tmpdir(), 'surface-build-'));
		await app.cleanup();
		app = await buildTestApp({ agentToken: TOKEN, surfaceBuild });

		try {
			const res = await app.app.handle(req('/api/status'));
			const body = await json(res);

			expect(body.ready).toBe(true);
			expect(body.checks.static_assets).toEqual({
				ok: true,
				message: 'Static assets are available',
			});
		} finally {
			rmSync(surfaceBuild, { recursive: true, force: true });
		}
	});

	it('reports unhealthy when agent token is missing', async () => {
		await app.cleanup();
		app = await buildTestApp({ agentToken: undefined });

		const res = await app.app.handle(req('/api/status'));
		const body = await json(res);

		expect(body.ready).toBe(false);
		expect(body.state).toBe('unhealthy');
		expect(body.checks.configuration).toEqual({
			ok: false,
			message: 'Agent token is not configured; agent routes will reject requests',
		});
		expect(body.checks.access_boundary).toEqual({
			ok: false,
			message: 'Protected access cannot be fully enforced without an agent token',
		});
	});

	it('reports unhealthy when HTTP is allowed without a development user', async () => {
		await app.cleanup();
		app = await buildTestApp({ agentToken: TOKEN, allowHttp: true, devUser: undefined });

		const res = await app.app.handle(
			req('/api/status', { headers: { 'x-authentik-username': 'operator' } }),
		);
		const body = await json(res);

		expect(body.ready).toBe(false);
		expect(body.state).toBe('unhealthy');
		expect(body.checks.configuration.ok).toBe(true);
		expect(body.checks.access_boundary).toEqual({
			ok: false,
			message: 'Protected access cannot be fully enforced while HTTP is allowed',
		});
	});

	it('rejects unauthenticated status requests without exposing readiness details', async () => {
		await app.cleanup();
		app = await buildTestApp({ allowHttp: true, devUser: undefined });

		const res = await app.app.handle(req('/api/status'));

		expect(res.status).toBe(401);
		expect(await res.text()).toBe('Unauthorized');
	});

	it('returns agent fields and active count for a recently reported agent', async () => {
		await seedStatus();

		const res = await app.app.handle(req('/api/status'));
		expect(res.status).toBe(200);
		const body = await json(res);

		expect(body.ready).toBe(true);
		expect(body.active_agent_count).toBe(1);
		expect(body.agents).toHaveLength(1);
		expect(body.agents[0]).toMatchObject({
			machine_id: 'host1',
			state: 'idle',
			last_scan_at: '2026-01-01T00:00:00.000Z',
			last_indexed: 10,
		});
	});

	it('counts multiple active agents', async () => {
		await seedStatus({ machine_id: 'host1' });
		await seedStatus({ machine_id: 'host2' });

		const res = await app.app.handle(req('/api/status'));
		const body = await json(res);
		expect(body.active_agent_count).toBe(2);
		expect(body.agents).toHaveLength(2);
	});

	it('does not count stale agents (reported_at older than 5 min)', async () => {
		const staleTs = new Date(Date.now() - 10 * 60 * 1000).toISOString();
		app.db
			.prepare(
				`INSERT INTO agent_status
           (machine_id, state, last_scan_at, last_indexed, last_skipped, last_errors, spine_ok, last_error_msg, reported_at)
         VALUES ('stale-host', 'idle', NULL, 0, 0, 0, 1, NULL, ?)`,
			)
			.run(staleTs);

		const res = await app.app.handle(req('/api/status'));
		const body = await json(res);
		expect(body.active_agent_count).toBe(0);
		expect(body.agents).toHaveLength(1);
	});
});
