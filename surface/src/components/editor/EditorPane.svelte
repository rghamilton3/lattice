<script lang="ts">
	import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { browser } from '$app/environment';
	import { EditorState, Compartment } from '@codemirror/state';
	import { EditorView, keymap, lineNumbers, drawSelection, highlightActiveLine } from '@codemirror/view';
	import { defaultKeymap, historyKeymap, history } from '@codemirror/commands';
	import { searchKeymap } from '@codemirror/search';
	import { markdown } from '@codemirror/lang-markdown';
	import { oneDark } from '@codemirror/theme-one-dark';
	import { vim } from '@replit/codemirror-vim';
	import { getWorkbenchContext } from '$lib/state/workbench.svelte';
	import { workingKeys, fetchWorking, updateWorking } from '$lib/api/working';
	import VimToggle from './VimToggle.svelte';

	const { slug }: { slug: string } = $props();

	const wb = getWorkbenchContext();
	const qc = useQueryClient();

	let editorContainer: HTMLDivElement | undefined = $state();
	let view: EditorView | null = null;
	let vimCompartment = new Compartment();
	let isDirty = $state(false);
	let saveTimer: ReturnType<typeof setTimeout> | null = null;

	const docQuery = createQuery(() => ({
		queryKey: workingKeys.detail(slug),
		queryFn: () => fetchWorking(slug),
		enabled: browser
	}));

	const saveMutation = createMutation(() => ({
		mutationFn: ({ content }: { content: string }) => updateWorking(slug, content),
		onSuccess: () => {
			isDirty = false;
			qc.invalidateQueries({ queryKey: workingKeys.detail(slug) });
		}
	}));

	function saveNow(content?: string) {
		const doc = content ?? view?.state.doc.toString() ?? '';
		saveMutation.mutate({ content: doc });
	}

	function scheduleAutosave(content: string) {
		isDirty = true;
		if (saveTimer) clearTimeout(saveTimer);
		saveTimer = setTimeout(() => saveNow(content), 1500);
	}

	function buildVimExtension(enabled: boolean) {
		return enabled ? vim() : [];
	}

	// Mount editor once we have content
	$effect(() => {
		if (!browser || !editorContainer || !docQuery.data) return;
		const container = editorContainer;

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
					{ key: 'Ctrl-s', run: () => { saveNow(); return true; } },
					...defaultKeymap,
					...historyKeymap,
					...searchKeymap
				]),
				EditorView.updateListener.of((update) => {
					if (update.docChanged) scheduleAutosave(update.state.doc.toString());
				}),
				EditorView.theme({
					'&': { height: '100%', backgroundColor: 'var(--color-surface)' },
					'.cm-scroller': { overflow: 'auto', fontFamily: 'var(--font-mono)', fontSize: '0.933rem' },
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
			view?.destroy();
		};
	});
</script>

<div class="flex h-full flex-col">
	<div class="flex shrink-0 items-center gap-2 border-b border-border bg-surface-raised px-2 py-1">
		<span class="truncate text-sm text-text">{slug}{isDirty ? ' ·' : ''}</span>
		{#if isDirty}
			<span class="text-sm text-text-muted">unsaved</span>
		{/if}
		<button
			class="rounded px-2 py-0.5 text-sm text-text-muted hover:bg-surface-high hover:text-text disabled:opacity-40"
			disabled={!isDirty || saveMutation.isPending}
			onclick={() => saveNow()}
		>save</button>
		<div class="ml-auto">
			<VimToggle />
		</div>
	</div>

	<div class="min-h-0 flex-1 overflow-hidden">
		{#if docQuery.isLoading}
			<p class="p-3 text-sm text-text-muted">loading…</p>
		{:else if docQuery.isError}
			<p class="p-3 text-xs text-red-400">error loading doc</p>
		{:else}
			<div bind:this={editorContainer} class="h-full"></div>
		{/if}
	</div>
</div>
