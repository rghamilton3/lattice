import { apiFetch } from './client';

export interface InferenceRoleResponse {
	/** Effective URL after global + file/env fallbacks. */
	api_url?: string;
	/** This role's own override (absent when inheriting). */
	own_api_url?: string;
	model?: string;
	has_key: boolean;
	has_own_key: boolean;
	inherits_url: boolean;
	inherits_key: boolean;
	source: 'database' | 'config' | 'env' | 'none';
}

export interface GlobalInferenceResponse {
	api_url?: string;
	has_key: boolean;
	source: 'database' | 'none';
}

export interface InferenceSettingsResponse {
	global: GlobalInferenceResponse;
	embed: InferenceRoleResponse;
	rerank: InferenceRoleResponse;
	expand: InferenceRoleResponse;
	asr: InferenceRoleResponse;
	vlm: InferenceRoleResponse;
}

export interface InferenceRoleUpdate {
	api_url?: string | null;
	model?: string | null;
	api_key?: string | null;
}

export interface GlobalUpdate {
	api_url?: string | null;
	api_key?: string | null;
}

export interface InferenceUpdateBody {
	global?: GlobalUpdate;
	embed?: InferenceRoleUpdate;
	rerank?: InferenceRoleUpdate;
	expand?: InferenceRoleUpdate;
	asr?: InferenceRoleUpdate;
	vlm?: InferenceRoleUpdate;
}

export type InferenceRole = 'embed' | 'rerank' | 'expand' | 'asr' | 'vlm';

export interface ProbeResult {
	reachable: boolean;
	latency_ms: number;
	error?: string;
	/** Models the endpoint advertised, present when reachable. */
	models?: string[];
}

export interface ProbeResponse {
	embed?: ProbeResult;
	rerank?: ProbeResult;
	expand?: ProbeResult;
	asr?: ProbeResult;
	vlm?: ProbeResult;
}

export interface ModelsResponse {
	models: string[];
}

export interface VersionResponse {
	spine: string;
}

export interface SecurityResponse {
	has_agent_token: boolean;
	agent_token_source: 'database' | 'config' | 'env' | 'none';
}

export const settingsKeys = {
	inference: () => ['settings', 'inference'] as const,
	security: () => ['settings', 'security'] as const,
	version: () => ['settings', 'version'] as const,
	models: (role: InferenceRole) => ['settings', 'models', role] as const
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

export interface ProbeRequestRole {
	url?: string;
	api_key?: string;
}

export type ProbeRequest = Partial<Record<InferenceRole, ProbeRequestRole>>;

export function probeInferenceEndpoints(overrides?: ProbeRequest): Promise<ProbeResponse> {
	return apiFetch<ProbeResponse>('/api/settings/inference/probe', {
		method: 'POST',
		body: JSON.stringify(overrides ?? {})
	});
}

export interface ModelsRequest {
	role: InferenceRole;
	/** Unsaved URL from the form; server falls back to stored config when omitted. */
	url?: string;
	/** Unsaved key from the form; server falls back to the stored key when omitted. */
	api_key?: string;
}

export function fetchInferenceModels(request: ModelsRequest): Promise<ModelsResponse> {
	// role + url go in the query (non-sensitive); only the optional key in the body.
	const params = new URLSearchParams({ role: request.role });
	if (request.url) params.set('url', request.url);
	return apiFetch<ModelsResponse>(`/api/settings/inference/models?${params.toString()}`, {
		method: 'POST',
		body: JSON.stringify({ api_key: request.api_key ?? null })
	});
}

export function fetchSpineVersion(): Promise<VersionResponse> {
	return apiFetch<VersionResponse>('/api/settings/version');
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
