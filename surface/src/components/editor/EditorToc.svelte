<script lang="ts">
	import type { TocEntry } from '$lib/editor/parseToc';

	const {
		entries,
		onNavigate
	}: {
		entries: TocEntry[];
		onNavigate: (lineNumber: number) => void;
	} = $props();
</script>

<nav class="toc-panel" aria-label="Table of contents">
	{#if entries.length === 0}
		<p class="toc-empty">No headings</p>
	{:else}
		<ul role="list">
			{#each entries as entry (entry.lineNumber)}
				<li>
					<button
						type="button"
						class="toc-entry"
						style="padding-left: {8 + (entry.level - 1) * 14}px"
						title={entry.text}
						onclick={() => onNavigate(entry.lineNumber)}
					>
						{entry.text}
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</nav>

<style>
	.toc-panel {
		padding: 6px 0;
		height: 100%;
	}

	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.toc-entry {
		display: block;
		width: 100%;
		text-align: left;
		padding-top: 3px;
		padding-bottom: 3px;
		padding-right: 8px;
		background: none;
		border: none;
		cursor: pointer;
		font-size: 12px;
		line-height: 1.4;
		color: var(--text-mute);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		border-radius: 3px;
	}

	.toc-entry:hover,
	.toc-entry:focus-visible {
		color: var(--text);
		background: var(--bg-high);
		outline: none;
	}

	.toc-empty {
		font-size: 11px;
		color: var(--text-faint);
		padding: 8px 10px;
		font-style: italic;
		margin: 0;
	}
</style>
