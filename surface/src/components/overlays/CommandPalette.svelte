<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import { browser } from '$app/environment';
	import { getWorkbenchContext } from '$lib/state/workbench.svelte';
	import { workingKeys, fetchWorkingList } from '$lib/api/working';
	import { captureKeys, fetchCaptures } from '$lib/api/captures';
	import Icon from '$components/icons/Icon.svelte';

	const wb = getWorkbenchContext();

	let input = $state<HTMLInputElement | null>(null);
	let modal = $state<HTMLDivElement | null>(null);
	let q = $state('');
	let active = $state(0);

	const workingQuery = createQuery(() => ({
		queryKey: workingKeys.list(),
		queryFn: fetchWorkingList,
		enabled: browser
	}));

	const capturesQuery = createQuery(() => ({
		queryKey: captureKeys.list(20),
		queryFn: () => fetchCaptures(20),
		enabled: browser
	}));

	$effect(() => {
		input?.focus();
	});

	type Item = {
		id: string;
		label: string;
		hint: string;
		kbd: string[];
		kind: 'action' | 'working' | 'capture';
		run: () => void;
	};

	function actionItems(): Item[] {
		return [
			{
				id: 'cap',
				label: 'Quick capture',
				hint: 'open capture overlay',
				kbd: ['c'],
				kind: 'action',
				run: () => (wb.activeOverlay = 'capture')
			},
			{
				id: 'search',
				label: 'Search everything',
				hint: 'go to search view',
				kbd: ['Ctrl', '/'],
				kind: 'action',
				run: () => wb.openInPane(0, { kind: 'search', query: '' })
			},
			{
				id: 'home',
				label: 'Go home',
				hint: 'inbox + working docs',
				kbd: ['g', 'h'],
				kind: 'action',
				run: () => wb.openInPane(0, { kind: 'home' })
			},
			{
				id: 'new',
				label: 'New working doc',
				hint: 'creates a markdown working doc',
				kbd: ['Ctrl', 'Shift', 'J'],
				kind: 'action',
				run: () => (wb.activeOverlay = 'newDoc')
			},
			{
				id: 'focus',
				label: 'Toggle focus mode',
				hint: 'hide all chrome',
				kbd: ['Ctrl', '.'],
				kind: 'action',
				run: () => (wb.focusMode = !wb.focusMode)
			},
			{
				id: 'vim',
				label: 'Toggle vim mode',
				hint: 'editor pane',
				kbd: ['Ctrl', 'Alt', 'V'],
				kind: 'action',
				run: () => wb.toggleVim()
			},
			{
				id: 'theme',
				label: 'Switch theme…',
				hint: 'light / dark / sepia',
				kbd: [],
				kind: 'action',
				run: () => (wb.activeOverlay = 'settings')
			}
		];
	}

	const items = $derived.by<Item[]>(() => {
		const actions = actionItems();
		const working: Item[] = (workingQuery.data ?? []).map((d) => ({
			id: 'w-' + d.slug,
			label: d.title,
			hint: d.slug + '.md',
			kbd: [],
			kind: 'working',
			run: () =>
				wb.openInPane(wb.focusedPane, { kind: 'doc', ref: { kind: 'working', slug: d.slug } })
		}));
		const captures: Item[] = (capturesQuery.data ?? []).slice(0, 8).map((c) => ({
			id: 'c-' + c.id,
			label: c.text.slice(0, 80),
			hint: 'capture · ' + c.source,
			kbd: [],
			kind: 'capture',
			run: () => wb.openInPane(wb.focusedPane, { kind: 'doc', ref: { kind: 'capture', id: c.id } })
		}));
		const all = [...actions, ...working, ...captures];
		const query = q.trim().toLowerCase();
		if (!query) return all.slice(0, 12);
		return all.filter((x) => (x.label + ' ' + x.hint).toLowerCase().includes(query)).slice(0, 14);
	});

	$effect(() => {
		if (active >= items.length) active = 0;
	});

	function close() {
		wb.activeOverlay = 'none';
	}

	function runActive() {
		const it = items[active];
		if (!it) return;
		it.run();
		close();
	}

	function onInputKey(e: KeyboardEvent) {
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			active = Math.min(active + 1, items.length - 1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			active = Math.max(0, active - 1);
		} else if (e.key === 'Enter') {
			e.preventDefault();
			runActive();
		}
	}

	function trapTab(e: KeyboardEvent) {
		if (e.key !== 'Tab' || !modal) return;
		const focusables = modal.querySelectorAll<HTMLElement>(
			'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
		);
		if (focusables.length === 0) return;
		const first = focusables[0];
		const last = focusables[focusables.length - 1];
		if (e.shiftKey && document.activeElement === first) {
			e.preventDefault();
			last.focus();
		} else if (!e.shiftKey && document.activeElement === last) {
			e.preventDefault();
			first.focus();
		}
	}

	function chipClass(kind: Item['kind']): string {
		if (kind === 'working') return 'chip chip-working';
		if (kind === 'capture') return 'chip chip-capture';
		return 'chip';
	}
</script>

<div class="overlay" onclick={close} role="presentation">
	<div
		bind:this={modal}
		class="palette soft-in"
		role="dialog"
		aria-modal="true"
		aria-label="Command palette"
		tabindex="-1"
		onclick={(e) => e.stopPropagation()}
		onkeydown={trapTab}
	>
		<div class="palette-input-row">
			<Icon name="search" size={14} />
			<input
				bind:this={input}
				bind:value={q}
				class="palette-input"
				placeholder="Type an action or a phrase from a note…"
				oninput={() => (active = 0)}
				onkeydown={onInputKey}
			/>
			<button class="btn btn-ghost" onclick={close} aria-label="Close">
				<Icon name="x" size={14} />
			</button>
		</div>
		<div class="palette-list">
			{#if items.length === 0}
				<div class="palette-empty soft">
					No matches — but you can still
					<button
						class="link"
						onclick={() => {
							wb.activeOverlay = 'capture';
						}}
					>
						capture this thought
					</button>
					.
				</div>
			{:else}
				{#each items as it, i (it.id)}
					<button
						class="palette-row"
						class:is-active={i === active}
						onmouseenter={() => (active = i)}
						onclick={() => {
							it.run();
							close();
						}}
					>
						<span class={chipClass(it.kind)}>{it.kind}</span>
						<span class="palette-label">{it.label}</span>
						<span class="palette-hint faint">{it.hint}</span>
						{#if it.kbd.length > 0}
							<span class="palette-kbd-row mono">
								{#each it.kbd as k, ki (ki)}
									<span class="kbd">{k}</span>
								{/each}
							</span>
						{:else}
							<span></span>
						{/if}
					</button>
				{/each}
			{/if}
		</div>
		<div class="palette-foot faint">
			<span><span class="kbd">↑</span> <span class="kbd">↓</span> navigate</span>
			<span><span class="kbd">↵</span> open</span>
			<span><span class="kbd">esc</span> close</span>
		</div>
	</div>
</div>
