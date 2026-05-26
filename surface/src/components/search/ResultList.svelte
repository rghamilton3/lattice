<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import { browser } from '$app/environment';
	import { searchKeys, fetchSearch, fetchSimilar, fetchNearby } from '$lib/api/search';
	import type { SearchResult, LateralSource } from '$lib/types';
	import ResultRow from './ResultRow.svelte';

	const {
		paneIndex,
		items: preloadedItems,
		source
	}: {
		paneIndex: 0 | 1;
		items?: SearchResult[];
		source?: LateralSource;
	} = $props();

	const mentionsQuery = createQuery(() => ({
		queryKey: source?.kind === 'mentions' ? searchKeys.search(source.q) : (['noop'] as const),
		queryFn: () =>
			source?.kind === 'mentions'
				? fetchSearch(source.q)
				: Promise.resolve({ results: [] as SearchResult[] }),
		enabled: browser && source?.kind === 'mentions'
	}));

	const similarQuery = createQuery(() => ({
		queryKey:
			source?.kind === 'similar'
				? searchKeys.similar(source.id, source.docKind)
				: (['noop-similar'] as const),
		queryFn: () =>
			source?.kind === 'similar'
				? fetchSimilar(source.id, source.docKind)
				: Promise.resolve({ results: [] as SearchResult[] }),
		enabled: browser && source?.kind === 'similar'
	}));

	const nearbyQuery = createQuery(() => ({
		queryKey:
			source?.kind === 'nearby'
				? searchKeys.nearby(source.timestamp, source.window_hours)
				: (['noop-nearby'] as const),
		queryFn: async () => {
			if (source?.kind !== 'nearby') return { results: [] as SearchResult[] };
			const data = await fetchNearby(source.timestamp, source.window_hours);
			const results: SearchResult[] = data.results.flatMap((r): SearchResult[] => {
				if (r.kind === 'capture')
					return [
						{
							kind: 'capture' as const,
							id: r.id,
							score: 0,
							snippet: r.snippet,
							body: r.snippet,
							path: `capture/${r.id}`,
							modified_at: r.ts
						}
					];
				if (r.kind === 'local-file')
					return [
						{
							kind: 'local-file' as const,
							id: r.id,
							score: 0,
							snippet: r.snippet,
							body: r.snippet,
							path: `local-file/${r.id}`,
							machine_id: r.machine_id ?? '',
							modified_at: r.ts
						}
					];
				return [];
			});
			return { results };
		},
		enabled: browser && source?.kind === 'nearby'
	}));

	const activeQuery = $derived(
		source?.kind === 'mentions'
			? mentionsQuery
			: source?.kind === 'similar'
				? similarQuery
				: source?.kind === 'nearby'
					? nearbyQuery
					: null
	);

	const displayItems = $derived<SearchResult[]>(
		source ? (activeQuery?.data?.results ?? []) : (preloadedItems ?? [])
	);

	const isLoading = $derived(source ? (activeQuery?.isLoading ?? false) : false);
	const loadError = $derived(source ? (activeQuery?.error?.message ?? null) : null);
</script>

<div class="results" style="height:100%">
	{#if isLoading}
		<div class="results-empty soft" role="status">Loading related results...</div>
	{:else if loadError}
		<div class="results-empty soft" style="color:var(--c-alarm)" role="alert">
			Couldn't load related results: {loadError}
		</div>
	{:else if displayItems.length === 0}
		<div class="results-empty soft">No related results found.</div>
	{:else}
		{#each displayItems as result (`${result.kind}:${result.id}`)}
			<ResultRow {paneIndex} {result} />
		{/each}
	{/if}
</div>
