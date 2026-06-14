import { Elysia } from 'elysia';
import { randomBytes } from 'node:crypto';
import type { Database } from 'bun:sqlite';
import {
	getInferenceSettings,
	applyInferenceSettings,
	getActiveAgentToken,
	getAgentTokenSource,
	setActiveAgentToken,
} from '../settings';
import type { InferenceRole } from '../settings';

const URL_PATTERN = /^https?:\/\//;

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
			const roles: InferenceRole[] = ['embed', 'rerank', 'expand', 'asr'];
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

		.post('/api/settings/inference/probe', async () => {
			const settings = getInferenceSettings(db);
			const probeable = ['embed', 'rerank', 'expand'] as const;
			const results = await Promise.all(
				probeable.map(async (role) => {
					const url = settings[role].api_url;
					if (!url) return [role, null] as const;
					const start = performance.now();
					const controller = new AbortController();
					const timer = setTimeout(() => controller.abort(), 5_000);
					try {
						const base = url.endsWith('/') ? url.slice(0, -1) : url;
						await fetch(`${base}/models`, { signal: controller.signal });
						return [
							role,
							{ reachable: true, latency_ms: Math.round(performance.now() - start) },
						] as const;
					} catch (err) {
						const error = controller.signal.aborted
							? 'timeout'
							: err instanceof TypeError
								? 'invalid_url'
								: 'unreachable';
						return [
							role,
							{ reachable: false, latency_ms: Math.round(performance.now() - start), error },
						] as const;
					} finally {
						clearTimeout(timer);
					}
				}),
			);
			return Object.fromEntries(results.filter(([, v]) => v !== null));
		})

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
