<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import { SvelteSet } from 'svelte/reactivity';
	import { browser } from '$app/environment';
	import { getWorkbenchContext } from '$lib/state/workbench.svelte';
	import { searchKeys, fetchSearch } from '$lib/api/search';
	import type { SearchResult } from '$lib/types';
	import Icon from '$components/icons/Icon.svelte';
	import Facets, { type Kind, type Sort } from './Facets.svelte';
	import ResultRow from './ResultRow.svelte';

	const { paneIndex, query: initialQuery }: { paneIndex: 0 | 1; query: string } = $props();

	const wb = getWorkbenchContext();

	let input = $state('');
	let debouncedQ = $state('');

	$effect(() => {
		input = initialQuery;
		debouncedQ = initialQuery;
	});

	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	function onInput(e: Event) {
		input = (e.target as HTMLInputElement).value;
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			debouncedQ = input;
			wb.openInPane(paneIndex, { kind: 'search', query: input });
		}, 300);
	}

	// Don't let a pending debounce callback fire after unmount and clobber
	// whatever pane the user navigated to.
	$effect(() => () => {
		if (debounceTimer) clearTimeout(debounceTimer);
	});

	const searchQuery = createQuery(() => ({
		queryKey: searchKeys.search(debouncedQ),
		queryFn: () => fetchSearch(debouncedQ),
		enabled: browser && debouncedQ.length > 0
	}));

	// Deep search lives in the workbench so it survives pane navigation.
	const deepState = $derived(wb.deepSearch?.q === debouncedQ ? wb.deepSearch : null);
	const deepRunning = $derived(deepState?.status === 'running');
	const deepDone = $derived(deepState?.status === 'done');

	const defaultKinds: Kind[] = ['capture', 'local-file', 'working'];
	const kindFilter = new SvelteSet<Kind>(defaultKinds);
	let sort = $state<Sort>('recency');

	function toggleKind(k: Kind) {
		if (kindFilter.has(k)) kindFilter.delete(k);
		else kindFilter.add(k);
	}

	function resetFacets() {
		kindFilter.clear();
		for (const k of defaultKinds) kindFilter.add(k);
	}

	// Stale facet from a previous query (e.g. "0 of 30") would confuse the user.
	// Reset to defaults whenever the active query changes.
	let lastQuery = '';
	$effect(() => {
		if (debouncedQ !== lastQuery) {
			lastQuery = debouncedQ;
			resetFacets();
		}
	});

	// Show deep results when available for this query, fast results otherwise.
	const rawResults = $derived<SearchResult[]>(
		deepDone ? (deepState?.results ?? []) : (searchQuery.data?.results ?? [])
	);

	const filtered = $derived<SearchResult[]>(
		rawResults.filter((r) => kindFilter.has(r.kind as Kind))
	);

	// "Recency-broken" should tie-break ties (|Δscore| < 0.02) by modified_at desc;
	// but SearchResult has no modified_at yet — so we keep spine's order in that mode
	// and only re-sort when the user explicitly asks for score-only.
	// TODO(spine): switch to true tie-broken sort once SearchResult.modified_at exists.
	const displayed = $derived<SearchResult[]>(
		sort === 'score' ? [...filtered].sort((a, b) => b.score - a.score) : filtered
	);
</script>

<div class="search-view">
	<div class="search-bar">
		<Icon name="search" size={16} />
		<!-- svelte-ignore a11y_autofocus -->
		<input
			autofocus
			type="text"
			class="search-input"
			value={input}
			oninput={onInput}
			placeholder="What were you trying to find?"
		/>
		{#if debouncedQ.length > 0}
			<span class="faint mono" style="font-size:12px">
				{displayed.length} of {rawResults.length} results
			</span>
		{/if}
	</div>

	<div class="search-body">
		<Facets
			clustersEnabled={wb.featureFlags.clusters}
			{kindFilter}
			{toggleKind}
			{sort}
			setSort={(s) => (sort = s)}
		/>

		<section class="results">
			{#if debouncedQ.length === 0}
				<div class="results-empty soft">
					Type to search across captures, files, and working docs.
				</div>
			{:else if searchQuery.isLoading}
				<div class="results-empty soft">searching…</div>
			{:else if searchQuery.isError}
				<div class="results-empty soft" style="color:var(--c-alarm)">
					error: {searchQuery.error?.message}
				</div>
			{:else if rawResults.length === 0}
				<div class="results-empty soft">
					No results for "{debouncedQ}".
					{#if !deepState}
						<button
							class="btn btn-ghost"
							style="margin-left:8px"
							onclick={() => wb.runDeepSearch(debouncedQ)}
						>
							Try deep search?
						</button>
					{:else if deepRunning}
						<span class="faint" style="margin-left:8px; font-size:12px">
							Thinking… (safe to navigate away)
						</span>
					{/if}
				</div>
			{:else if displayed.length === 0}
				<div class="results-empty soft">
					No matches in the kinds you have selected.
					<button class="btn btn-ghost" style="margin-left:8px" onclick={resetFacets}>
						reset filters
					</button>
				</div>
			{:else}
				{#each displayed as result (`${result.kind}:${result.id}`)}
					<ResultRow {paneIndex} {result} />
				{/each}
				<div class="results-foot faint" style="font-size:12px">
					{deepDone ? 'Deep search — LLM expanded and reranked.' : 'Most recent first. "similar / mentions / nearby" live inside each opened result.'}
				</div>
				{#if !deepState}
					<div style="padding: 12px 0 4px">
						<button class="btn btn-ghost" onclick={() => wb.runDeepSearch(debouncedQ)}>
							Deep search (LLM expand + rerank — slow)
						</button>
					</div>
				{:else if deepRunning}
					<div class="faint" style="font-size:12px; padding: 12px 0 4px">
						Thinking… (safe to navigate away)
					</div>
				{/if}
			{/if}
		</section>
	</div>
</div>
