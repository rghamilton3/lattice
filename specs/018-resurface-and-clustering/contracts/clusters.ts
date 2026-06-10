// API Contract: /api/cluster/*
// Implemented in: spine/src/routes/clusters.ts

// GET /api/cluster/:id
// Returns all members of a cluster with snippets.
// 404 if the cluster ID does not exist (e.g. after a re-clustering run).

export interface ClusterMember {
	target_kind: 'capture' | 'working' | 'local-file';
	target_id: string;
	title: string;   // capture text (truncated), working doc title, file basename
	snippet: string; // first ~200 chars of document text
}

export interface GetClusterResponse {
	id: number;
	run_at: string; // ISO 8601, when this clustering run was executed
	members: ClusterMember[];
}

// GET /api/cluster/doc/:kind/:target_id
// Returns the cluster ID for a given document, or null if not clustered.
// :kind   = 'capture' | 'working' | 'local-file'
// :target_id = numeric string for captures, slug for working, path for local-file
//
// Note: route ordering in Elysia — this must be registered BEFORE /api/cluster/:id
// to prevent ":id" from swallowing "doc".

export interface GetDocClusterResponse {
	clusterId: number | null;
}
