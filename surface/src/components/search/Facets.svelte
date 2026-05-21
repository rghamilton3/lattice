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
	};

	const { clustersEnabled, kindFilter, toggleKind, sort, setSort }: Props = $props();

	const kinds: Kind[] = ['capture', 'local-file', 'working'];
	const kindChip: Record<Kind, string> = {
		capture: 'chip chip-capture',
		'local-file': 'chip chip-file',
		working: 'chip chip-working'
	};
</script>

<aside class="facets">
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

	<div class="facets-section">
		<div class="facets-head"><span>Sort</span></div>
		<div class="facets-list">
			<button class="facet" aria-pressed={sort === 'recency'} onclick={() => setSort('recency')}>
				<Icon name="clock" size={13} />
				<span class="facet-label">Recency-broken</span>
			</button>
			<button class="facet" aria-pressed={sort === 'score'} onclick={() => setSort('score')}>
				<Icon name="sim" size={13} />
				<span class="facet-label">Score-only</span>
			</button>
		</div>
	</div>

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
</aside>
