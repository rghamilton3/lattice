<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import { browser } from '$app/environment';
	import { getWorkbenchContext } from '$lib/state/workbench.svelte';
	import { searchKeys, fetchSimilar } from '$lib/api/search';
	import type { DocRef, SearchResult } from '$lib/types';

	const {
		paneIndex,
		lateralRef
	}: {
		paneIndex: 0 | 1;
		lateralRef: { id: number | string; docKind: 'capture' | 'local-file' | 'working' };
	} = $props();

	const wb = getWorkbenchContext();

	const relatedQuery = createQuery(() => ({
		queryKey: searchKeys.similar(lateralRef.id, lateralRef.docKind),
		queryFn: () => fetchSimilar(lateralRef.id, lateralRef.docKind),
		enabled: browser && wb.featureFlags.relatedRail
	}));

	function toRef(r: SearchResult): DocRef {
		if (r.kind === 'capture') return { kind: 'capture', id: r.id };
		if (r.kind === 'local-file') return { kind: 'file', id: r.id };
		return { kind: 'working', slug: r.slug };
	}

	function chipClass(kind: SearchResult['kind']): string {
		return kind === 'local-file' ? 'chip-file' : `chip-${kind}`;
	}

	function chipLabel(kind: SearchResult['kind']): string {
		return kind === 'local-file' ? 'local file' : kind;
	}

	function machineId(r: SearchResult): string | undefined {
		return r.kind === 'local-file' ? r.machine_id : undefined;
	}
</script>

{#if wb.featureFlags.relatedRail}
	{#if relatedQuery.isError}
		<div class="related-rail">
			<div class="related-head">
				<span class="related-title">Related notes</span>
				<span class="faint" style="font-size:12px; color:var(--c-alarm)">couldn't load</span>
			</div>
			<button class="btn btn-ghost" onclick={() => relatedQuery.refetch()}>Try again</button>
		</div>
	{:else if relatedQuery.data && relatedQuery.data.results.length > 0}
		<div class="related-rail">
			<div class="related-head">
				<span class="related-title">Related notes</span>
				<span class="faint" style="font-size:12px">semantic neighbors · QMD cosine</span>
			</div>
			<div class="related-list">
				{#each relatedQuery.data.results.slice(0, 6) as r (`${r.kind}:${r.kind === 'working' ? r.slug : r.id}`)}
					<button
						class="related-card"
						onclick={() => wb.openInPane(paneIndex, { kind: 'doc', ref: toRef(r) })}
					>
						<div class="row" style="gap:6px">
							<span class="chip {chipClass(r.kind)}">{chipLabel(r.kind)}</span>
							{#if machineId(r)}
								<span class="mono faint" style="font-size:11px">@{machineId(r)}</span>
							{/if}
						</div>
						<div class="related-snippet soft">{r.snippet}</div>
					</button>
				{/each}
			</div>
		</div>
	{/if}
{/if}
