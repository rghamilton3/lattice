<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import { browser } from '$app/environment';
	import { workingKeys, fetchWorking } from '$lib/api/working';
	import type { WorkingDocListItem } from '$lib/types';
	import Icon from '$components/icons/Icon.svelte';
	import { relTime } from '$lib/utils/relTime';

	type Props = {
		doc: WorkingDocListItem;
		now: number;
		onOpen: () => void;
		onOpenSplit: () => void;
	};
	const { doc, now, onOpen, onOpenSplit }: Props = $props();

	// The list endpoint returns metadata only; the snippet wants prose, so
	// fetch the doc's content separately. Cached under the same key the
	// reading pane uses, so opening it next is instant.
	const detail = createQuery(() => ({
		queryKey: workingKeys.detail(doc.slug),
		queryFn: () => fetchWorking(doc.slug),
		enabled: browser
	}));

	function snippet(content: string): string {
		const prose = content
			.split('\n')
			.filter((l) => l.trim() && !l.startsWith('#'))
			.slice(0, 3)
			.join(' ');
		return prose.length > 260 ? prose.slice(0, 260) + '…' : prose;
	}
</script>

<div
	class="now-card card"
	role="button"
	tabindex="0"
	onclick={onOpen}
	onkeydown={(e) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			onOpen();
		}
	}}
>
	<div class="now-card-inner">
		<div class="row" style="gap:8px">
			<span class="chip chip-working">working</span>
			<span class="faint mono" style="font-size:12px">{doc.slug}.md</span>
			<span class="faint" style="font-size:12px; margin-left:auto; white-space:nowrap">
				edited {relTime(doc.modified_at, now)}
			</span>
		</div>
		<h2 class="now-card-title">{doc.title}</h2>
		{#if detail.data}
			<p class="now-card-snippet soft">{snippet(detail.data.content)}</p>
		{:else if detail.isLoading}
			<p class="now-card-snippet soft faint">loading preview…</p>
		{/if}
		<div class="now-card-actions">
			<button
				class="btn btn-primary"
				onclick={(e) => {
					e.stopPropagation();
					onOpen();
				}}
			>
				<Icon name="arrow-right" size={14} />Resume
			</button>
			<button
				class="btn btn-ghost"
				onclick={(e) => {
					e.stopPropagation();
					onOpenSplit();
				}}
			>
				<Icon name="split" size={14} />Open in split
			</button>
		</div>
	</div>
</div>
