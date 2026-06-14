import type { Database } from 'bun:sqlite';
import { setDefaultLLM } from '@tobilu/qmd/dist/llm.js';
import { RemoteLLM, type RemoteLLMConfig } from '@tobilu/qmd/dist/remote-llm.js';
import { getAgentToken as getConfigAgentToken, getQmdModelsConfig } from './config';
import type { InferenceConfigRow, AgentTokenRow, InferenceRole } from './db/rows';

export type { InferenceRole };

export interface InferenceRoleSettings {
	api_url: string | undefined;
	model: string | undefined;
	has_key: boolean;
	source: 'database' | 'config' | 'env' | 'none';
}

export interface InferenceSettings {
	embed: InferenceRoleSettings;
	rerank: InferenceRoleSettings;
	expand: InferenceRoleSettings;
	asr: InferenceRoleSettings;
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

export function getInferenceSettings(db: Database): InferenceSettings {
	const rows = db
		.query('SELECT role, api_url, model, api_key FROM inference_config')
		.all() as InferenceConfigRow[];
	const dbMap = new Map(rows.map((r) => [r.role, r]));
	const fileConfig = getQmdModelsConfig();

	function roleSettings(
		role: InferenceRole,
		urlEnvKey?: string,
		modelEnvKey?: string,
		keyEnvKey?: string,
	): InferenceRoleSettings {
		const dbRow = dbMap.get(role);

		const urlFromEnv = urlEnvKey ? process.env[urlEnvKey] : undefined;
		const modelFromEnv = modelEnvKey ? process.env[modelEnvKey] : undefined;
		const keyFromEnv = keyEnvKey ? process.env[keyEnvKey] : undefined;

		// DB values take precedence, then file config, then env
		if (dbRow) {
			const hasUrl = dbRow.api_url != null;
			const hasModel = dbRow.model != null;
			const hasKey = dbRow.api_key != null;
			if (hasUrl || hasModel || hasKey) {
				return {
					api_url: dbRow.api_url ?? undefined,
					model: dbRow.model ?? undefined,
					has_key: hasKey,
					source: 'database',
				};
			}
		}

		// Fall through to file config
		switch (role) {
			case 'embed': {
				const url = fileConfig?.embed_api_url ?? urlFromEnv;
				const model = fileConfig?.embed_api_model ?? modelFromEnv;
				const hasKey = Boolean(fileConfig?.embed_api_key ?? keyFromEnv);
				if (url || model || hasKey)
					return {
						api_url: url,
						model,
						has_key: hasKey,
						source: fileConfig?.embed_api_url ? 'config' : 'env',
					};
				break;
			}
			case 'rerank': {
				const url = fileConfig?.rerank_api_url ?? urlFromEnv;
				const model = fileConfig?.rerank_api_model ?? modelFromEnv;
				const hasKey = Boolean(fileConfig?.rerank_api_key ?? keyFromEnv);
				if (url || model || hasKey)
					return {
						api_url: url,
						model,
						has_key: hasKey,
						source: fileConfig?.rerank_api_url ? 'config' : 'env',
					};
				break;
			}
			case 'expand': {
				const url = fileConfig?.expand_api_url ?? urlFromEnv;
				const model = fileConfig?.expand_api_model ?? modelFromEnv;
				const hasKey = Boolean(fileConfig?.expand_api_key ?? keyFromEnv);
				if (url || model || hasKey)
					return {
						api_url: url,
						model,
						has_key: hasKey,
						source: fileConfig?.expand_api_url ? 'config' : 'env',
					};
				break;
			}
			case 'asr': {
				const model = fileConfig?.asr_model ?? modelFromEnv;
				if (model)
					return {
						api_url: undefined,
						model,
						has_key: false,
						source: fileConfig?.asr_model ? 'config' : 'env',
					};
				break;
			}
		}

		return { api_url: undefined, model: undefined, has_key: false, source: 'none' };
	}

	return {
		embed: roleSettings('embed', 'QMD_EMBED_API_URL', 'QMD_EMBED_API_MODEL', 'QMD_EMBED_API_KEY'),
		rerank: roleSettings(
			'rerank',
			'QMD_RERANK_API_URL',
			'QMD_RERANK_API_MODEL',
			'QMD_RERANK_API_KEY',
		),
		expand: roleSettings(
			'expand',
			'QMD_EXPAND_API_URL',
			'QMD_EXPAND_API_MODEL',
			'QMD_EXPAND_API_KEY',
		),
		asr: roleSettings('asr', undefined, 'LATTICE_ASR_MODEL', undefined),
	};
}

// Retrieve raw API keys from DB for use in RemoteLLM config (never returned in API responses).
function getDbApiKeys(db: Database): Record<string, string | null> {
	const rows = db.query('SELECT role, api_key FROM inference_config').all() as Pick<
		InferenceConfigRow,
		'role' | 'api_key'
	>[];
	return Object.fromEntries(rows.map((r) => [r.role, r.api_key]));
}

export function applyInferenceSettings(db: Database): void {
	const s = getInferenceSettings(db);

	if (!s.embed.api_url || !s.embed.model) {
		setDefaultLLM(null);
		return;
	}

	const keys = getDbApiKeys(db);
	const fileConfig = getQmdModelsConfig();

	const cfg: RemoteLLMConfig = {
		embedApiUrl: s.embed.api_url,
		embedApiModel: s.embed.model,
	};

	// API keys: DB wins over env/config
	const embedKey = keys.embed ?? process.env.QMD_EMBED_API_KEY ?? fileConfig?.embed_api_key;
	if (embedKey) cfg.embedApiKey = embedKey;

	if (s.rerank.api_url && s.rerank.model) {
		cfg.rerankApiUrl = s.rerank.api_url;
		cfg.rerankApiModel = s.rerank.model;
		const rerankKey = keys.rerank ?? process.env.QMD_RERANK_API_KEY ?? fileConfig?.rerank_api_key;
		if (rerankKey) cfg.rerankApiKey = rerankKey;
	}

	if (s.expand.api_url && s.expand.model) {
		cfg.expandApiUrl = s.expand.api_url;
		cfg.expandApiModel = s.expand.model;
		const expandKey = keys.expand ?? process.env.QMD_EXPAND_API_KEY ?? fileConfig?.expand_api_key;
		if (expandKey) cfg.expandApiKey = expandKey;
	}

	try {
		setDefaultLLM(new RemoteLLM(cfg));
	} catch (err) {
		console.error('[settings] failed to apply inference settings — search unavailable:', err);
		setDefaultLLM(null);
	}
}
