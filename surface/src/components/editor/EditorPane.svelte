<script lang="ts">
	import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { browser } from '$app/environment';
	import { untrack } from 'svelte';
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
	import VimToggle from './VimToggle.svelte';

	const { slug, paneIndex }: { slug: string; paneIndex: 0 | 1 } = $props();

	const wb = getWorkbenchContext();
	const qc = useQueryClient();

	let editorContainer: HTMLDivElement | undefined = $state();
	let view: EditorView | null = null;
	let mountedSlug: string | null = null;
	let loadedContent = '';
	const vimCompartment = new Compartment();
	let isDirty = $state(false);
	let saveTimer: ReturnType<typeof setTimeout> | null = null;
	let saveStatus = $state<'' | 'saved' | 'error' | 'deleting'>('');
	let saveErrorMsg = $state('');
	let statusTimer: ReturnType<typeof setTimeout> | null = null;

	const docQuery = createQuery(() => ({
		queryKey: workingKeys.detail(slug),
		queryFn: () => fetchWorking(slug),
		enabled: browser
	}));

	const saveMutation = createMutation(() => ({
		mutationFn: ({ content }: { content: string }) => updateWorking(slug, content),
		onSuccess: () => {
			isDirty = false;
			saveStatus = 'saved';
			if (statusTimer) clearTimeout(statusTimer);
			statusTimer = setTimeout(() => {
				saveStatus = '';
			}, 2000);
			qc.invalidateQueries({ queryKey: workingKeys.detail(slug) });
		},
		onError: (err) => {
			console.error('[editor] save failed:', err);
			saveStatus = 'error';
			saveErrorMsg = err instanceof Error ? err.message : 'unknown error';
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
		if (saveTimer) clearTimeout(saveTimer);
		saveTimer = setTimeout(() => saveNow(content), 1500);
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

		if (view && mountedSlug === slug) {
			const content = docQuery.data.content;
			if (content !== loadedContent && !isDirty && view.state.doc.toString() !== content) {
				view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: content } });
			}
			loadedContent = content;
			return;
		}

		// Reuse the component instance across editor slugs, but not the CodeMirror view.
		if (view) {
			view.destroy();
			view = null;
		}
		mountedSlug = slug;
		loadedContent = docQuery.data.content;

		const state = EditorState.create({
			doc: docQuery.data.content,
			extensions: [
				history(),
				lineNumbers(),
				drawSelection(),
				highlightActiveLine(),
				markdown(),
				oneDark,
				vimCompartment.of(buildVimExtension(untrack(() => wb.vimMode))),
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
			mountedSlug = null;
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
			{#if isDirty}
				<span class="mute">· unsaved</span>
			{:else if saveStatus === 'saved'}
				<span style="color:var(--c-ok)">· saved</span>
			{:else if saveStatus === 'error'}
				<span style="color:var(--c-alarm)" title={saveErrorMsg}>· action failed</span>
			{:else if saveStatus === 'deleting'}
				<span class="mute">· deleting</span>
			{/if}
		</span>
		<span class="row" style="margin-left:auto; gap:6px">
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
			<div
				bind:this={editorContainer}
				class="h-full"
				aria-label={`Markdown editor for ${slug}.md`}
			></div>
		{/if}
	</div>
</div>

<style>
	.editor-save-status {
		font-size: 12px;
	}
</style>
