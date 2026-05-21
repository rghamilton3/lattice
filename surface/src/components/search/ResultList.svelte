<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import { browser } from '$app/environment';
	import { getWorkbenchContext } from '$lib/state/workbench.svelte';
	import { searchKeys, fetchSearch, fetchSimilar, fetchNearby } from '$lib/api/search';
	import { createWorking } from '$lib/api/working';
	import type { SearchResult, LateralSource, DocRef } from '$lib/types';

	const {
		paneIndex,
		items: preloadedItems,
		source
	}: {
		paneIndex: 0 | 1;
		items?: SearchResult[];
		source?: LateralSource;
	} = $props();

	const wb = getWorkbenchContext();

	// Separate query for each lateral source type to avoid type union issues
	const mentionsQuery = createQuery(() => ({
		queryKey: source?.kind === 'mentions' ? searchKeys.search(source.q) : (['noop'] as const),
		queryFn: () =>
			source?.kind === 'mentions' ? fetchSearch(source.q) : Promise.resolve({ results: [] as SearchResult[] }),
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
				if (r.kind === 'capture') return [{ kind: 'capture' as const, id: r.id, score: 0, snippet: r.snippet, body: r.snippet, path: `capture/${r.id}` }];
				if (r.kind === 'local-file') return [{ kind: 'local-file' as const, id: r.id, score: 0, snippet: r.snippet, body: r.snippet, path: `local-file/${r.id}`, machine_id: r.machine_id ?? '' }];
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
		source
			? (activeQuery?.data?.results ?? [])
			: (preloadedItems ?? [])
	);

	const isLoading = $derived(source ? (activeQuery?.isLoading ?? false) : false);
	const loadError = $derived(source ? (activeQuery?.error?.message ?? null) : null);

	function refToDocRef(r: SearchResult): DocRef {
		if (r.kind === 'capture') return { kind: 'capture', id: r.id };
		if (r.kind === 'working') return { kind: 'working', slug: r.slug };
		return { kind: 'file', id: r.id };
	}

	const kindClass: Record<string, string> = {
		capture: 'text-capture',
		'local-file': 'text-file',
		working: 'text-working'
	};

	let promoteErrors: Record<number, string> = $state({});

	async function promoteResult(result: SearchResult & { kind: 'capture' | 'local-file' }, i: number) {
		promoteErrors = { ...promoteErrors, [i]: '' };
		const title = result.path.split('/').pop() ?? 'untitled';
		const params = result.kind === 'capture'
			? { title, seed_capture_id: result.id }
			: { title, seed_file_id: result.id };
		try {
			const { slug } = await createWorking(params);
			wb.openInPane(paneIndex, { kind: 'editor', slug });
		} catch (e) {
			promoteErrors = { ...promoteErrors, [i]: e instanceof Error ? e.message : 'promote failed' };
		}
	}
</script>

<div class="h-full overflow-y-auto">
	{#if isLoading}
		<p class="p-3 text-sm text-text-muted">loading…</p>
	{:else if loadError}
		<p class="p-3 text-sm text-red-400">{loadError}</p>
	{:else if displayItems.length === 0}
		<p class="p-3 text-sm text-text-muted">no results</p>
	{:else}
		{#each displayItems as result, i (i)}
			<div class="border-b border-border">
				<div class="px-3 pt-2 pb-1">
					<div class="flex items-center gap-2">
						<span class="text-xs {kindClass[result.kind] ?? 'text-text-muted'}">{result.kind}</span>
						{#if result.kind === 'local-file'}
							<span class="text-xs text-text-muted">@{result.machine_id}</span>
						{/if}
						{#if result.score > 0}
							<span class="ml-auto text-xs text-text-muted">{result.score.toFixed(2)}</span>
						{/if}
					</div>
					<p class="mt-1 line-clamp-3 text-sm text-text">{result.snippet}</p>
				</div>
				<div class="flex flex-wrap gap-1 px-3 pb-2">
					<button
						class="rounded px-2 py-0.5 text-sm text-text-muted hover:bg-surface-high hover:text-text"
						onclick={() => wb.openInPane(paneIndex, { kind: 'doc', ref: refToDocRef(result) })}
					>open</button>
					<button
						class="rounded px-2 py-0.5 text-sm text-text-muted hover:bg-surface-high hover:text-text"
						onclick={() => wb.openInOther(paneIndex, { kind: 'doc', ref: refToDocRef(result) })}
					>open →</button>
					{#if result.kind !== 'working'}
						<button
							class="rounded px-2 py-0.5 text-sm text-text-muted hover:bg-surface-high hover:text-text"
							onclick={() => promoteResult(result, i)}
						>promote</button>
						{#if promoteErrors[i]}
							<span class="text-xs text-red-400">{promoteErrors[i]}</span>
						{/if}
					{/if}
				</div>
			</div>
		{/each}
	{/if}
</div>
