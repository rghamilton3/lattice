<script lang="ts">
	import type {
		ArchiveAction,
		InboxAction,
		InboxActionDescriptor,
		InboxItem,
		TriageAction
	} from '$lib/types';
	import { attachmentRawUrl } from '$lib/api/attachments';
	import { archiveRawUrl } from '$lib/api/archives';
	import Icon from '$components/icons/Icon.svelte';
	import ActionRow from '$components/inbox/ActionRow.svelte';
	import InboxAudioNotes from './InboxAudioNotes.svelte';
	import { relTime } from '$lib/utils/relTime';

	type Props = {
		items: InboxItem[];
		now: number;
		onOpenCapture: (id: number) => void;
		onOpenArchive: (id: number) => void;
		onTriage: (id: number, action: TriageAction) => void;
		onArchiveAction: (id: number, action: ArchiveAction) => void;
		onEditCapture: (id: number, text: string) => Promise<void>;
	};
	const {
		items,
		now,
		onOpenCapture,
		onOpenArchive,
		onTriage,
		onArchiveAction,
		onEditCapture
	}: Props = $props();

	let active = $state(0);
	const visibleItems = $derived(items.slice(0, 5));

	let editingId = $state<number | null>(null);
	let editText = $state('');
	let editSaving = $state(false);

	function focusOnMount(node: HTMLElement) {
		node.focus();
	}

	function startEdit(item: InboxItem) {
		if (item.item_type !== 'capture') return;
		editingId = item.capture_id;
		editText = item.title;
	}

	async function saveEdit(captureId: number) {
		editSaving = true;
		try {
			await onEditCapture(captureId, editText);
			editingId = null;
		} finally {
			editSaving = false;
		}
	}

	// Keep active index in bounds when items are removed after a triage.
	$effect(() => {
		if (active >= visibleItems.length && visibleItems.length > 0) {
			active = visibleItems.length - 1;
		}
	});

	const triageActions = new Set<InboxAction>(['keep', 'archive', 'promote', 'task', 'skip']);
	const archiveActions = new Set<InboxAction>([
		'keep',
		'archive',
		'recapture',
		'delete',
		'skip',
		'auto-kept'
	]);

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

	function isTriageAction(action: InboxAction): action is TriageAction {
		return triageActions.has(action);
	}

	function isArchiveAction(action: InboxAction): action is ArchiveAction {
		return archiveActions.has(action);
	}

	function onItemAction(item: InboxItem, action: InboxAction) {
		if (item.item_type === 'capture') {
			if (isTriageAction(action)) onTriage(item.capture_id, action);
			return;
		}
		if (isArchiveAction(action)) onArchiveAction(item.archive_id, action);
	}

	function handleKeydown(event: KeyboardEvent) {
		const item = visibleItems[active];
		if (!item) return;
		const target = event.target as HTMLElement | null;
		if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
		const match = item.actions.find((a: InboxActionDescriptor) => {
			if (a.shortcut === 'Space') return event.key === ' ';
			return event.key.toLowerCase() === a.shortcut.toLowerCase();
		});
		if (!match) return;
		event.preventDefault();
		onItemAction(item, match.action);
	}
</script>

<svelte:window onkeydown={handleKeydown} />

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
		{#each visibleItems as item, i (item.id)}
			<div
				class="inbox-row"
				aria-label={`Open ${item.item_type}: ${item.title}`}
				data-active={i === active}
				data-has-thumb={item.item_type === 'capture' &&
					item.capture.first_image_id != null &&
					editingId !== item.capture_id}
				data-editing={item.item_type === 'capture' && editingId === item.capture_id}
				role="button"
				tabindex="0"
				onmouseenter={() => (active = i)}
				onclick={() => {
					if (item.item_type === 'capture' && editingId === item.capture_id) return;
					openItem(item);
				}}
				onkeydown={(e) => {
					if (e.key === 'Enter') {
						e.preventDefault();
						if (item.item_type === 'capture' && editingId === item.capture_id) return;
						openItem(item);
					}
				}}
			>
				<div class="inbox-mark">
					<Icon name="circle" size={8} />
				</div>
				{#if item.item_type === 'capture' && editingId === item.capture_id}
					<div class="inbox-body inbox-edit-panel">
						<textarea
							class="inbox-edit-textarea"
							bind:value={editText}
							rows="3"
							use:focusOnMount
							onkeydown={(e) => {
								if (e.key === 'Escape') editingId = null;
								if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveEdit(item.capture_id);
							}}
						></textarea>
						<div class="inbox-edit-actions">
							<button
								class="btn btn-ghost btn-mini"
								disabled={editSaving}
								onclick={(e) => {
									e.stopPropagation();
									editingId = null;
								}}
							>
								cancel
							</button>
							<button
								class="btn btn-primary btn-mini"
								disabled={editSaving}
								onclick={(e) => {
									e.stopPropagation();
									saveEdit(item.capture_id);
								}}
							>
								save
							</button>
						</div>
					</div>
				{:else}
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
						{#if item.item_type === 'capture'}
							<InboxAudioNotes captureId={item.capture_id} />
						{/if}
						<ActionRow actions={item.actions} onAction={(action) => onItemAction(item, action)} />
					</div>
					{#if item.item_type === 'capture'}
						<button
							class="inbox-edit-btn"
							title="Edit capture"
							aria-label="Edit capture: {item.title}"
							onclick={(e) => {
								e.stopPropagation();
								startEdit(item);
							}}
						>
							<Icon name="edit" size={13} />
						</button>
					{/if}
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
				{/if}
			</div>
		{/each}
	</div>
{/if}
