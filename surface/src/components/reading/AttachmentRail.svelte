<script lang="ts">
	import { createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { browser } from '$app/environment';
	import { getWorkbenchContext } from '$lib/state/workbench.svelte';
	import {
		attachmentKeys,
		fetchAttachments,
		deleteAttachment,
		attachmentRawUrl,
		fetchWorkingAttachments,
		deleteWorkingAttachment,
		workingAttachmentRawUrl
	} from '$lib/api/attachments';
	import type { BaseAttachment } from '$lib/types';
	import { logError } from '$lib/utils/logError';
	import Icon from '$components/icons/Icon.svelte';

	type Props = { kind: 'capture'; captureId: number } | { kind: 'working'; slug: string };

	const props: Props = $props();

	const wb = getWorkbenchContext();
	const qc = useQueryClient();

	const queryKey = $derived(
		props.kind === 'capture'
			? attachmentKeys.captureList(props.captureId)
			: attachmentKeys.workingList(props.slug)
	);

	const query = createQuery<BaseAttachment[]>(() => ({
		queryKey,
		queryFn: () =>
			props.kind === 'capture'
				? fetchAttachments(props.captureId)
				: fetchWorkingAttachments(props.slug),
		enabled: browser
	}));
	const attachmentCount = $derived(query.data?.length ?? 0);

	let width = $state(browser ? parseInt(localStorage.getItem('lattice:att-rail-w') ?? '200') : 200);
	let minimized = $state(browser ? localStorage.getItem('lattice:att-rail-min') === 'true' : false);
	let deletingId = $state<number | null>(null);
	let status = $state('');

	function toggleMinimized() {
		minimized = !minimized;
		localStorage.setItem('lattice:att-rail-min', String(minimized));
	}

	function startResize(e: MouseEvent) {
		e.preventDefault();
		const startX = e.clientX;
		const startW = width;
		function onMove(ev: MouseEvent) {
			width = Math.max(150, Math.min(480, startW + (startX - ev.clientX)));
			localStorage.setItem('lattice:att-rail-w', String(width));
		}
		function onUp() {
			window.removeEventListener('mousemove', onMove);
			window.removeEventListener('mouseup', onUp);
		}
		window.addEventListener('mousemove', onMove);
		window.addEventListener('mouseup', onUp);
	}

	function resizeBy(delta: number) {
		width = Math.max(150, Math.min(480, width + delta));
		localStorage.setItem('lattice:att-rail-w', String(width));
	}

	function onResizeKey(e: KeyboardEvent) {
		if (e.key === 'ArrowLeft') {
			e.preventDefault();
			resizeBy(20);
		} else if (e.key === 'ArrowRight') {
			e.preventDefault();
			resizeBy(-20);
		}
	}

	function rawUrl(id: number): string {
		return props.kind === 'capture'
			? attachmentRawUrl(props.captureId, id)
			: workingAttachmentRawUrl(props.slug, id);
	}

	async function remove(id: number, filename: string) {
		if (!window.confirm(`Delete ${filename}? This cannot be undone.`)) return;
		deletingId = id;
		status = `Deleting ${filename}`;
		try {
			if (props.kind === 'capture') {
				await deleteAttachment(props.captureId, id);
			} else {
				await deleteWorkingAttachment(props.slug, id);
			}
			qc.invalidateQueries({ queryKey });
			status = `Deleted ${filename}`;
		} catch (err) {
			logError('deleteAttachment', err);
			status = `Failed to delete ${filename}`;
			wb.showToast(`Failed to delete ${filename}`);
		} finally {
			deletingId = null;
		}
	}

	function formatBytes(n: number): string {
		if (n < 1024) return `${n} B`;
		if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
		return `${(n / (1024 * 1024)).toFixed(1)} MB`;
	}
</script>

{#if query.isLoading || query.isError || (query.data && query.data.length > 0)}
	{#if minimized}
		<div
			class="att-rail att-rail--min"
			title="Attachments ({attachmentCount} file{attachmentCount === 1 ? '' : 's'})"
		>
			<button
				class="btn btn-ghost att-toggle"
				onclick={toggleMinimized}
				aria-label="Expand attachments"
			>
				<Icon name="maximize" size={13} />
			</button>
			<span class="att-min-badge">{attachmentCount}</span>
		</div>
	{:else}
		<aside class="att-rail" style="width:{width}px" aria-label="Attachments">
			<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
			<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
			<div
				class="att-resize-handle"
				role="separator"
				aria-orientation="vertical"
				aria-label="Resize attachments rail"
				aria-valuemin="150"
				aria-valuemax="480"
				aria-valuenow={width}
				tabindex="0"
				onmousedown={startResize}
				onkeydown={onResizeKey}
			></div>
			<div class="att-rail-head">
				<span class="att-rail-title">Attachments</span>
				<div class="row" style="gap:4px">
					<span class="faint" style="font-size:11px">
						{attachmentCount} file{attachmentCount === 1 ? '' : 's'}
					</span>
					<button
						class="btn btn-ghost att-toggle"
						onclick={toggleMinimized}
						aria-label="Minimize attachments"
					>
						<Icon name="minimize" size={12} />
					</button>
				</div>
			</div>
			<div class="att-status" role="status" aria-live="polite">
				{#if status}{status}{/if}
			</div>
			{#if query.isLoading}
				<p class="att-message" role="status">Loading attachments…</p>
			{:else if query.isError}
				<p class="att-message att-message--error" role="alert">Failed to load attachments.</p>
			{:else}
				<div class="att-list" aria-label="Attachment files">
					{#each query.data ?? [] as att (att.id)}
						<div class="att-item">
							<a
								href={rawUrl(att.id)}
								target="_blank"
								rel="external noopener noreferrer"
								class="att-name mono"
								title={att.filename}
							>
								{att.filename}
							</a>
							<span class="att-size faint">{formatBytes(att.size_bytes)}</span>
							<button
								class="btn btn-ghost att-del"
								onclick={() => remove(att.id, att.filename)}
								disabled={deletingId !== null}
								aria-label="Delete {att.filename}"
							>
								{deletingId === att.id ? '…' : '×'}
							</button>
						</div>
					{/each}
				</div>
			{/if}
		</aside>
	{/if}
{/if}

<style>
	.att-rail {
		flex-shrink: 0;
		border-left: 1px solid var(--line);
		background: var(--bg-raised);
		display: flex;
		flex-direction: column;
		overflow-y: auto;
		position: relative;
	}
	.att-rail--min {
		width: 28px;
		align-items: center;
		padding: 10px 0;
		gap: 10px;
	}
	.att-resize-handle {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 5px;
		cursor: col-resize;
		z-index: 1;
	}
	.att-resize-handle:hover {
		background: var(--line-strong, var(--accent, var(--line)));
	}
	.att-resize-handle:focus-visible {
		outline: 2px solid var(--accent, currentColor);
		outline-offset: -2px;
		background: var(--line-strong, var(--accent, var(--line)));
	}
	.att-rail-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px 10px 6px 16px;
	}
	.att-rail-title {
		font-size: 12px;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-mute);
		font-weight: 500;
	}
	.att-list {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 0 10px 10px 16px;
	}
	.att-status {
		min-height: 1rem;
		padding: 0 10px 2px 16px;
		font-size: 11px;
		color: var(--text-mute);
	}
	.att-message {
		padding: 0 10px 10px 16px;
		font-size: 12px;
		color: var(--text-mute);
	}
	.att-message--error {
		color: var(--c-alarm);
	}
	.att-item {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 12px;
	}
	.att-name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--text-link, var(--text));
	}
	.att-name:hover {
		text-decoration: underline;
	}
	.att-size {
		font-size: 11px;
		white-space: nowrap;
	}
	.att-del {
		padding: 1px 3px;
		opacity: 0.4;
		flex-shrink: 0;
	}
	.att-del:hover {
		opacity: 1;
	}
	.att-toggle {
		padding: 1px 3px;
		opacity: 0.5;
	}
	.att-toggle:hover {
		opacity: 1;
	}
	.att-min-badge {
		font-size: 11px;
		color: var(--text-mute);
		font-weight: 600;
	}
</style>
