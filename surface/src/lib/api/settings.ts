import { apiFetch } from './client';

export interface InferenceRoleResponse {
	api_url?: string;
	model?: string;
	has_key: boolean;
	source: 'database' | 'config' | 'env' | 'none';
}

export interface InferenceSettingsResponse {
	embed: InferenceRoleResponse;
	rerank: InferenceRoleResponse;
	expand: InferenceRoleResponse;
	asr: InferenceRoleResponse;
}

export interface InferenceRoleUpdate {
	api_url?: string | null;
	model?: string | null;
	api_key?: string | null;
}

export interface InferenceUpdateBody {
	embed?: InferenceRoleUpdate;
	rerank?: InferenceRoleUpdate;
	expand?: Omit<InferenceRoleUpdate, 'api_url'> & { api_url?: string | null };
	asr?: Omit<InferenceRoleUpdate, 'api_url'>;
}

export interface ProbeResult {
	reachable: boolean;
	latency_ms: number;
	error?: string;
}

export interface ProbeResponse {
	embed?: ProbeResult;
	rerank?: ProbeResult;
	expand?: ProbeResult;
}

export interface SecurityResponse {
	has_agent_token: boolean;
	agent_token_source: 'database' | 'config' | 'env' | 'none';
}

export const settingsKeys = {
	inference: () => ['settings', 'inference'] as const,
	security: () => ['settings', 'security'] as const
};

export function fetchInferenceSettings(): Promise<InferenceSettingsResponse> {
	return apiFetch<InferenceSettingsResponse>('/api/settings/inference');
}

export function updateInferenceSettings(body: InferenceUpdateBody): Promise<void> {
	return apiFetch<void>('/api/settings/inference', {
		method: 'PUT',
		body: JSON.stringify(body)
	});
}

export function probeInferenceEndpoints(): Promise<ProbeResponse> {
	return apiFetch<ProbeResponse>('/api/settings/inference/probe', { method: 'POST' });
}

export function fetchSecuritySettings(): Promise<SecurityResponse> {
	return apiFetch<SecurityResponse>('/api/settings/security');
}

export function rotateAgentToken(): Promise<{ token: string }> {
	return apiFetch<{ token: string }>('/api/settings/security/rotate-agent-token', {
		method: 'POST'
	});
}

export function setAgentToken(token: string): Promise<void> {
	return apiFetch<void>('/api/settings/security', {
		method: 'PUT',
		body: JSON.stringify({ agent_token: token })
	});
}
