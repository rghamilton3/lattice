<script module lang="ts">
	export type Kind = 'capture' | 'local-file' | 'working';
	export type Sort = 'recency' | 'score';
</script>

<script lang="ts">
	import Icon from '$components/icons/Icon.svelte';

	type Props = {
		clustersEnabled: boolean;
		kindFilter: Set<Kind>;
		toggleKind: (k: Kind) => void;
		sort: Sort;
		setSort: (s: Sort) => void;
		showSort?: boolean;
		open: boolean;
		onToggle: () => void;
		onResizeStart: (e: MouseEvent) => void;
	};

	const {
		clustersEnabled,
		kindFilter,
		toggleKind,
		sort,
		setSort,
		showSort = true,
		open,
		onToggle,
		onResizeStart
	}: Props = $props();

	const kinds: Kind[] = ['capture', 'local-file', 'working'];
	const kindChip: Record<Kind, string> = {
		capture: 'chip chip-capture',
		'local-file': 'chip chip-file',
		working: 'chip chip-working'
	};
</script>

{#if !open}
	<aside class="facets facets--min">
		<button class="btn btn-ghost facets-toggle" onclick={onToggle} aria-label="Expand filters">
			<Icon name="maximize" size={13} />
		</button>
	</aside>
{:else}
	<aside class="facets">
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div
			class="facets-resize-handle"
			role="separator"
			aria-orientation="vertical"
			onmousedown={onResizeStart}
		></div>
		<div class="facets-rail-head">
			<span class="facets-rail-title">Filters</span>
			<button class="btn btn-ghost facets-toggle" onclick={onToggle} aria-label="Minimize filters">
				<Icon name="minimize" size={12} />
			</button>
		</div>
		<div class="facets-body">
			<div class="facets-section">
				<div class="facets-head">
					<span>Clusters</span>
					<span class="faint" style="font-size:11px">
						{clustersEnabled ? 'HDBSCAN · labeled' : 'pending spine'}
					</span>
				</div>
				<div class="facets-list">
					<!-- TODO(spine): query GET /api/search/clusters?q=… once the endpoint ships;
					     then render coloured-dot facets driven by SearchResult.cluster.
					     For now we show a single "All results" pseudo-facet. -->
					<button class="facet" aria-pressed="true" disabled>
						<span class="facet-dot" style="background:var(--c-accent)"></span>
						<span class="facet-label">All results</span>
					</button>
				</div>
			</div>

			<div class="facets-section">
				<div class="facets-head"><span>Kind</span></div>
				<div class="facets-list">
					{#each kinds as k (k)}
						<button class="facet" aria-pressed={kindFilter.has(k)} onclick={() => toggleKind(k)}>
							<span class={kindChip[k]}>{k}</span>
						</button>
					{/each}
				</div>
			</div>

			{#if showSort}
				<div class="facets-section">
					<div class="facets-head"><span>Sort</span></div>
					<div class="facets-list">
						<button
							class="facet"
							aria-pressed={sort === 'recency'}
							onclick={() => setSort('recency')}
						>
							<Icon name="clock" size={13} />
							<span class="facet-label">Recency-broken</span>
						</button>
						<button class="facet" aria-pressed={sort === 'score'} onclick={() => setSort('score')}>
							<Icon name="sim" size={13} />
							<span class="facet-label">Score-only</span>
						</button>
					</div>
				</div>
			{/if}

			<div class="facets-section facets-saved">
				<div class="facets-head"><span>Saved</span></div>
				<div class="facets-list">
					<!-- TODO(spine): saved searches need an endpoint (GET /api/saved-searches?).
					     These are static placeholders. -->
					<button class="facet" disabled>Active research</button>
					<button class="facet" disabled>Open questions</button>
					<button class="facet" disabled>Waiting on someone</button>
				</div>
			</div>
		</div>
	</aside>
{/if}

<style>
	.facets--min {
		width: 28px;
		align-items: center;
		padding: 10px 0;
	}

	.facets-resize-handle {
		position: absolute;
		right: 0;
		top: 0;
		bottom: 0;
		width: 5px;
		cursor: col-resize;
		z-index: 1;
	}

	.facets-resize-handle:hover {
		background: var(--line-strong, var(--c-accent, var(--line)));
	}

	.facets-rail-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px 10px 6px 14px;
		flex-shrink: 0;
	}

	.facets-rail-title {
		font-size: 12px;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-mute);
		font-weight: 500;
	}

	.facets-toggle {
		padding: 1px 3px;
		opacity: 0.5;
	}

	.facets-toggle:hover {
		opacity: 1;
	}

	.facets-body {
		flex: 1;
		overflow-y: auto;
		padding: 4px 12px 30px;
	}
</style>
