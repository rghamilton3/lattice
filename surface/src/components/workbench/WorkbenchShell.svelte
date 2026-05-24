<script lang="ts">
	import { useQueryClient } from '@tanstack/svelte-query';
	import { getWorkbenchContext, type View } from '$lib/state/workbench.svelte';
	import { workingKeys } from '$lib/api/working';
	import { logError } from '$lib/utils/logError';
	import AppShell from '$components/shell/AppShell.svelte';
	import PaneContainer from './PaneContainer.svelte';
	import QuickCapture from '$components/overlays/QuickCapture.svelte';
	import Settings from '$components/overlays/Settings.svelte';
	import NewTask from '$components/overlays/NewTask.svelte';
	import FileUpload from '$components/overlays/FileUpload.svelte';
	import ProcessMode from '$components/process/ProcessMode.svelte';
	import Toast from '$components/ui/Toast.svelte';

	const wb = getWorkbenchContext();
	const queryClient = useQueryClient();

	let newDocTitle = $state('');
	let newDocError = $state('');

	function isEditableTarget(target: EventTarget | null): boolean {
		if (!(target instanceof HTMLElement)) return false;
		const tag = target.tagName;
		return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
	}

	function handleKeydown(e: KeyboardEvent) {
		// triage owns the keyboard; ProcessMode binds its own listener.
		if (wb.activeOverlay === 'triage') return;

		if (e.ctrlKey && e.altKey && e.key === 'v') {
			e.preventDefault();
			wb.toggleVim();
			return;
		}

		// Esc closes any popover overlay (anyOverlayOpen excludes triage).
		if (e.key === 'Escape' && wb.anyOverlayOpen) {
			e.preventDefault();
			wb.activeOverlay = 'none';
			return;
		}

		const mod = e.metaKey || e.ctrlKey;

		if (mod && e.shiftKey && (e.key === 'J' || e.key === 'j')) {
			e.preventDefault();
			wb.activeOverlay = 'newDoc';
			return;
		}
		if (mod && !e.shiftKey && e.key === 'j') {
			e.preventDefault();
			wb.activeOverlay = 'capture';
			return;
		}
		if (mod && e.key === 'k') {
			e.preventDefault();
			wb.activeOverlay = 'palette';
			return;
		}
		if (mod && e.key === '.') {
			e.preventDefault();
			wb.focusMode = !wb.focusMode;
			return;
		}
		if (mod && e.key === '/') {
			e.preventDefault();
			wb.openInPane(0, { kind: 'library', query: '' });
			return;
		}

		// bare `c` — only when not in a field and no overlay is already open
		if (
			!mod &&
			!e.altKey &&
			!e.shiftKey &&
			e.key === 'c' &&
			!wb.anyOverlayOpen &&
			!isEditableTarget(e.target)
		) {
			e.preventDefault();
			wb.activeOverlay = 'capture';
		}

		// bare `?` — open command palette when not in a field and no overlay open
		if (!mod && !e.altKey && e.key === '?' && !wb.anyOverlayOpen && !isEditableTarget(e.target)) {
			e.preventDefault();
			wb.activeOverlay = 'palette';
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
				const body = await res.text();
				let parsed: { error?: string } | null = null;
				try {
					parsed = JSON.parse(body) as { error?: string };
				} catch {
					/* non-JSON body (e.g. proxy HTML) */
				}
				newDocError = parsed?.error ?? `Failed to create doc (HTTP ${res.status})`;
				return;
			}
			const data = (await res.json()) as { slug: string };
			wb.activeOverlay = 'none';
			newDocTitle = '';
			newDocError = '';
			queryClient.invalidateQueries({ queryKey: workingKeys.list() });
			wb.openInPane(wb.focusedPane, { kind: 'editor', slug: data.slug });
		} catch (err) {
			logError('confirmNewDoc', err);
			newDocError = 'Network error';
		}
	}

	function handleNav(view: View) {
		if (view === 'home') wb.openInPane(0, { kind: 'home' });
		else if (view === 'tasks') wb.openInPane(0, { kind: 'tasks' });
		else if (view === 'library') wb.openInPane(0, { kind: 'library', query: '' });
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if wb.activeOverlay === 'triage'}
	<ProcessMode />
{:else}
	<AppShell oncapture={() => (wb.activeOverlay = 'capture')} onnav={handleNav}>
		<div class="flex h-full w-full">
			<div class={wb.isSplit ? 'w-1/2 border-r border-border' : 'w-full'}>
				<PaneContainer paneIndex={0} content={wb.panes[0]} />
			</div>
			{#if wb.isSplit && wb.panes[1]}
				<div class="w-1/2">
					<PaneContainer paneIndex={1} content={wb.panes[1]} />
				</div>
			{/if}
		</div>
	</AppShell>

	{#if wb.activeOverlay === 'capture'}
		<QuickCapture />
	{/if}

	{#if wb.activeOverlay === 'settings'}
		<Settings />
	{/if}

	{#if wb.activeOverlay === 'newTask'}
		<NewTask />
	{/if}

	{#if wb.activeOverlay === 'fileUpload'}
		<FileUpload />
	{/if}

	{#if wb.activeOverlay === 'newDoc'}
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
							wb.activeOverlay = 'none';
						}
					}}
				/>
				{#if newDocError}
					<p class="mt-1 text-xs text-red-400">{newDocError}</p>
				{/if}
				<div class="mt-3 flex justify-end gap-2">
					<button
						class="rounded px-3 py-1 text-xs text-text-muted hover:bg-surface-high"
						onclick={() => (wb.activeOverlay = 'none')}>cancel</button
					>
					<button
						class="rounded bg-accent px-3 py-1 text-xs text-surface hover:opacity-90"
						onclick={confirmNewDoc}>create</button
					>
				</div>
			</div>
		</div>
	{/if}
{/if}

<Toast />
