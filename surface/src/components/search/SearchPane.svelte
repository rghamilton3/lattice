<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import { browser } from '$app/environment';
	import { getWorkbenchContext } from '$lib/state/workbench.svelte';
	import { captureKeys, fetchCaptures } from '$lib/api/captures';
	import { searchKeys, fetchSearch } from '$lib/api/search';
	import ResultList from './ResultList.svelte';

	const { paneIndex, query: initialQuery }: { paneIndex: 0 | 1; query: string } = $props();

	const wb = getWorkbenchContext();

	// Use a local copy so the state isn't tied to the prop reference
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

	const searchQuery = createQuery(() => ({
		queryKey: searchKeys.search(debouncedQ),
		queryFn: () => fetchSearch(debouncedQ),
		enabled: browser && debouncedQ.length > 0
	}));

	const recentQuery = createQuery(() => ({
		queryKey: captureKeys.list(30),
		queryFn: () => fetchCaptures(30),
		enabled: browser && debouncedQ.length === 0
	}));
</script>

<div class="flex h-full flex-col">
	<div class="shrink-0 border-b border-border p-2">
		<input
			type="text"
			value={input}
			oninput={onInput}
			placeholder="search…"
			class="w-full rounded border border-border bg-surface px-2 py-1 text-sm text-text outline-none focus:border-accent"
		/>
	</div>

	<div class="min-h-0 flex-1 overflow-y-auto">
		{#if debouncedQ.length > 0}
			{#if searchQuery.isLoading}
				<p class="p-3 text-xs text-text-muted">searching…</p>
			{:else if searchQuery.isError}
				<p class="p-3 text-xs text-red-400">error: {searchQuery.error?.message}</p>
			{:else if searchQuery.data}
				<ResultList {paneIndex} items={searchQuery.data.results} />
			{/if}
		{:else}
			{#if recentQuery.data && recentQuery.data.length > 0}
				<p class="px-3 pt-2 text-xs text-text-muted">recent captures</p>
				{#each recentQuery.data as capture (capture.id)}
					<button
						class="w-full border-b border-border px-3 py-2 text-left hover:bg-surface-raised"
						onclick={() => wb.openInPane(paneIndex, { kind: 'doc', ref: { kind: 'capture', id: capture.id } })}
					>
						<div class="truncate text-xs text-text">{capture.text.slice(0, 120)}</div>
						<div class="mt-0.5 text-xs text-text-muted">{capture.source} · {capture.captured_at.slice(0, 10)}</div>
					</button>
				{/each}
			{:else}
				<p class="p-3 text-xs text-text-muted">start typing to search</p>
			{/if}
		{/if}
	</div>
</div>
