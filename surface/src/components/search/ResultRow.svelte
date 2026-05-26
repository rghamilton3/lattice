<script lang="ts">
	import { getWorkbenchContext } from '$lib/state/workbench.svelte';
	import { createWorking } from '$lib/api/working';
	import { archiveRawUrl } from '$lib/api/archives';
	import type { SearchResult, DocRef } from '$lib/types';
	import Icon from '$components/icons/Icon.svelte';
	import { relTime } from '$lib/utils/relTime';

	const { paneIndex, result }: { paneIndex: 0 | 1; result: SearchResult } = $props();

	const wb = getWorkbenchContext();

	const chipClass = $derived(
		result.kind === 'local-file'
			? 'chip chip-file'
			: result.kind === 'archive'
				? 'chip chip-working'
				: result.kind === 'capture' || result.kind === 'capture-attachment'
					? 'chip chip-capture'
					: 'chip chip-working'
	);

	const title = $derived(
		result.kind === 'capture'
			? `capture #${result.id}`
			: result.kind === 'archive'
				? (result.title ?? result.url)
				: result.kind === 'local-file'
					? (result.path.split('/').pop() ?? result.path)
					: result.kind === 'capture-attachment' || result.kind === 'working-attachment'
						? result.filename
						: `${result.slug}.md`
	);

	function refToDocRef(r: SearchResult): DocRef {
		if (r.kind === 'capture') return { kind: 'capture', id: r.id };
		if (r.kind === 'archive') return { kind: 'file', id: r.id };
		if (r.kind === 'working') return { kind: 'working', slug: r.slug };
		if (r.kind === 'capture-attachment') return { kind: 'capture', id: r.capture_id };
		if (r.kind === 'working-attachment') return { kind: 'working', slug: r.slug };
		return { kind: 'file', id: r.id };
	}

	function similarSource(r: SearchResult) {
		if (r.kind === 'capture-attachment') {
			return { kind: 'similar' as const, id: r.capture_id, docKind: 'capture' as const };
		}
		if (r.kind === 'working-attachment') {
			return { kind: 'similar' as const, id: r.slug, docKind: 'working' as const };
		}
		return {
			kind: 'similar' as const,
			id: r.id,
			docKind: r.kind === 'archive' ? 'local-file' : r.kind
		};
	}

	const modifiedLabel = $derived(relTime(result.modified_at, Date.now()));

	let promoteError = $state('');

	async function promote() {
		if (result.kind === 'working') return;
		promoteError = '';
		const baseTitle = result.path.split('/').pop() ?? 'untitled';
		const params =
			result.kind === 'capture'
				? { title: baseTitle, seed_capture_id: result.id }
				: { title: baseTitle, seed_file_id: result.id };
		try {
			const { slug } = await createWorking(params);
			wb.openInPane(paneIndex, { kind: 'editor', slug });
		} catch (e) {
			promoteError = e instanceof Error ? e.message : 'promote failed';
		}
	}

	function openNewTab(url: string) {
		window.open(url, '_blank', 'noopener,noreferrer');
	}
</script>

<article class="result" aria-label={`${result.kind} result: ${title}`}>
	<div class="result-head">
		<span class={chipClass}>{result.kind}</span>
		{#if result.kind === 'local-file'}
			<span class="mono faint" style="font-size:12px">@{result.machine_id}</span>
		{/if}
		<span class="mono faint" style="font-size:12px">{title}</span>
		{#if modifiedLabel}
			<span class="faint" style="font-size:11px">{modifiedLabel}</span>
		{/if}
		{#if result.score > 0}
			<span class="row" style="margin-left:auto">
				<span
					class="score-bar"
					title={`score ${result.score.toFixed(2)}`}
					role="meter"
					aria-label={`relevance score ${result.score.toFixed(2)}`}
					aria-valuemin="0"
					aria-valuemax="1"
					aria-valuenow={result.score}
				>
					<span class="score-fill" style={`width:${Math.round(result.score * 100)}%`}></span>
				</span>
				<span
					class="mono faint"
					style="font-size:11px; width:36px; text-align:right; display:inline-block"
				>
					{result.score.toFixed(2)}
				</span>
			</span>
		{/if}
	</div>
	<p class="result-snippet">{result.snippet}</p>
	<div class="result-actions">
		{#if result.kind === 'archive'}
			<button
				class="btn"
				aria-label={`Open archived page ${title}`}
				onclick={() => openNewTab(archiveRawUrl(result.id))}
			>
				<Icon name="arrow-right" size={13} /> Open archive
			</button>
			<button
				class="btn btn-ghost"
				aria-label={`Open source URL for ${title}`}
				onclick={() => openNewTab(result.url)}
			>
				<Icon name="arrow-right" size={13} /> Source
			</button>
		{:else}
			<button
				class="btn"
				aria-label={`Open ${title}`}
				onclick={() => wb.openInPane(paneIndex, { kind: 'doc', ref: refToDocRef(result) })}
			>
				<Icon name="arrow-right" size={13} /> Open
			</button>
			<button
				class="btn btn-ghost"
				aria-label={`Open ${title} in split pane`}
				onclick={() => wb.openInOther(paneIndex, { kind: 'doc', ref: refToDocRef(result) })}
			>
				<Icon name="split" size={13} /> Open in split
			</button>
		{/if}
		{#if result.kind !== 'working' && result.kind !== 'archive'}
			<button
				class="btn btn-ghost"
				aria-label={`Promote ${title} to working document`}
				onclick={promote}
			>
				<Icon name="promote" size={13} /> Promote
			</button>
			{#if promoteError}
				<span class="faint" style="font-size:11px; color:var(--c-alarm)">{promoteError}</span>
			{/if}
		{/if}
		<button
			class="btn btn-ghost"
			aria-label={`Find results similar to ${title}`}
			onclick={() => wb.openInOther(paneIndex, { kind: 'results', source: similarSource(result) })}
		>
			<Icon name="sim" size={13} /> Similar
		</button>
	</div>
</article>
