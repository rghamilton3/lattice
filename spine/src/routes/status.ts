import { Elysia } from 'elysia';
import type { Database } from 'bun:sqlite';
import type { AgentStatusRow } from '../db/rows';
import type { PlatformStatus } from '../status';

export const statusRoutes = (db: Database, platformStatus: () => PlatformStatus) =>
	new Elysia().get('/api/status', () => {
		const agents = db
			.query(
				'SELECT machine_id, state, last_scan_at, last_indexed, last_skipped, last_errors, spine_ok, last_error_msg, reported_at FROM agent_status',
			)
			.all() as AgentStatusRow[];
		const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
		const active_agent_count = agents.filter((a) => a.reported_at > fiveMinAgo).length;
		const { ready, state, checks } = platformStatus();
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
		};
	});
