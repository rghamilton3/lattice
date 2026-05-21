<script lang="ts">
	import Icon from '$components/icons/Icon.svelte';
	import { getWorkbenchContext } from '$lib/state/workbench.svelte';
	import type { DocRef } from '$lib/types';

	type ResurfacedItem =
		| { kind: 'capture'; id: number; reason: string; snippet: string }
		| { kind: 'working'; slug: string; reason: string; snippet: string };

	// TODO(spine): replace with fetchResurfaced() once /api/resurfaced ships.
	const MOCK_RESURFACED: ResurfacedItem[] = [
		{
			kind: 'capture',
			id: 198,
			reason: 'You wrote this 6 months ago',
			snippet:
				'the inbox should never feel like a backlog failure. "clear 10 items in 5 minutes" mode beats a guilt counter.'
		},
		{
			kind: 'working',
			slug: 'cluster-naming-experiments',
			reason: 'You opened this often, then stopped',
			snippet:
				'experiments with LLM-labeled HDBSCAN clusters — first labels were too long; centroid + 2-3 keywords is the sweet spot.'
		},
		{
			kind: 'capture',
			id: 233,
			reason: 'Tagged in a doc you wrote yesterday',
			snippet:
				'ASM Consortium grey-background paper — "salience must be allocated, not spent everywhere."'
		}
	];

	type Props = { onOpen: (ref: DocRef) => void };
	const { onOpen }: Props = $props();

	const wb = getWorkbenchContext();
	const items = MOCK_RESURFACED;

	function refOf(it: ResurfacedItem): DocRef {
		return it.kind === 'capture'
			? { kind: 'capture', id: it.id }
			: { kind: 'working', slug: it.slug };
	}

	function placeholderAction() {
		wb.showToast('Coming with spine');
	}
</script>

<div class="resurf">
	{#each items as it (it.kind === 'capture' ? `c:${it.id}` : `w:${it.slug}`)}
		<div class="resurf-row">
			<div class="resurf-reason faint">
				<Icon name="clock" size={12} />
				<span>{it.reason}</span>
			</div>
			<div
				class="resurf-snippet"
				role="button"
				tabindex="0"
				onclick={() => onOpen(refOf(it))}
				onkeydown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						onOpen(refOf(it));
					}
				}}
			>
				{it.snippet}
			</div>
			<div class="resurf-actions">
				<button class="btn btn-ghost btn-mini" onclick={placeholderAction}>
					<Icon name="check" size={12} />Useful
				</button>
				<button class="btn btn-ghost btn-mini" onclick={placeholderAction}>Not now</button>
				<button class="btn btn-ghost btn-mini" onclick={placeholderAction}>Don't resurface</button>
			</div>
		</div>
	{/each}
</div>
