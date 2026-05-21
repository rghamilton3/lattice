<script lang="ts">
	import { getWorkbenchContext } from '$lib/state/workbench.svelte';
	import PaneContainer from './PaneContainer.svelte';

	const wb = getWorkbenchContext();

	let showNewDocModal = $state(false);
	let newDocTitle = $state('');
	let newDocError = $state('');

	function handleKeydown(e: KeyboardEvent) {
		if (e.ctrlKey && e.altKey && e.key === 'v') {
			e.preventDefault();
			wb.toggleVim();
		}
	}

	async function confirmNewDoc() {
		const title = newDocTitle.trim();
		if (!title) return;
		try {
			const res = await fetch('/api/working', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ title })
			});
			if (!res.ok) {
				const body = await res.json();
				newDocError = body.error ?? 'Failed to create doc';
				return;
			}
			const { slug } = await res.json();
			showNewDocModal = false;
			newDocTitle = '';
			newDocError = '';
			wb.openInPane(wb.focusedPane, { kind: 'editor', slug });
		} catch {
			newDocError = 'Network error';
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="flex h-screen w-screen overflow-hidden bg-surface">
	<!-- toolbar -->
	<div
		class="flex h-8 w-full shrink-0 items-center gap-2 border-b border-border bg-surface-raised px-3"
		style="position:absolute; top:0; left:0; z-index:10;"
	>
		<button
			class="text-sm text-accent font-bold tracking-widest hover:opacity-75"
			onclick={() => wb.openInPane(0, { kind: 'search', query: '' })}
		>lattice</button>
		<span class="text-text-muted mx-1">·</span>
		<button
			class="rounded px-2 py-0.5 text-sm text-text-muted hover:bg-surface-high hover:text-text"
			onclick={() => {
				showNewDocModal = true;
				newDocTitle = '';
				newDocError = '';
			}}
		>+ new doc</button>
		<span class="ml-auto text-xs text-text-muted">
			vim: <span class={wb.vimMode ? 'text-accent' : 'text-text-muted'}
				>{wb.vimMode ? 'on' : 'off'}</span
			>
			<span class="ml-1 opacity-50">ctrl+alt+v</span>
		</span>
	</div>

	<!-- panes -->
	<div class="flex w-full pt-8" style="height: 100vh;">
		<div class={wb.isSplit ? 'w-1/2 border-r border-border' : 'w-full'}>
			<PaneContainer paneIndex={0} content={wb.panes[0]} />
		</div>
		{#if wb.isSplit && wb.panes[1]}
			<div class="w-1/2">
				<PaneContainer paneIndex={1} content={wb.panes[1]} />
			</div>
		{/if}
	</div>
</div>

<!-- new doc modal -->
{#if showNewDocModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
		role="dialog"
		aria-modal="true"
		aria-label="New working doc"
	>
		<div class="w-96 rounded border border-border bg-surface-raised p-4">
			<p class="mb-2 text-base text-text">New working doc</p>
			<!-- svelte-ignore a11y_autofocus -->
			<input
				autofocus
				type="text"
				bind:value={newDocTitle}
				placeholder="Title…"
				class="w-full rounded border border-border bg-surface px-2 py-1 text-base text-text outline-none focus:border-accent"
				onkeydown={(e) => {
					if (e.key === 'Enter') confirmNewDoc();
					if (e.key === 'Escape') {
						showNewDocModal = false;
					}
				}}
			/>
			{#if newDocError}
				<p class="mt-1 text-xs text-red-400">{newDocError}</p>
			{/if}
			<div class="mt-3 flex justify-end gap-2">
				<button
					class="rounded px-3 py-1 text-xs text-text-muted hover:bg-surface-high"
					onclick={() => (showNewDocModal = false)}>cancel</button
				>
				<button
					class="rounded bg-accent px-3 py-1 text-xs text-surface hover:opacity-90"
					onclick={confirmNewDoc}>create</button
				>
			</div>
		</div>
	</div>
{/if}
