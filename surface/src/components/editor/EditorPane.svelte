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
	import { workingKeys, fetchWorking, updateWorking } from '$lib/api/working';
	import Icon from '$components/icons/Icon.svelte';
	import VimToggle from './VimToggle.svelte';

	const { slug, paneIndex }: { slug: string; paneIndex: 0 | 1 } = $props();

	const wb = getWorkbenchContext();
	const qc = useQueryClient();

	let editorContainer: HTMLDivElement | undefined = $state();
	let view: EditorView | null = null;
	const vimCompartment = new Compartment();
	let isDirty = $state(false);
	let saveTimer: ReturnType<typeof setTimeout> | null = null;
	let saveStatus = $state<'' | 'saved' | 'error'>('');
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
		wb.openInPane(paneIndex, { kind: 'search', query: '' });
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
		<button class="btn btn-ghost" title="Back to search" onclick={goBack}>
			<Icon name="arrow-right" size={14} class="rotate-180" /> Back
		</button>
		<span class="mono faint truncate" style="font-size:12px">{slug}.md</span>
		{#if isDirty}
			<span class="mute" style="font-size:12px">· unsaved</span>
		{:else if saveStatus === 'saved'}
			<span style="font-size:12px; color:var(--c-ok)">· saved</span>
		{:else if saveStatus === 'error'}
			<span style="font-size:12px; color:var(--c-alarm)" title={saveErrorMsg}>· save failed</span>
		{/if}
		<span class="row" style="margin-left:auto; gap:6px">
			<span class="kbd">:w</span>
			<VimToggle />
		</span>
	</div>

	<div class="min-h-0 flex-1 overflow-hidden">
		{#if docQuery.isLoading}
			<p class="p-3 text-sm" style="color:var(--text-mute)">loading…</p>
		{:else if docQuery.isError}
			<p class="p-3 text-xs" style="color:var(--c-alarm)">
				{docQuery.error?.message ?? 'error loading doc'}
			</p>
		{:else}
			<div bind:this={editorContainer} class="h-full"></div>
		{/if}
	</div>
</div>
