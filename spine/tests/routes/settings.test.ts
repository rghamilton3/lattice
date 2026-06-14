import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { buildTestApp, json, req, type TestApp } from '../helpers/app';
import { agentBeforeHandle } from '../../src/guards';

let app: TestApp;

beforeEach(async () => {
	app = await buildTestApp();
});

afterEach(async () => {
	await app?.cleanup();
});

function browserReq(path: string, init?: RequestInit) {
	return req(path, {
		...init,
		headers: {
			'x-authentik-username': 'dev@local',
			...(init?.headers as Record<string, string>),
		},
	});
}

// ── GET /api/settings/inference ───────────────────────────────────────────────

describe('GET /api/settings/inference', () => {
	it('returns all four roles with has_key:false when DB is empty', async () => {
		const res = await app.app.handle(browserReq('/api/settings/inference'));
		expect(res.status).toBe(200);
		const body = await json(res);
		for (const role of ['embed', 'rerank', 'expand', 'asr']) {
			expect(body[role]).toBeDefined();
			expect(body[role].has_key).toBe(false);
		}
	});

	it('returns has_key:true for a role with an API key stored', async () => {
		app.db.run(`INSERT INTO inference_config (role, api_key) VALUES ('embed', 'secret-key')`);
		const res = await app.app.handle(browserReq('/api/settings/inference'));
		const body = await json(res);
		expect(body.embed.has_key).toBe(true);
		expect(body.embed.api_url).toBeUndefined();
	});

	it('does not return the raw api_key value', async () => {
		app.db.run(
			`INSERT INTO inference_config (role, api_key, api_url) VALUES ('embed', 'top-secret', 'http://localhost:11434')`,
		);
		const res = await app.app.handle(browserReq('/api/settings/inference'));
		const body = await json(res);
		expect(JSON.stringify(body)).not.toContain('top-secret');
	});
});

// ── PUT /api/settings/inference ───────────────────────────────────────────────

describe('PUT /api/settings/inference', () => {
	it('valid body returns 204 and persists to DB', async () => {
		const res = await app.app.handle(
			browserReq('/api/settings/inference', {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					embed: { api_url: 'http://localhost:11434', model: 'nomic-embed-text' },
				}),
			}),
		);
		expect(res.status).toBe(204);
		const row = app.db
			.query(`SELECT api_url, model FROM inference_config WHERE role = 'embed'`)
			.get() as { api_url: string; model: string };
		expect(row.api_url).toBe('http://localhost:11434');
		expect(row.model).toBe('nomic-embed-text');
	});

	it('clears a field when null is provided', async () => {
		app.db.run(
			`INSERT INTO inference_config (role, api_url) VALUES ('embed', 'http://localhost:11434')`,
		);
		const res = await app.app.handle(
			browserReq('/api/settings/inference', {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ embed: { api_url: null } }),
			}),
		);
		expect(res.status).toBe(204);
		const row = app.db.query(`SELECT api_url FROM inference_config WHERE role = 'embed'`).get() as {
			api_url: string | null;
		};
		expect(row.api_url).toBeNull();
	});

	it('returns 422 with field error for an invalid URL', async () => {
		const res = await app.app.handle(
			browserReq('/api/settings/inference', {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ embed: { api_url: 'not-a-url' } }),
			}),
		);
		expect(res.status).toBe(422);
		const body = await json(res);
		expect(body.errors['embed.api_url']).toBeDefined();
	});
});

// ── POST /api/settings/inference/probe ───────────────────────────────────────

describe('POST /api/settings/inference/probe', () => {
	it('returns empty object when no roles are configured', async () => {
		const res = await app.app.handle(
			browserReq('/api/settings/inference/probe', { method: 'POST' }),
		);
		expect(res.status).toBe(200);
		const body = await json(res);
		expect(Object.keys(body)).toHaveLength(0);
	});
});

// ── Agent token management ────────────────────────────────────────────────────

describe('POST /api/settings/security/rotate-agent-token', () => {
	it('returns a 64-character hex token', async () => {
		const res = await app.app.handle(
			browserReq('/api/settings/security/rotate-agent-token', { method: 'POST' }),
		);
		expect(res.status).toBe(200);
		const body = await json(res);
		expect(body.token).toMatch(/^[0-9a-f]{64}$/);
	});

	it('deactivates previous tokens and activates new one', async () => {
		await app.app.handle(
			browserReq('/api/settings/security/rotate-agent-token', { method: 'POST' }),
		);
		await app.app.handle(
			browserReq('/api/settings/security/rotate-agent-token', { method: 'POST' }),
		);
		const active = app.db
			.query(`SELECT COUNT(*) AS n FROM agent_tokens WHERE active = 1`)
			.get() as { n: number };
		expect(active.n).toBe(1);
	});
});

describe('GET /api/settings/security', () => {
	it('reports database source after a rotation', async () => {
		await app.app.handle(
			browserReq('/api/settings/security/rotate-agent-token', { method: 'POST' }),
		);
		const res = await app.app.handle(browserReq('/api/settings/security'));
		expect(res.status).toBe(200);
		const body = await json(res);
		expect(body.has_agent_token).toBe(true);
		expect(body.agent_token_source).toBe('database');
	});
});

describe('PUT /api/settings/security', () => {
	it('returns 422 when token is shorter than 16 characters', async () => {
		const res = await app.app.handle(
			browserReq('/api/settings/security', {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ agent_token: 'short' }),
			}),
		);
		expect(res.status).toBe(422);
		const body = await json(res);
		expect(body.errors.agent_token).toBeDefined();
	});

	it('accepts a valid custom token and updates the active guard token', async () => {
		const customToken = 'a-valid-custom-token-32-chars-long';
		const res = await app.app.handle(
			browserReq('/api/settings/security', {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ agent_token: customToken }),
			}),
		);
		expect(res.status).toBe(204);

		// The guard should now accept the new token
		const guard = agentBeforeHandle({ allowHttp: true, getAgentToken: () => customToken });
		const result = guard({
			headers: { authorization: `Bearer ${customToken}` },
			set: {},
		});
		expect(result).toBeUndefined();
	});
});
