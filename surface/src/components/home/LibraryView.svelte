<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import { SvelteSet } from 'svelte/reactivity';
	import { browser } from '$app/environment';
	import { getWorkbenchContext } from '$lib/state/workbench.svelte';
	import { captureKeys, fetchCaptures, TRIAGE_ACTION_LABEL } from '$lib/api/captures';
	import { workingKeys, fetchWorkingList } from '$lib/api/working';
	import { fileKeys, fetchFileList } from '$lib/api/files';
	import { searchKeys, fetchSearch } from '$lib/api/search';
	import type { SearchResult } from '$lib/types';
	import Icon from '$components/icons/Icon.svelte';
	import Facets, { type Kind, type Sort } from '$components/search/Facets.svelte';
	import ResultRow from '$components/search/ResultRow.svelte';
	import { relTime } from '$lib/utils/relTime';

	const { paneIndex, query: initialQuery }: { paneIndex: 0 | 1; query: string } = $props();

	const wb = getWorkbenchContext();

	// ── Search input state ─────────────────────────────────────────────────────

	let input = $state('');
	let debouncedQ = $state('');

	$effect(() => {
		// Only sync from the pane prop when not mid-edit to avoid clobbering
		// a user's in-progress input (e.g. deep-search toast navigating back).
		if (debounceTimer === null) {
			input = initialQuery;
			debouncedQ = initialQuery;
		}
	});

	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	function onInput(e: Event) {
		input = (e.target as HTMLInputElement).value;
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			debouncedQ = input;
			wb.openInPane(paneIndex, { kind: 'library', query: input });
		}, 300);
	}

	$effect(() => () => {
		if (debounceTimer) clearTimeout(debounceTimer);
	});

	// ── Library (default) state — all kinds ────────────────────────────────────

	const LIBRARY_LIMIT = 200;
	const FILE_LIMIT = 100;

	const captureQuery = createQuery(() => ({
		queryKey: captureKeys.listAll(LIBRARY_LIMIT),
		queryFn: () => fetchCaptures(LIBRARY_LIMIT, true),
		enabled: browser && debouncedQ.length === 0
	}));

	const workingQuery = createQuery(() => ({
		queryKey: workingKeys.list(),
		queryFn: fetchWorkingList,
		enabled: browser && debouncedQ.length === 0
	}));

	const filesQuery = createQuery(() => ({
		queryKey: fileKeys.list(FILE_LIMIT),
		queryFn: () => fetchFileList(FILE_LIMIT),
		enabled: browser && debouncedQ.length === 0
	}));

	let now = $state(Date.now());
	$effect(() => {
		const t = setInterval(() => (now = Date.now()), 60_000);
		return () => clearInterval(t);
	});

	type LibraryItem = {
		id: string;
		kind: Kind;
		sortDate: string;
		icon: string;
		chipClass: string;
		chipLabel: string;
		text: string;
		mono: string;
		triaged: boolean;
		triageLabel: string | null;
		onclick: () => void;
	};

	const libraryItems = $derived.by<LibraryItem[]>(() => {
		const items: LibraryItem[] = [
			...(captureQuery.data ?? []).map((c) => ({
				id: `capture:${c.id}`,
				kind: 'capture' as Kind,
				sortDate: c.captured_at,
				icon: 'circle',
				chipClass: 'chip-capture',
				chipLabel: 'capture',
				text: c.text,
				mono: c.source,
				triaged: c.triaged_at !== null,
				triageLabel: c.triage_action
					? (
							TRIAGE_ACTION_LABEL[c.triage_action as keyof typeof TRIAGE_ACTION_LABEL] ??
							c.triage_action
						).toLowerCase()
					: null,
				onclick: () => wb.openInPane(paneIndex, { kind: 'doc', ref: { kind: 'capture', id: c.id } })
			})),
			...(workingQuery.data ?? []).map((d) => ({
				id: `working:${d.slug}`,
				kind: 'working' as Kind,
				sortDate: d.modified_at,
				icon: 'edit',
				chipClass: 'chip-working',
				chipLabel: 'working',
				text: d.title,
				mono: `${d.slug}.md`,
				triaged: false,
				triageLabel: null,
				onclick: () =>
					wb.openInPane(paneIndex, { kind: 'doc', ref: { kind: 'working', slug: d.slug } })
			})),
			...(filesQuery.data ?? []).map((f) => ({
				id: `local-file:${f.id}`,
				kind: 'local-file' as Kind,
				sortDate: f.modified_at,
				icon: 'doc',
				chipClass: 'chip-file',
				chipLabel: 'file',
				text: f.path.split('/').pop() ?? f.path,
				mono: `@${f.machine_id}`,
				triaged: false,
				triageLabel: null,
				onclick: () => wb.openInPane(paneIndex, { kind: 'doc', ref: { kind: 'file', id: f.id } })
			}))
		];
		return items.sort((a, b) => b.sortDate.localeCompare(a.sortDate));
	});

	const filteredLibraryItems = $derived(libraryItems.filter((item) => kindFilter.has(item.kind)));

	const libraryIsLoading = $derived(
		debouncedQ.length === 0 &&
			(captureQuery.isLoading || workingQuery.isLoading || filesQuery.isLoading)
	);
	// Only block on the two primary sources; a files-list failure degrades silently
	// (local files are still accessible via search).
	const libraryIsError = $derived(
		debouncedQ.length === 0 && (captureQuery.isError || workingQuery.isError)
	);

	const totalCount = $derived(libraryItems.length);

	// ── Search state ────────────────────────────────────────────────────────────

	const searchQuery = createQuery(() => ({
		queryKey: searchKeys.search(debouncedQ),
		queryFn: () => fetchSearch(debouncedQ),
		enabled: browser && debouncedQ.length > 0
	}));

	const deepState = $derived(wb.deepSearch?.q === debouncedQ ? wb.deepSearch : null);
	const deepRunning = $derived(deepState?.status === 'running');
	const deepDone = $derived(deepState?.status === 'done');

	const defaultKinds: Kind[] = ['capture', 'local-file', 'working'];
	const kindFilter = new SvelteSet<Kind>(defaultKinds);
	let sort = $state<Sort>('recency');
	let facetsOpen = $state(true);
	let sidebarWidth = $state(240);

	function onResizeStart(e: MouseEvent) {
		e.preventDefault();
		const startX = e.clientX;
		const startW = sidebarWidth;
		function onMove(ev: MouseEvent) {
			sidebarWidth = Math.max(160, Math.min(480, startW + ev.clientX - startX));
		}
		function onUp() {
			window.removeEventListener('mousemove', onMove);
			window.removeEventListener('mouseup', onUp);
		}
		window.addEventListener('mousemove', onMove);
		window.addEventListener('mouseup', onUp);
	}

	function toggleKind(k: Kind) {
		if (kindFilter.has(k)) kindFilter.delete(k);
		else kindFilter.add(k);
	}

	function resetFacets() {
		kindFilter.clear();
		for (const k of defaultKinds) kindFilter.add(k);
	}

	const deepResults = $derived(deepState?.status === 'done' ? deepState.results : []);
	const rawResults = $derived<SearchResult[]>(
		deepDone ? deepResults : (searchQuery.data?.results ?? [])
	);

	const filtered = $derived<SearchResult[]>(
		rawResults.filter((r) => kindFilter.has(r.kind as Kind))
	);

	const SCORE_TIE_BUCKET = 0.02;
	const displayed = $derived<SearchResult[]>(
		sort === 'score'
			? [...filtered].sort((a, b) => b.score - a.score)
			: [...filtered].sort((a, b) => {
					const bucketA = Math.round(a.score / SCORE_TIE_BUCKET);
					const bucketB = Math.round(b.score / SCORE_TIE_BUCKET);
					if (bucketA !== bucketB) return bucketB - bucketA;
					return b.modified_at.localeCompare(a.modified_at);
				})
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
			aria-label="Search or filter your library"
			value={input}
			oninput={onInput}
			placeholder="Filter your library…"
		/>
		{#if debouncedQ.length > 0}
			<span class="faint mono" style="font-size:12px">
				{displayed.length} of {rawResults.length} results
			</span>
		{:else if !libraryIsLoading}
			<span class="faint mono" style="font-size:12px">
				{filteredLibraryItems.length}{filteredLibraryItems.length < totalCount
					? ` of ${totalCount}`
					: ''} items
			</span>
		{/if}
	</div>

	<div
		class="search-body"
		style="grid-template-columns: {facetsOpen ? sidebarWidth : 28}px minmax(0, 1fr)"
	>
		<Facets
			clustersEnabled={wb.featureFlags.clusters}
			{kindFilter}
			{toggleKind}
			{sort}
			setSort={(s) => (sort = s)}
			showSort={debouncedQ.length > 0}
			open={facetsOpen}
			onToggle={() => (facetsOpen = !facetsOpen)}
			{onResizeStart}
		/>

		{#if debouncedQ.length === 0}
			<!-- Library default state: all items, filtered by kind -->
			<div class="lib-scroll">
				<div class="lib-container">
					{#if libraryIsLoading}
						<div class="lib-empty soft" role="status">Loading library items...</div>
					{:else if libraryIsError}
						<div class="lib-empty soft" style="color:var(--c-alarm)" role="alert">
							Couldn't load captures or working documents. Local file results may still appear in
							search.
						</div>
					{:else if filteredLibraryItems.length === 0}
						<div class="lib-empty soft">
							{libraryItems.length === 0
								? 'Nothing here yet. Create a working document or capture something to start your library.'
								: 'No items match the selected kinds.'}
							{#if libraryItems.length > 0}
								<button class="btn btn-ghost" style="margin-left:8px" onclick={resetFacets}>
									reset filters
								</button>
							{/if}
						</div>
					{:else}
						<div class="lib-list">
							{#each filteredLibraryItems as item (item.id)}
								<button
									class="lib-row"
									class:lib-row--triaged={item.triaged}
									aria-label={`Open ${item.chipLabel} ${item.text}`}
									onclick={item.onclick}
								>
									<div class="lib-row-dot">
										<Icon name={item.icon} size={8} />
									</div>
									<div class="lib-row-body">
										<div class="lib-row-text">{item.text}</div>
										<div class="lib-row-meta">
											<span class="chip {item.chipClass}">{item.chipLabel}</span>
											<span>·</span>
											<span class="mono">{item.mono}</span>
											<span>·</span>
											<span>{relTime(item.sortDate, now)}</span>
											{#if item.triageLabel}
												<span>·</span>
												<span class="chip chip-triage">{item.triageLabel}</span>
											{/if}
										</div>
									</div>
								</button>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		{:else}
			<!-- Search narrowing state -->
			<section class="results">
				{#if searchQuery.isLoading}
					<div class="results-empty soft" role="status">Searching indexed knowledge...</div>
				{:else if searchQuery.isError}
					<div class="results-empty soft" style="color:var(--c-alarm)" role="alert">
						Couldn't load search results: {searchQuery.error?.message}
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
						{deepDone
							? 'Deep search — LLM expanded and reranked.'
							: 'Most recent first. "similar / mentions / nearby" live inside each opened result.'}
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
		{/if}
	</div>
</div>

<style>
	.lib-scroll {
		flex: 1;
		overflow-y: auto;
	}

	.lib-container {
		max-width: 680px;
		margin: 0 auto;
		padding: 20px 24px 48px;
	}

	.lib-empty {
		padding: 32px 0;
		text-align: center;
	}

	.lib-list {
		display: flex;
		flex-direction: column;
	}

	.lib-row {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		padding: 10px 0;
		border: none;
		border-bottom: 1px solid var(--line);
		background: none;
		cursor: pointer;
		text-align: left;
		width: 100%;
		color: var(--text);
		transition: background 0.1s;
	}

	.lib-row:first-child {
		border-top: 1px solid var(--line);
	}

	.lib-row:hover {
		background: var(--bg-raised);
	}

	.lib-row--triaged {
		opacity: 0.5;
	}

	.lib-row-dot {
		padding-top: 4px;
		color: var(--text-mute);
		flex-shrink: 0;
	}

	.lib-row-body {
		flex: 1;
		min-width: 0;
	}

	.lib-row-text {
		font-size: 14px;
		line-height: 1.5;
		overflow: hidden;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
	}

	.lib-row-meta {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-top: 3px;
		font-size: 12px;
		color: var(--text-mute);
	}

	.chip-triage {
		background: var(--bg-high);
		color: var(--text-mute);
		border-radius: 3px;
		padding: 1px 5px;
		font-size: 11px;
	}
</style>
