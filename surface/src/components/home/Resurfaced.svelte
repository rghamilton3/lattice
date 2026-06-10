<script lang="ts">
	import { createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { browser } from '$app/environment';
	import Icon from '$components/icons/Icon.svelte';
	import type { DocRef, ResurfacedItem } from '$lib/types';
	import { resurfacedKeys, fetchResurfaced, dismissResurfaced } from '$lib/api/resurfaced';

	type Props = { onOpen: (ref: DocRef) => void };
	const { onOpen }: Props = $props();

	const queryClient = useQueryClient();

	const query = createQuery(() => ({
		queryKey: resurfacedKeys.today(),
		queryFn: fetchResurfaced,
		enabled: browser
	}));

	let dismissed = $state<Set<number>>(new Set());

	function visibleItems(items: ResurfacedItem[]): ResurfacedItem[] {
		return items.filter((it) => !dismissed.has(it.id));
	}

	async function handleDismiss(id: number) {
		dismissed = new Set([...dismissed, id]);
		try {
			await dismissResurfaced(id);
			queryClient.invalidateQueries({ queryKey: resurfacedKeys.today() });
		} catch {
			dismissed = new Set([...dismissed].filter((x) => x !== id));
		}
	}

	function refOf(item: ResurfacedItem): DocRef | null {
		if (item.target_kind === 'capture')
			return { kind: 'capture', id: parseInt(item.target_id, 10) };
		if (item.target_kind === 'working') return { kind: 'working', slug: item.target_id };
		return null;
	}
</script>

{#if query.isSuccess}
	{@const items = visibleItems(query.data.items)}
	{#if items.length > 0}
		<section class="card home-section">
			<div class="home-section-head">
				<h2 class="section-title">
					<Icon name="sparkle" size={16} />
					<span>From your past</span>
				</h2>
				<span class="faint" style="font-size:12px; white-space:nowrap; margin-left:12px">
					quiet · dismissible
				</span>
			</div>
			<div class="resurf">
				{#each items as it (it.id)}
					{@const ref = refOf(it)}
					<div class="resurf-row">
						<div class="resurf-reason faint">
							<Icon name="clock" size={12} />
							<span>{it.reason ?? 'Not visited in a while'}</span>
						</div>
						<div
							class="resurf-snippet"
							role="button"
							tabindex="0"
							onclick={() => ref && onOpen(ref)}
							onkeydown={(e) => {
								if ((e.key === 'Enter' || e.key === ' ') && ref) {
									e.preventDefault();
									onOpen(ref);
								}
							}}
						>
							{it.snippet}
						</div>
						<div class="resurf-actions">
							<button class="btn btn-ghost btn-mini" onclick={() => handleDismiss(it.id)}>
								<Icon name="check" size={12} />Useful
							</button>
							<button class="btn btn-ghost btn-mini" onclick={() => handleDismiss(it.id)}
								>Not now</button
							>
							<button class="btn btn-ghost btn-mini" onclick={() => handleDismiss(it.id)}
								>Don't resurface</button
							>
						</div>
					</div>
				{/each}
			</div>
		</section>
	{/if}
{/if}
