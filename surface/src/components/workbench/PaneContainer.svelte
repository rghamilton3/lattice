<script lang="ts">
	import { getWorkbenchContext } from '$lib/state/workbench.svelte';
	import type { PaneContent } from '$lib/types';
	import PaneRouter from './PaneRouter.svelte';

	const { paneIndex, content }: { paneIndex: 0 | 1; content: PaneContent } = $props();

	const wb = getWorkbenchContext();

	function paneTitle(c: PaneContent): string {
		switch (c.kind) {
			case 'empty':
				return 'empty';
			case 'search':
				return c.query ? `search: ${c.query}` : 'search';
			case 'results':
				return c.source.kind;
			case 'doc':
				if (c.ref.kind === 'working') return c.ref.slug;
				return `${c.ref.kind} #${c.ref.id}`;
			case 'editor':
				return `edit: ${c.slug}`;
		}
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
	class="flex h-full flex-col"
	role="region"
	aria-label="Pane {paneIndex + 1}"
	tabindex="-1"
	onclick={() => (wb.focusedPane = paneIndex)}
	onkeydown={() => (wb.focusedPane = paneIndex)}
>
	<div
		class="flex h-7 shrink-0 items-center border-b border-border bg-surface-raised px-2 text-xs"
		class:border-accent={wb.focusedPane === paneIndex}
	>
		<span class="truncate text-text-muted">{paneTitle(content)}</span>
		{#if paneIndex === 1}
			<button
				class="ml-auto text-text-muted hover:text-text"
				aria-label="Close pane"
				onclick={(e) => {
					e.stopPropagation();
					wb.closeRightPane();
				}}>✕</button
			>
		{/if}
	</div>
	<div class="min-h-0 flex-1 overflow-hidden">
		<PaneRouter {paneIndex} {content} />
	</div>
</div>
