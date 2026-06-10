import type { ClusterDetail } from '$lib/types';

export const clusterKeys = {
	detail: (id: number) => ['cluster', 'detail', id] as const,
	docCluster: (kind: string, targetId: string) => ['cluster', 'doc', kind, targetId] as const
};

export async function fetchCluster(id: number): Promise<ClusterDetail> {
	const res = await fetch(`/api/cluster/${id}`);
	if (res.status === 404) throw new Error('Cluster not found');
	if (!res.ok) throw new Error('Failed to fetch cluster');
	return res.json();
}

export async function fetchDocCluster(
	kind: string,
	targetId: string
): Promise<{ clusterId: number | null }> {
	const res = await fetch(`/api/cluster/doc/${kind}/${encodeURIComponent(targetId)}`);
	if (!res.ok) throw new Error('Failed to fetch doc cluster');
	return res.json();
}
