<script lang="ts">
	import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { browser } from '$app/environment';
	import { EditorState, Compartment } from '@codemirror/state';
	import {
		EditorView,
		keymap,
		lineNumbers,
		drawSelection,
		highlightActiveLine
	} from '@codemirror/view';
	import { defaultKeymap, historyKeymap, history } from '@codemirror/commands';
	import { searchKeymap } from '@codemirror/search';
	import { markdown } from '@codemirror/lang-markdown';
	import { oneDark } from '@codemirror/theme-one-dark';
	import { vim, Vim } from '@replit/codemirror-vim';
	import { getWorkbenchContext } from '$lib/state/workbench.svelte';
	import { workingKeys, fetchWorking, updateWorking, deleteWorking } from '$lib/api/working';
	import Icon from '$components/icons/Icon.svelte';
	import MarkdownRenderer from '$components/reading/MarkdownRenderer.svelte';
	import VimToggle from './VimToggle.svelte';

	type PreviewFreshnessState = 'current' | 'stale' | 'refreshing' | 'unavailable';

	const { slug, paneIndex }: { slug: string; paneIndex: 0 | 1 } = $props();

	const wb = getWorkbenchContext();
	const qc = useQueryClient();

	let editorContainer: HTMLDivElement | undefined = $state();
	let view: EditorView | null = null;
	const vimCompartment = new Compartment();
	let isDirty = $state(false);
	let saveTimer: ReturnType<typeof setTimeout> | null = null;
	let saveStatus = $state<'' | 'saved' | 'error' | 'deleting'>('');
	let saveErrorMsg = $state('');
	let statusTimer: ReturnType<typeof setTimeout> | null = null;
	let savedPreviewContent = $state('');
	let previewFreshness = $state<PreviewFreshnessState>('current');
	let previewRenderErrorMsg = $state('');
	let lastLoadedSlug = '';
	let previewStatusText = $derived.by(() => {
		if (previewFreshness === 'stale') return 'Preview waiting for save';
		if (previewFreshness === 'refreshing') return 'Preview refreshing from saved content';
		if (previewFreshness === 'unavailable')
			return 'Preview unavailable; source editing still works';
		return 'Preview current';
	});

	const docQuery = createQuery(() => ({
		queryKey: workingKeys.detail(slug),
		queryFn: () => fetchWorking(slug),
		enabled: browser
	}));

	const saveMutation = createMutation(() => ({
		mutationFn: ({ content }: { content: string }) => updateWorking(slug, content),
		onSuccess: (_data, variables) => {
			isDirty = false;
			saveStatus = 'saved';
			savedPreviewContent = variables.content;
			previewFreshness = 'refreshing';
			previewRenderErrorMsg = '';
			if (statusTimer) clearTimeout(statusTimer);
			statusTimer = setTimeout(() => {
				saveStatus = '';
				if (previewFreshness === 'refreshing') previewFreshness = 'current';
			}, 2000);
			qc.invalidateQueries({ queryKey: workingKeys.detail(slug) });
		},
		onError: (err) => {
			console.error('[editor] save failed:', err);
			saveStatus = 'error';
			saveErrorMsg = err instanceof Error ? err.message : 'unknown error';
			if (isDirty) previewFreshness = 'stale';
		}
	}));

	const deleteMutation = createMutation(() => ({
		mutationFn: () => deleteWorking(slug),
		onMutate: () => {
			saveStatus = 'deleting';
		},
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: workingKeys.list() });
			qc.removeQueries({ queryKey: workingKeys.detail(slug) });
			goBack();
		},
		onError: (err) => {
			console.error('[editor] delete failed:', err);
			saveStatus = 'error';
			saveErrorMsg = err instanceof Error ? err.message : 'unknown error';
		}
	}));

	function saveNow(content?: string) {
		const doc = content ?? view?.state.doc.toString();
		if (doc === undefined) return;
		saveMutation.mutate({ content: doc });
	}

	function scheduleAutosave(content: string) {
		isDirty = true;
		saveStatus = '';
		if (previewFreshness !== 'unavailable') previewFreshness = 'stale';
		if (saveTimer) clearTimeout(saveTimer);
		saveTimer = setTimeout(() => saveNow(content), 1500);
	}

	function onPreviewRenderError(error: unknown) {
		previewFreshness = 'unavailable';
		previewRenderErrorMsg =
			error instanceof Error ? error.message : 'Markdown preview failed to render';
	}

	function buildVimExtension(enabled: boolean) {
		return enabled ? vim() : [];
	}

	function goBack() {
		wb.openInPane(paneIndex, { kind: 'library', query: '' });
	}

	function deleteDoc() {
		if (!window.confirm(`Delete ${slug}.md? This cannot be undone.`)) return;
		deleteMutation.mutate();
	}

	// Wire vim ex commands (global registry — last-mounted editor wins when two are open simultaneously)
	Vim.defineEx('write', 'w', () => saveNow());
	Vim.defineEx('wq', 'wq', () => {
		saveNow();
		goBack();
	});
	Vim.defineEx('quit', 'q', (_cm: unknown, params: { argString?: string }) => {
		const force = params?.argString?.trim() === '!';
		if (!force && isDirty && !window.confirm('Unsaved changes. Leave without saving?')) return;
		goBack();
	});

	// Mount editor once we have content
	$effect(() => {
		if (!browser || !editorContainer || !docQuery.data) return;
		const container = editorContainer;
		if (lastLoadedSlug !== slug) {
			lastLoadedSlug = slug;
			savedPreviewContent = docQuery.data.content;
			previewFreshness = 'current';
			previewRenderErrorMsg = '';
			isDirty = false;
		}

		// If view already exists, just update content if slug changed (destroy and recreate)
		if (view) {
			view.destroy();
			view = null;
		}

		const state = EditorState.create({
			doc: docQuery.data.content,
			extensions: [
				history(),
				lineNumbers(),
				drawSelection(),
				highlightActiveLine(),
				markdown(),
				oneDark,
				vimCompartment.of(buildVimExtension(wb.vimMode)),
				keymap.of([
					{
						key: 'Ctrl-s',
						run: () => {
							saveNow();
							return true;
						}
					},
					...defaultKeymap,
					...historyKeymap,
					...searchKeymap
				]),
				EditorView.updateListener.of((update) => {
					if (update.docChanged) scheduleAutosave(update.state.doc.toString());
				}),
				EditorView.theme({
					'&': { height: '100%', backgroundColor: 'var(--color-surface)' },
					'.cm-scroller': {
						overflow: 'auto',
						fontFamily: 'var(--font-mono)',
						fontSize: '0.933rem'
					},
					'.cm-content': { caretColor: 'var(--color-accent)' }
				})
			]
		});

		view = new EditorView({ state, parent: container });
	});

	// React to vim mode toggle without remounting
	$effect(() => {
		const enabled = wb.vimMode;
		if (!view) return;
		view.dispatch({ effects: vimCompartment.reconfigure(buildVimExtension(enabled)) });
	});

	$effect(() => {
		return () => {
			if (saveTimer) clearTimeout(saveTimer);
			if (statusTimer) clearTimeout(statusTimer);
			view?.destroy();
		};
	});
</script>

<div class="editor-shell">
	<div class="editor-status">
		<button
			class="btn btn-ghost"
			title="Back to library"
			aria-label="Back to library"
			onclick={goBack}
		>
			<Icon name="arrow-right" size={14} class="rotate-180" /> Back
		</button>
		<span class="mono faint truncate" style="font-size:12px">{slug}.md</span>
		<span role="status" aria-live="polite" class="editor-save-status">
			{#if saveStatus === 'error'}
				<span style="color:var(--c-alarm)" title={saveErrorMsg}>· action failed</span>
			{:else if isDirty}
				<span class="mute">· unsaved</span>
			{:else if saveStatus === 'saved'}
				<span style="color:var(--c-ok)">· saved</span>
			{:else if saveStatus === 'deleting'}
				<span class="mute">· deleting</span>
			{/if}
		</span>
		<span class="row editor-actions">
			<button
				class="btn btn-ghost"
				title="Save working document"
				aria-label="Save working document"
				disabled={saveMutation.isPending || deleteMutation.isPending}
				onclick={() => saveNow()}
			>
				Save
			</button>
			<button
				class="btn btn-ghost"
				title="Delete working document"
				aria-label="Delete working document"
				disabled={deleteMutation.isPending}
				onclick={deleteDoc}
			>
				Delete
			</button>
			<VimToggle />
		</span>
	</div>

	<div class="min-h-0 flex-1 overflow-hidden">
		{#if docQuery.isLoading}
			<p class="p-3 text-sm" style="color:var(--text-mute)">loading…</p>
		{:else if docQuery.isError}
			<div class="p-3 text-xs" style="color:var(--c-alarm)" role="alert">
				<p>{docQuery.error?.message ?? 'error loading doc'}</p>
				<button class="btn btn-ghost" style="margin-top:8px" onclick={goBack}
					>Back to library</button
				>
			</div>
		{:else}
			<div class="editor-preview-layout">
				<section class="editor-source-pane" aria-label={`Markdown editor for ${slug}.md`}>
					<div bind:this={editorContainer} class="h-full"></div>
				</section>
				<section class="editor-preview-pane" aria-label={`Markdown preview for ${slug}.md`}>
					<div class="editor-preview-header">
						<span class="mono faint">Preview</span>
						<span role="status" aria-live="polite" class="editor-preview-status">
							{previewStatusText}
						</span>
					</div>
					{#if previewFreshness === 'unavailable'}
						<p class="editor-preview-message" role="alert" title={previewRenderErrorMsg}>
							Markdown preview is unavailable. You can continue editing and save again.
						</p>
					{:else if savedPreviewContent.trim().length === 0}
						<p class="editor-preview-message">
							Preview is empty because the saved document is empty.
						</p>
					{:else}
						<MarkdownRenderer content={savedPreviewContent} onRenderError={onPreviewRenderError} />
					{/if}
				</section>
			</div>
		{/if}
	</div>
</div>

<style>
	.editor-shell {
		min-width: 0;
		overflow: hidden;
	}

	.editor-status {
		align-items: center;
		flex-wrap: wrap;
		gap: 6px;
	}

	.editor-actions {
		margin-left: auto;
		gap: 6px;
		flex-wrap: wrap;
	}

	.editor-save-status {
		font-size: 12px;
	}

	.editor-preview-layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(280px, 0.95fr);
		gap: 1px;
		height: 100%;
		min-width: 0;
		overflow: hidden;
		background: var(--border-subtle);
	}

	.editor-source-pane,
	.editor-preview-pane {
		min-width: 0;
		min-height: 0;
		overflow: hidden;
		background: var(--color-surface);
	}

	.editor-source-pane {
		height: 100%;
	}

	.editor-preview-pane {
		display: flex;
		flex-direction: column;
	}

	.editor-preview-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		border-bottom: 1px solid var(--border-subtle);
		padding: 8px 10px;
		font-size: 12px;
	}

	.editor-preview-status {
		color: var(--text-mute);
		text-align: right;
	}

	.editor-preview-message {
		padding: 16px;
		font-size: 0.875rem;
		color: var(--text-mute);
	}

	@media (max-width: 820px) {
		.editor-status {
			align-items: flex-start;
		}

		.editor-actions {
			margin-left: 0;
		}

		.editor-preview-layout {
			grid-template-columns: 1fr;
			grid-template-rows: minmax(340px, 55vh) minmax(220px, 45vh);
			overflow-y: auto;
		}
	}
</style>
