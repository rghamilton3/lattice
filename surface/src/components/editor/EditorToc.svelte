<script lang="ts">
	import type { TocEntry } from '$lib/editor/parseToc';

	const {
		entries,
		onNavigate,
		activeLineNumber = 0
	}: {
		entries: TocEntry[];
		onNavigate: (entry: TocEntry) => void;
		activeLineNumber?: number;
	} = $props();
</script>

<nav class="toc-panel" aria-label="Table of contents">
	<header class="toc-header">
		<span class="toc-label">Contents</span>
		{#if entries.length > 0}
			<span class="toc-count" aria-label="{entries.length} headings">{entries.length}</span>
		{/if}
	</header>
	{#if entries.length === 0}
		<p class="toc-empty">No headings yet</p>
	{:else}
		<ul role="list">
			{#each entries as entry (entry.lineNumber)}
				<li>
					<button
						type="button"
						class="toc-entry"
						data-level={entry.level}
						data-active={entry.lineNumber === activeLineNumber ? '' : undefined}
						aria-current={entry.lineNumber === activeLineNumber ? 'location' : undefined}
						style="--depth: {entry.level - 1}"
						title={entry.text}
						onclick={() => onNavigate(entry)}
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
		display: flex;
		flex-direction: column;
		height: 100%;
	}

	.toc-header {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 7px 28px 7px 10px; /* right padding reserves space for collapse btn */
		border-bottom: 1px solid var(--line);
		flex-shrink: 0;
	}

	.toc-label {
		font-size: 10.5px;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text-faint);
		line-height: 1;
	}

	.toc-count {
		font-size: 10px;
		font-weight: 500;
		color: var(--text-faint);
		background: var(--bg-high);
		border-radius: 8px;
		padding: 1px 5px;
		line-height: 1.4;
	}

	ul {
		list-style: none;
		margin: 0;
		padding: 4px;
		overflow-y: auto;
		flex: 1;
	}

	.toc-entry {
		display: block;
		width: 100%;
		text-align: left;
		padding: 3px 8px 3px calc(10px + var(--depth, 0) * 12px);
		background: none;
		border: none;
		cursor: pointer;
		font-size: 12px;
		font-weight: 400;
		line-height: 1.4;
		color: var(--text-faint);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		border-radius: 4px;
		transition:
			color var(--t-fast) var(--ease),
			background-color var(--t-fast) var(--ease);
	}

	/* H1 — primary, full weight */
	.toc-entry[data-level='1'] {
		color: var(--text-soft);
		font-weight: 600;
	}

	/* H2 — secondary, medium weight */
	.toc-entry[data-level='2'] {
		color: var(--text-mute);
		font-weight: 500;
	}

	/* H3 — tertiary, standard weight, slightly smaller */
	.toc-entry[data-level='3'] {
		color: var(--text-mute);
		font-size: 11.5px;
	}

	/* H4–H6 — deep nesting, faint */
	.toc-entry[data-level='4'],
	.toc-entry[data-level='5'],
	.toc-entry[data-level='6'] {
		color: var(--text-faint);
		font-size: 11px;
	}

	.toc-entry:hover,
	.toc-entry:focus-visible {
		color: var(--text);
		background: var(--bg-high);
		outline: none;
	}

	/* Active section — accent highlight */
	.toc-entry[data-active] {
		color: var(--c-accent);
		background: color-mix(in oklch, var(--c-accent) 8%, transparent);
	}

	.toc-entry[data-active]:hover {
		color: var(--c-accent);
		background: color-mix(in oklch, var(--c-accent) 14%, transparent);
	}

	.toc-empty {
		font-size: 11.5px;
		color: var(--text-faint);
		padding: 16px 12px;
		font-style: italic;
		margin: 0;
		text-align: center;
	}
</style>
