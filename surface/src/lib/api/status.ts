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
}

export const statusKeys = {
	all: () => ['status'] as const
};

export function fetchStatus(): Promise<StatusResponse> {
	return apiFetch<StatusResponse>('/api/status');
}
