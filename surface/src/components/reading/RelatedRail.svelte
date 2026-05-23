<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import { browser } from '$app/environment';
	import { getWorkbenchContext } from '$lib/state/workbench.svelte';
	import { searchKeys, fetchSimilar } from '$lib/api/search';
	import type { DocRef, SearchResult } from '$lib/types';
	import Icon from '$components/icons/Icon.svelte';

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

	let height = $state(
		browser ? parseInt(localStorage.getItem('lattice:related-rail-h') ?? '220') : 220
	);
	let minimized = $state(
		browser ? localStorage.getItem('lattice:related-rail-min') === 'true' : false
	);

	function toggleMinimized() {
		minimized = !minimized;
		localStorage.setItem('lattice:related-rail-min', String(minimized));
	}

	function startResize(e: MouseEvent) {
		e.preventDefault();
		const startY = e.clientY;
		const startH = height;
		function onMove(ev: MouseEvent) {
			height = Math.max(80, Math.min(600, startH - (ev.clientY - startY)));
			localStorage.setItem('lattice:related-rail-h', String(height));
		}
		function onUp() {
			window.removeEventListener('mousemove', onMove);
			window.removeEventListener('mouseup', onUp);
		}
		window.addEventListener('mousemove', onMove);
		window.addEventListener('mouseup', onUp);
	}

	function toRef(r: SearchResult): DocRef {
		if (r.kind === 'capture') return { kind: 'capture', id: r.id };
		if (r.kind === 'local-file') return { kind: 'file', id: r.id };
		if (r.kind === 'capture-attachment') return { kind: 'capture', id: r.capture_id };
		if (r.kind === 'working-attachment') return { kind: 'working', slug: r.slug };
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

	const hasContent = $derived(
		relatedQuery.isError || (!!relatedQuery.data && relatedQuery.data.results.length > 0)
	);
</script>

{#if wb.featureFlags.relatedRail && hasContent}
	<div class="related-rail" style={minimized ? '' : `height:${height}px; overflow:hidden`}>
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div
			class="related-resize-handle"
			role="separator"
			aria-orientation="horizontal"
			onmousedown={startResize}
		></div>
		<div class="related-head">
			<span class="related-title">Related notes</span>
			<div class="row" style="gap:6px">
				{#if relatedQuery.isError}
					<span class="faint" style="font-size:12px; color:var(--c-alarm)">couldn't load</span>
				{:else}
					<span class="faint" style="font-size:12px">semantic neighbors · QMD cosine</span>
				{/if}
				<button
					class="btn btn-ghost rr-toggle"
					onclick={toggleMinimized}
					aria-label={minimized ? 'Expand related notes' : 'Minimize related notes'}
				>
					<Icon name="minimize" size={12} />
				</button>
			</div>
		</div>
		{#if !minimized}
			{#if relatedQuery.isError}
				<div style="padding: 0 22px 12px">
					<button class="btn btn-ghost" onclick={() => relatedQuery.refetch()}>Try again</button>
				</div>
			{:else if relatedQuery.data}
				<div class="related-list" style="overflow-y:auto; padding: 0 22px 22px">
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
			{/if}
		{/if}
	</div>
{/if}

<style>
	.related-resize-handle {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 5px;
		cursor: row-resize;
		z-index: 1;
	}
	.related-resize-handle:hover {
		background: var(--line-strong, var(--accent, var(--line)));
	}
	.rr-toggle {
		padding: 1px 3px;
		opacity: 0.5;
	}
	.rr-toggle:hover {
		opacity: 1;
	}
</style>
