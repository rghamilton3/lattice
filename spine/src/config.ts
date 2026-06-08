import { parse } from 'smol-toml';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

// Intentional structural subset of QMD's internal ModelsConfig (remote-api fields only).
// ModelsConfig is not in @tobilu/qmd's public exports, so we maintain a local copy.
interface QmdModelsConfig {
	embed_api_url?: string;
	embed_api_model?: string;
	embed_api_key?: string;
	rerank_api_url?: string;
	rerank_api_model?: string;
	rerank_api_key?: string;
	expand_api_url?: string;
	expand_api_model?: string;
	expand_api_key?: string;
}

interface LatticeConfig {
	spine?: {
		agent_token?: string;
		database_path?: string;
		qmd?: QmdModelsConfig;
	};
}

function xdgConfigHome(): string {
	return process.env.XDG_CONFIG_HOME ?? join(process.env.HOME ?? '/root', '.config');
}

function readLatticeConfig(): LatticeConfig {
	const path = join(xdgConfigHome(), 'lattice', 'config.toml');
	if (!existsSync(path)) return {};
	try {
		return parse(readFileSync(path, 'utf-8')) as LatticeConfig;
	} catch (e) {
		console.warn(`[config] failed to parse ${path}:`, e);
		return {};
	}
}

export function getAgentToken(): string | undefined {
	return process.env.LATTICE_AGENT_TOKEN ?? readLatticeConfig().spine?.agent_token;
}

export function getDatabasePath(): string {
	return (
		process.env.DATABASE_PATH ?? readLatticeConfig().spine?.database_path ?? './lattice.dev.db'
	);
}

export function getQmdModelsConfig(): QmdModelsConfig | undefined {
	// QMD reads QMD_EMBED_API_URL / QMD_EMBED_API_MODEL etc. via remoteConfigFromEnv(),
	// giving env vars precedence over these config.toml values. QMD also throws at startup
	// if embed_api_url and embed_api_model are only partially configured (either both or neither).
	return readLatticeConfig().spine?.qmd;
}
