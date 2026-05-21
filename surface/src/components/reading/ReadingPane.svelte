<script lang="ts">
	import { createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { browser } from '$app/environment';
	import { getWorkbenchContext } from '$lib/state/workbench.svelte';
	import { captureKeys, fetchCapture } from '$lib/api/captures';
	import { fileKeys, fetchFile } from '$lib/api/files';
	import { workingKeys, fetchWorking, createWorking } from '$lib/api/working';
	import { attachSelectionCapture, getPendingSelection } from '$lib/utils/selection';
	import type { DocRef } from '$lib/types';
	import MarkdownRenderer from './MarkdownRenderer.svelte';
	import PdfViewer from './PdfViewer.svelte';

	const { paneIndex, ref }: { paneIndex: 0 | 1; ref: DocRef } = $props();

	const wb = getWorkbenchContext();
	const qc = useQueryClient();

	let paneEl: HTMLDivElement;

	$effect(() => {
		if (!paneEl) return;
		return attachSelectionCapture(paneEl);
	});

	const captureQuery = createQuery(() => ({
		queryKey: captureKeys.detail(ref.kind === 'capture' ? ref.id : -1),
		queryFn: () => fetchCapture((ref as { id: number }).id),
		enabled: browser && ref.kind === 'capture'
	}));

	const fileQuery = createQuery(() => ({
		queryKey: fileKeys.detail(ref.kind === 'file' ? ref.id : -1),
		queryFn: () => fetchFile((ref as { id: number }).id),
		enabled: browser && ref.kind === 'file'
	}));

	const workingQuery = createQuery(() => ({
		queryKey: workingKeys.detail(ref.kind === 'working' ? ref.slug : ''),
		queryFn: () => fetchWorking((ref as { slug: string }).slug),
		enabled: browser && ref.kind === 'working'
	}));

	const isLoading = $derived(
		captureQuery.isLoading || fileQuery.isLoading || workingQuery.isLoading
	);
	const isError = $derived(captureQuery.isError || fileQuery.isError || workingQuery.isError);

	// Derive the timestamp for "around this in time"
	const timestamp = $derived(
		captureQuery.data?.captured_at ?? fileQuery.data?.modified_at ?? null
	);

	// Derive id/slug/kind for lateral queries
	const lateralRef = $derived<{ id: string; kind: 'capture' | 'local-file' | 'working' }>(
		ref.kind === 'capture'
			? { id: String(ref.id), kind: 'capture' }
			: ref.kind === 'file'
				? { id: String(ref.id), kind: 'local-file' }
				: { id: ref.slug, kind: 'working' }
	);

	function openMoreLikeThis() {
		wb.openInOther(paneIndex, {
			kind: 'results',
			source: { type: 'similar', ...lateralRef }
		});
	}

	function openMentions() {
		const sel = getPendingSelection();
		if (!sel) return;
		wb.openInOther(paneIndex, {
			kind: 'results',
			source: { type: 'mentions', q: sel }
		});
	}

	function openNearby() {
		if (!timestamp) return;
		wb.openInOther(paneIndex, {
			kind: 'results',
			source: { type: 'nearby', timestamp, window_hours: 72 }
		});
	}

	async function promoteToWorking() {
		const body: Parameters<typeof createWorking>[0] = {
			title: ref.kind === 'capture'
				? `from capture #${(ref as { id: number }).id}`
				: ref.kind === 'file'
					? (fileQuery.data?.path.split('/').pop() ?? 'untitled')
					: ref.slug
		};
		if (ref.kind === 'capture') body.seed_capture_id = (ref as { id: number }).id;
		if (ref.kind === 'file') body.seed_file_id = (ref as { id: number }).id;
		const result = await createWorking(body);
		qc.invalidateQueries({ queryKey: ['working', 'list'] });
		wb.openInPane(paneIndex, { kind: 'editor', slug: result.slug });
	}
</script>

<div bind:this={paneEl} class="flex h-full flex-col">
	<!-- toolbar -->
	<div class="flex shrink-0 flex-wrap items-center gap-1 border-b border-border bg-surface-raised px-2 py-1">
		<button
			class="rounded px-2 py-0.5 text-xs text-text-muted hover:bg-surface-high hover:text-text"
			onclick={openMoreLikeThis}
			title="Semantic neighbors"
		>≈ similar</button>
		<button
			class="rounded px-2 py-0.5 text-xs text-text-muted hover:bg-surface-high hover:text-text"
			onclick={openMentions}
			title="Search for selected text"
		>" mentions</button>
		{#if timestamp}
			<button
				class="rounded px-2 py-0.5 text-xs text-text-muted hover:bg-surface-high hover:text-text"
				onclick={openNearby}
				title="Items from ±72h"
			>⟳ nearby</button>
		{/if}
		{#if ref.kind === 'working'}
			<button
				class="rounded px-2 py-0.5 text-xs text-text-muted hover:bg-surface-high hover:text-text"
				onclick={() => wb.openInPane(paneIndex, { kind: 'editor', slug: ref.slug })}
			>✎ edit</button>
		{:else}
			<button
				class="rounded px-2 py-0.5 text-xs text-text-muted hover:bg-surface-high hover:text-text"
				onclick={promoteToWorking}
			>↑ promote</button>
		{/if}
	</div>

	<!-- content -->
	<div class="min-h-0 flex-1 overflow-hidden">
		{#if isLoading}
			<p class="p-3 text-xs text-text-muted">loading…</p>
		{:else if isError}
			<p class="p-3 text-xs text-red-400">error loading document</p>
		{:else if ref.kind === 'capture' && captureQuery.data}
			<MarkdownRenderer content={captureQuery.data.text} />
		{:else if ref.kind === 'file' && fileQuery.data}
			{#if fileQuery.data.mime_type === 'application/pdf'}
				<PdfViewer fileId={ref.id} />
			{:else}
				<MarkdownRenderer content={fileQuery.data.text} />
			{/if}
		{:else if ref.kind === 'working' && workingQuery.data}
			<MarkdownRenderer content={workingQuery.data.content} />
		{/if}
	</div>
</div>
