import { Elysia } from 'elysia';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Database } from 'bun:sqlite';
import {
	getInferenceSettings,
	applyInferenceSettings,
	resolveInferenceConfig,
	getActiveAgentToken,
	getAgentTokenSource,
	setActiveAgentToken,
} from '../settings';
import type { InferenceRole } from '../settings';

const URL_PATTERN = /^https?:\/\//;

// Resolved once at module load from spine/package.json (../../ from src/routes/).
const SPINE_VERSION: string = (() => {
	try {
		const raw = readFileSync(join(import.meta.dir, '../../package.json'), 'utf8');
		return (JSON.parse(raw) as { version?: string }).version ?? 'unknown';
	} catch {
		return 'unknown';
	}
})();

async function listUpstreamModels(
	api_url: string,
	api_key: string | undefined,
	timeoutMs: number,
): Promise<{ models?: string[]; error?: string }> {
	const base = api_url.endsWith('/') ? api_url.slice(0, -1) : api_url;
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const resp = await fetch(`${base}/models`, {
			signal: controller.signal,
			headers: api_key ? { Authorization: `Bearer ${api_key}` } : {},
		});
		if (!resp.ok) return { error: `upstream returned ${resp.status}` };
		const json = (await resp.json()) as { data?: { id?: unknown }[] };
		const models = (json.data ?? [])
			.map((m) => m.id)
			.filter((id): id is string => typeof id === 'string')
			.sort((a, b) => a.localeCompare(b));
		return { models };
	} catch (err) {
		if (controller.signal.aborted) return { error: 'timeout' };
		// fetch wraps connection failures (DNS, refused, TLS) in a generic error
		// with the useful detail on `.cause` — surface it so the user can act.
		let detail = 'unreachable';
		if (err instanceof Error) {
			const cause = (err as { cause?: { code?: string; message?: string } }).cause;
			detail = cause?.code ?? cause?.message ?? err.message ?? detail;
		}
		return { error: detail };
	} finally {
		clearTimeout(timer);
	}
}

function validateUrl(value: string | null | undefined): boolean {
	if (value == null || value === '') return true;
	return URL_PATTERN.test(value);
}

export const settingsRoutes = (db: Database) =>
	new Elysia()
		.get('/api/settings/inference', () => getInferenceSettings(db))

		.put('/api/settings/inference', ({ body, set }) => {
			if (!body || typeof body !== 'object' || Array.isArray(body)) {
				set.status = 422;
				return { errors: { body: 'Expected a JSON object' } };
			}
			const b = body as Record<string, Record<string, string | null> | undefined>;
			// 'global' holds shared URL/key defaults that the other roles inherit.
			const roles = ['global', 'embed', 'rerank', 'expand', 'asr', 'vlm'] as const;
			const errors: Record<string, string> = {};

			for (const role of roles) {
				const roleBody = b[role];
				if (!roleBody) continue;
				if ('api_url' in roleBody && !validateUrl(roleBody.api_url)) {
					errors[`${role}.api_url`] = 'Must be a valid HTTP/HTTPS URL';
				}
			}

			if (Object.keys(errors).length > 0) {
				set.status = 422;
				return { errors };
			}

			// Ensure row exists for each role being updated, then patch only provided fields.
			const ensureRow = db.prepare(
				`INSERT OR IGNORE INTO inference_config (role, updated_at) VALUES (?, strftime('%Y-%m-%dT%H:%M:%SZ','now'))`,
			);
			const updateAt = `strftime('%Y-%m-%dT%H:%M:%SZ','now')`;

			for (const role of roles) {
				const roleBody = b[role];
				if (!roleBody) continue;
				ensureRow.run(role);

				if ('api_url' in roleBody) {
					const v = roleBody.api_url === '' ? null : roleBody.api_url;
					db.run(
						`UPDATE inference_config SET api_url = ?, updated_at = ${updateAt} WHERE role = ?`,
						[v, role],
					);
				}
				if ('model' in roleBody) {
					const v = roleBody.model === '' ? null : roleBody.model;
					db.run(`UPDATE inference_config SET model = ?, updated_at = ${updateAt} WHERE role = ?`, [
						v,
						role,
					]);
				}
				if ('api_key' in roleBody) {
					const v = roleBody.api_key === '' ? null : roleBody.api_key;
					db.run(
						`UPDATE inference_config SET api_key = ?, updated_at = ${updateAt} WHERE role = ?`,
						[v, role],
					);
				}
			}

			applyInferenceSettings(db);
			set.status = 204;
		})

		.post('/api/settings/inference/probe', async ({ body }) => {
			// Optional per-role overrides carry the (possibly unsaved) form values;
			// each falls back to the stored resolved config when omitted.
			const overrides = (body ?? {}) as Record<
				string,
				{ url?: string; api_key?: string } | undefined
			>;
			const resolved = resolveInferenceConfig(db);
			const probeable: InferenceRole[] = ['embed', 'rerank', 'expand', 'asr', 'vlm'];
			const results = await Promise.all(
				probeable.map(async (role) => {
					const override = overrides[role];
					const provided = typeof override?.url === 'string' ? override.url.trim() : '';
					if (provided && !validateUrl(provided)) {
						return [role, { reachable: false, latency_ms: 0, error: 'invalid_url' }] as const;
					}
					const api_url = provided || resolved[role].api_url;
					const api_key = override?.api_key ? override.api_key : resolved[role].api_key;
					if (!api_url) return [role, null] as const;
					const start = performance.now();
					const result = await listUpstreamModels(api_url, api_key, 5_000);
					const latency_ms = Math.round(performance.now() - start);
					return [
						role,
						result.error
							? { reachable: false, latency_ms, error: result.error }
							: { reachable: true, latency_ms, models: result.models ?? [] },
					] as const;
				}),
			);
			return Object.fromEntries(results.filter(([, v]) => v !== null));
		})

		// List models the configured endpoint advertises (OpenAI /v1/models), so the
		// UI can offer a dropdown instead of a free-text model field. Accepts the
		// URL/key currently in the form (which may be unsaved) and falls back to the
		// stored resolved config — the stored key is needed because keys are
		// write-only and never sent back to the client.
		.post('/api/settings/inference/models', async ({ query, body, set }) => {
			const valid: InferenceRole[] = ['embed', 'rerank', 'expand', 'asr', 'vlm'];
			const q = query as { role?: string; url?: string };
			const b = (body ?? {}) as { api_key?: string | null };
			if (!q.role || !valid.includes(q.role as InferenceRole)) {
				set.status = 422;
				return { error: 'Unknown or missing role' };
			}
			const provided = typeof q.url === 'string' ? q.url.trim() : '';
			if (provided && !validateUrl(provided)) {
				set.status = 422;
				return { error: 'Must be a valid HTTP/HTTPS URL' };
			}
			const resolved = resolveInferenceConfig(db)[q.role as InferenceRole];
			const url = provided || resolved.api_url;
			const api_key = b.api_key ? b.api_key : resolved.api_key;
			if (!url) {
				set.status = 400;
				return { error: 'No URL configured for this role' };
			}
			const result = await listUpstreamModels(url, api_key, 8_000);
			if (result.error) {
				set.status = 502;
				return { error: result.error };
			}
			return { models: result.models ?? [] };
		})

		.get('/api/settings/version', () => ({ spine: SPINE_VERSION }))

		.get('/api/settings/security', () => ({
			has_agent_token: Boolean(getActiveAgentToken()),
			agent_token_source: getAgentTokenSource(db),
		}))

		.post('/api/settings/security/rotate-agent-token', ({ set }) => {
			const newToken = randomBytes(32).toString('hex');
			try {
				db.transaction(() => {
					db.run('DELETE FROM agent_tokens WHERE active = 0');
					db.run('UPDATE agent_tokens SET active = 0');
					db.run('INSERT INTO agent_tokens (token, active) VALUES (?, 1)', [newToken]);
				})();
			} catch (err) {
				console.error('[settings] token rotation failed:', err);
				set.status = 500;
				return { error: 'Token rotation failed' };
			}
			setActiveAgentToken(newToken);
			return { token: newToken };
		})

		.put('/api/settings/security', ({ body, set }) => {
			const b = body as Record<string, unknown> | null;
			const agent_token = typeof b?.agent_token === 'string' ? b.agent_token : null;
			if (!agent_token || agent_token.length < 16) {
				set.status = 422;
				return { errors: { agent_token: 'Must be at least 16 characters' } };
			}
			try {
				db.transaction(() => {
					db.run('DELETE FROM agent_tokens WHERE active = 0');
					db.run('UPDATE agent_tokens SET active = 0');
					db.run('INSERT INTO agent_tokens (token, active) VALUES (?, 1)', [agent_token]);
				})();
			} catch (err) {
				console.error('[settings] set agent token failed:', err);
				set.status = 500;
				return { error: 'Failed to store token' };
			}
			setActiveAgentToken(agent_token);
			set.status = 204;
		});
