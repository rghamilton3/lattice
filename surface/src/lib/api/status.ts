import { apiFetch } from './client';

export interface AgentSummary {
	machine_id: string;
	state: 'idle' | 'scanning' | 'error';
	last_scan_at: string | null;
	last_indexed: number;
}

export interface StatusResponse {
	agents: AgentSummary[];
	active_agent_count: number;
	/** True when the remote inference endpoint is down and search is BM25 keyword-only. */
	search_degraded: boolean;
	/** Documents awaiting embedding (drains once the endpoint recovers); null when unknown. */
	needs_embedding: number | null;
	/** Consecutive lexical index failures (0 when healthy). */
	index_failures: number;
}

export const statusKeys = {
	all: () => ['status'] as const
};

export function fetchStatus(): Promise<StatusResponse> {
	return apiFetch<StatusResponse>('/api/status');
}
