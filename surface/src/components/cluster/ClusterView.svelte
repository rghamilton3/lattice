<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import { browser } from '$app/environment';
	import { getWorkbenchContext } from '$lib/state/workbench.svelte';
	import type { DocRef, ClusterMember } from '$lib/types';
	import { clusterKeys, fetchCluster } from '$lib/api/clusters';

	const { paneIndex, clusterId }: { paneIndex: 0 | 1; clusterId: number } = $props();

	const wb = getWorkbenchContext();

	const query = createQuery(() => ({
		queryKey: clusterKeys.detail(clusterId),
		queryFn: () => fetchCluster(clusterId),
		enabled: browser
	}));

	function docRefFrom(member: ClusterMember): DocRef | null {
		if (member.target_kind === 'capture')
			return { kind: 'capture', id: parseInt(member.target_id, 10) };
		if (member.target_kind === 'working') return { kind: 'working', slug: member.target_id };
		return null;
	}
</script>

<div class="cluster-view flex h-full flex-col overflow-hidden">
	{#if query.isPending}
		<div class="resurf-empty soft px-4 py-8 text-sm text-text-muted">Loading cluster…</div>
	{:else if query.isError}
		<div class="resurf-empty soft px-4 py-8 text-sm text-text-muted">
			This cluster is no longer available — it may have been updated. Try reopening from a document.
		</div>
	{:else if query.isSuccess}
		{@const { members } = query.data}
		{#if members.length === 0}
			<div class="resurf-empty soft px-4 py-8 text-sm text-text-muted">
				No members in this cluster.
			</div>
		{:else}
			<div class="flex-1 overflow-y-auto">
				{#each members as member (member.target_kind + ':' + member.target_id)}
					{@const ref = docRefFrom(member)}
					<div
						class="resurf-row cursor-pointer px-4 py-3 hover:bg-surface-raised"
						role="button"
						tabindex="0"
						onclick={() => ref && wb.openInPane(paneIndex, { kind: 'doc', ref })}
						onkeydown={(e) => {
							if ((e.key === 'Enter' || e.key === ' ') && ref) {
								e.preventDefault();
								wb.openInPane(paneIndex, { kind: 'doc', ref });
							}
						}}
					>
						{#if member.title}
							<div class="truncate text-sm font-medium">{member.title}</div>
						{/if}
						{#if member.snippet}
							<div class="mt-0.5 line-clamp-2 text-xs text-text-muted">{member.snippet}</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	{/if}
</div>
