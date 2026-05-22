import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
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
		expect(body).toEqual({ agents: [], active_agent_count: 0 });
	});

	it('returns agent fields and active count for a recently reported agent', async () => {
		await seedStatus();

		const res = await app.app.handle(req('/api/status'));
		expect(res.status).toBe(200);
		const body = await json(res);

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
