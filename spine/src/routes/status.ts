import { Elysia } from 'elysia';
import type { Database } from 'bun:sqlite';
import type { AgentStatusRow } from '../db/rows';
import type { PlatformStatus } from '../status';
import { isSearchDegraded, needsEmbeddingCount, indexFailureCount } from '../search';
import { getInferenceSettings } from '../settings';
import type { InferenceRole } from '../settings';

export const statusRoutes = (db: Database, platformStatus: () => PlatformStatus) =>
	new Elysia().get('/api/status', async () => {
		const agents = db
			.query(
				'SELECT machine_id, state, last_scan_at, last_indexed, last_skipped, last_errors, spine_ok, last_error_msg, reported_at FROM agent_status',
			)
			.all() as AgentStatusRow[];
		const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
		const active_agent_count = agents.filter((a) => a.reported_at > fiveMinAgo).length;
		const { ready, state, checks } = platformStatus();
		const inferenceSettings = getInferenceSettings(db);
		const inferenceRoles: InferenceRole[] = ['embed', 'rerank', 'expand', 'asr'];
		const inference_endpoints = inferenceRoles.map((role) => ({
			role,
			url: inferenceSettings[role].api_url ?? null,
			status:
				inferenceSettings[role].api_url === undefined
					? ('unconfigured' as const)
					: role === 'embed' && isSearchDegraded()
						? ('degraded' as const)
						: ('ok' as const),
			last_ok_at: null as string | null,
		}));
		return {
			ready,
			state,
			checks,
			agents: agents.map((a) => ({
				machine_id: a.machine_id,
				state: a.state,
				last_scan_at: a.last_scan_at,
				last_indexed: a.last_indexed,
			})),
			active_agent_count,
			// Remote inference health: keyword-only mode, embedding backlog awaiting recovery
			// (null when unknown), and consecutive lexical-index failures (0 when healthy).
			search_degraded: isSearchDegraded(),
			needs_embedding: await needsEmbeddingCount(),
			index_failures: indexFailureCount(),
			inference_endpoints,
		};
	});
