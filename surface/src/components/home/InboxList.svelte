<script lang="ts">
	import type { InboxItem } from '$lib/types';
	import type { TriageAction } from '$lib/api/captures';
	import { attachmentRawUrl } from '$lib/api/attachments';
	import { archiveRawUrl } from '$lib/api/archives';
	import Icon from '$components/icons/Icon.svelte';
	import ActionRow from '$components/inbox/ActionRow.svelte';
	import { relTime } from '$lib/utils/relTime';

	type Props = {
		items: InboxItem[];
		now: number;
		onOpenCapture: (id: number) => void;
		onOpenArchive: (id: number) => void;
		onTriage: (id: number, action: TriageAction) => void;
		onArchiveAction: (id: number, action: string) => void;
	};
	const { items, now, onOpenCapture, onOpenArchive, onTriage, onArchiveAction }: Props = $props();

	let active = $state(0);

	function openItem(item: InboxItem) {
		if (item.item_type === 'capture') {
			onOpenCapture(item.capture_id);
		} else {
			onOpenArchive(item.archive_id);
		}
	}

	function openExternal(event: MouseEvent, url: string) {
		event.stopPropagation();
		window.open(url, '_blank', 'noopener,noreferrer');
	}
</script>

{#if items.length === 0}
	<div class="inbox-empty soft">
		<div style="font-size:22px; margin-bottom:6px">📭</div>
		<div style="font-weight:500">Inbox is clear. New captures will appear here.</div>
		<div class="faint" style="font-size:13px; margin-top:4px">
			Capture something the moment you think of it — sort later, or never.
		</div>
	</div>
{:else}
	<div class="inbox">
		{#each items.slice(0, 5) as item, i (item.id)}
			<div
				class="inbox-row"
				aria-label={`Open ${item.item_type}: ${item.title}`}
				data-active={i === active}
				data-has-thumb={item.item_type === 'capture' && item.capture.first_image_id != null}
				role="button"
				tabindex="0"
				onmouseenter={() => (active = i)}
				onclick={() => openItem(item)}
				onkeydown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						openItem(item);
					}
				}}
			>
				<div class="inbox-mark">
					<Icon name="circle" size={8} />
				</div>
				<div class="inbox-body">
					<div class="inbox-text">{item.title}</div>
					{#if item.item_type !== 'capture'}
						<div class="faint" style="font-size:13px; margin-top:3px">{item.summary}</div>
					{/if}
					<div class="inbox-meta">
						<span class="chip chip-capture">
							{item.item_type === 'capture'
								? 'capture'
								: item.item_type === 'archive_recent'
									? 'recent archive'
									: 'recapture'}
						</span>
						<span>·</span>
						<span class="mono">{item.source ?? 'web'}</span>
						<span>·</span>
						<span>{relTime(item.created_at, now)}</span>
						{#if item.item_type !== 'capture'}
							<span>·</span>
							<button type="button" class="mono" onclick={(e) => openExternal(e, item.url)}
								>{item.url}</button
							>
						{/if}
					</div>
					<ActionRow
						actions={item.actions}
						active={i === active}
						onAction={(action) =>
							item.item_type === 'capture'
								? onTriage(item.capture_id, action as TriageAction)
								: onArchiveAction(item.archive_id, action)}
					/>
				</div>
				{#if item.item_type === 'capture' && item.capture.first_image_id != null}
					<img
						class="inbox-thumb"
						src={attachmentRawUrl(item.capture_id, item.capture.first_image_id)}
						alt="attachment preview"
						loading="lazy"
						onerror={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')}
					/>
				{:else if item.item_type !== 'capture'}
					<button
						type="button"
						class="btn btn-ghost"
						onclick={(e) => openExternal(e, archiveRawUrl(item.archive_id))}
					>
						Open archive
					</button>
				{/if}
			</div>
		{/each}
	</div>
{/if}
