import type { Database } from 'bun:sqlite';
import { setDefaultLLM } from '@tobilu/qmd/dist/llm.js';
import { RemoteLLM, type RemoteLLMConfig } from '@tobilu/qmd/dist/remote-llm.js';
import { getAgentToken as getConfigAgentToken, getQmdModelsConfig } from './config';
import type { InferenceConfigRow, AgentTokenRow, InferenceRole } from './db/rows';

export type { InferenceRole };

export interface InferenceRoleSettings {
	/** Effective URL after applying global + file/env fallbacks. */
	api_url: string | undefined;
	/** This role's own override only (undefined when inheriting). */
	own_api_url: string | undefined;
	model: string | undefined;
	/** Effective key present (own override, global, or file/env). */
	has_key: boolean;
	/** This role has its own key override. */
	has_own_key: boolean;
	/** Effective URL came from somewhere other than this role's own override. */
	inherits_url: boolean;
	/** Effective key came from somewhere other than this role's own override. */
	inherits_key: boolean;
	source: 'database' | 'config' | 'env' | 'none';
}

export interface GlobalInferenceSettings {
	api_url: string | undefined;
	has_key: boolean;
	source: 'database' | 'none';
}

export interface InferenceSettings {
	global: GlobalInferenceSettings;
	embed: InferenceRoleSettings;
	rerank: InferenceRoleSettings;
	expand: InferenceRoleSettings;
	asr: InferenceRoleSettings;
	vlm: InferenceRoleSettings;
}

/** Fully resolved endpoint config (including secret key) for internal use. */
export interface ResolvedRole {
	api_url: string | undefined;
	model: string | undefined;
	api_key: string | undefined;
}

// In-memory active agent token - updated on rotation, read by the agent guard.
let _activeAgentToken: string | undefined;

export function initActiveAgentToken(db: Database): void {
	const row = db.query('SELECT token FROM agent_tokens WHERE active = 1 LIMIT 1').get() as Pick<
		AgentTokenRow,
		'token'
	> | null;
	_activeAgentToken = row?.token ?? getConfigAgentToken();
}

export function setActiveAgentToken(token: string | undefined): void {
	_activeAgentToken = token;
}

export function getActiveAgentToken(): string | undefined {
	return _activeAgentToken;
}

export function getAgentTokenSource(db: Database): 'database' | 'config' | 'env' | 'none' {
	const row = db.query('SELECT id FROM agent_tokens WHERE active = 1 LIMIT 1').get() as {
		id: number;
	} | null;
	if (row) return 'database';
	if (process.env.LATTICE_AGENT_TOKEN) return 'env';
	if (getConfigAgentToken()) return 'config';
	return 'none';
}

// Env var names QMD reads per role. ASR/VLM/OCR have no dedicated URL/key — they
// share the embed endpoint.
const ENV_KEYS: Record<InferenceRole, { url?: string; model?: string; key?: string }> = {
	embed: { url: 'QMD_EMBED_API_URL', model: 'QMD_EMBED_API_MODEL', key: 'QMD_EMBED_API_KEY' },
	rerank: { url: 'QMD_RERANK_API_URL', model: 'QMD_RERANK_API_MODEL', key: 'QMD_RERANK_API_KEY' },
	expand: { url: 'QMD_EXPAND_API_URL', model: 'QMD_EXPAND_API_MODEL', key: 'QMD_EXPAND_API_KEY' },
	asr: { model: 'LATTICE_ASR_MODEL' },
	vlm: {},
};

// Roles with no endpoint of their own — they fall back to the embed endpoint.
const SHARES_EMBED_ENDPOINT = new Set<InferenceRole>(['asr', 'vlm']);

type FileConfig = ReturnType<typeof getQmdModelsConfig>;

function fileRole(
	fileConfig: FileConfig,
	role: InferenceRole,
): {
	url?: string;
	model?: string;
	key?: string;
} {
	switch (role) {
		case 'embed':
			return {
				url: fileConfig?.embed_api_url,
				model: fileConfig?.embed_api_model,
				key: fileConfig?.embed_api_key,
			};
		case 'rerank':
			return {
				url: fileConfig?.rerank_api_url,
				model: fileConfig?.rerank_api_model,
				key: fileConfig?.rerank_api_key,
			};
		case 'expand':
			return {
				url: fileConfig?.expand_api_url,
				model: fileConfig?.expand_api_model,
				key: fileConfig?.expand_api_key,
			};
		case 'asr':
			return { model: fileConfig?.asr_model };
		case 'vlm':
			// One vision model serves description + OCR; honor legacy ocr_model too.
			return { model: fileConfig?.vlm_model ?? fileConfig?.ocr_model };
	}
}

interface RoleComputation {
	settings: InferenceRoleSettings;
	resolved: ResolvedRole;
}

// Single resolution pass shared by the public settings view and internal callers.
// Precedence per role: own override > global > config.toml > env. ASR additionally
// falls back to the embed endpoint (URL and key) to preserve historical behavior.
function computeInference(db: Database): {
	global: GlobalInferenceSettings;
	roles: Record<InferenceRole, RoleComputation>;
} {
	const rows = db
		.query('SELECT role, api_url, model, api_key FROM inference_config')
		.all() as InferenceConfigRow[];
	const dbMap = new Map(rows.map((r) => [r.role, r]));
	const fileConfig = getQmdModelsConfig();

	const globalRow = dbMap.get('global');
	const globalUrl = globalRow?.api_url ?? undefined;
	const globalKey = globalRow?.api_key ?? undefined;
	const global: GlobalInferenceSettings = {
		api_url: globalUrl,
		has_key: globalKey != null,
		source: globalUrl != null || globalKey != null ? 'database' : 'none',
	};

	function computeRole(
		role: InferenceRole,
		embedFallbackUrl?: string,
		embedFallbackKey?: string,
	): RoleComputation {
		const dbRow = dbMap.get(role);
		const ownUrl = dbRow?.api_url ?? undefined;
		const ownModel = dbRow?.model ?? undefined;
		const ownKey = dbRow?.api_key ?? undefined;

		const env = ENV_KEYS[role];
		const envUrl = env.url ? process.env[env.url] : undefined;
		const envModel = env.model ? process.env[env.model] : undefined;
		const envKey = env.key ? process.env[env.key] : undefined;
		const file = fileRole(fileConfig, role);

		let api_url: string | undefined;
		let source: InferenceRoleSettings['source'];
		let inherits_url: boolean;
		if (ownUrl) {
			api_url = ownUrl;
			source = 'database';
			inherits_url = false;
		} else if (globalUrl) {
			api_url = globalUrl;
			source = 'database';
			inherits_url = true;
		} else if (file.url) {
			api_url = file.url;
			source = 'config';
			inherits_url = true;
		} else if (envUrl) {
			api_url = envUrl;
			source = 'env';
			inherits_url = true;
		} else if (SHARES_EMBED_ENDPOINT.has(role) && embedFallbackUrl) {
			api_url = embedFallbackUrl;
			source = 'database';
			inherits_url = true;
		} else {
			api_url = undefined;
			source = 'none';
			inherits_url = true;
		}

		const model = ownModel ?? file.model ?? envModel ?? undefined;

		const resolvedKey =
			ownKey ??
			globalKey ??
			file.key ??
			envKey ??
			(SHARES_EMBED_ENDPOINT.has(role) ? embedFallbackKey : undefined);
		const has_own_key = ownKey != null;
		const has_key = resolvedKey != null;
		const inherits_key = has_key && !has_own_key;

		return {
			settings: {
				api_url,
				own_api_url: ownUrl,
				model,
				has_key,
				has_own_key,
				inherits_url,
				inherits_key,
				source,
			},
			resolved: { api_url, model, api_key: resolvedKey },
		};
	}

	const embed = computeRole('embed');
	const rerank = computeRole('rerank');
	const expand = computeRole('expand');
	const asr = computeRole('asr', embed.resolved.api_url, embed.resolved.api_key);
	const vlm = computeRole('vlm', embed.resolved.api_url, embed.resolved.api_key);

	return { global, roles: { embed, rerank, expand, asr, vlm } };
}

export function getInferenceSettings(db: Database): InferenceSettings {
	const { global, roles } = computeInference(db);
	return {
		global,
		embed: roles.embed.settings,
		rerank: roles.rerank.settings,
		expand: roles.expand.settings,
		asr: roles.asr.settings,
		vlm: roles.vlm.settings,
	};
}

// Fully resolved endpoints (including secret keys) for internal use only — never
// expose this in an API response.
export function resolveInferenceConfig(db: Database): Record<InferenceRole, ResolvedRole> {
	const { roles } = computeInference(db);
	return {
		embed: roles.embed.resolved,
		rerank: roles.rerank.resolved,
		expand: roles.expand.resolved,
		asr: roles.asr.resolved,
		vlm: roles.vlm.resolved,
	};
}

export function applyInferenceSettings(db: Database): void {
	const r = resolveInferenceConfig(db);

	if (!r.embed.api_url || !r.embed.model) {
		setDefaultLLM(null);
		return;
	}

	const cfg: RemoteLLMConfig = {
		embedApiUrl: r.embed.api_url,
		embedApiModel: r.embed.model,
	};

	if (r.embed.api_key) cfg.embedApiKey = r.embed.api_key;

	if (r.rerank.api_url && r.rerank.model) {
		cfg.rerankApiUrl = r.rerank.api_url;
		cfg.rerankApiModel = r.rerank.model;
		if (r.rerank.api_key) cfg.rerankApiKey = r.rerank.api_key;
	}

	if (r.expand.api_url && r.expand.model) {
		cfg.expandApiUrl = r.expand.api_url;
		cfg.expandApiModel = r.expand.model;
		if (r.expand.api_key) cfg.expandApiKey = r.expand.api_key;
	}

	try {
		setDefaultLLM(new RemoteLLM(cfg));
	} catch (err) {
		console.error('[settings] failed to apply inference settings — search unavailable:', err);
		setDefaultLLM(null);
	}
}
