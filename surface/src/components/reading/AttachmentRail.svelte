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

	let width = $state(browser ? parseInt(localStorage.getItem('lattice:att-rail-w') ?? '200') : 200);
	let minimized = $state(browser ? localStorage.getItem('lattice:att-rail-min') === 'true' : false);

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

	function rawUrl(id: number): string {
		return props.kind === 'capture'
			? attachmentRawUrl(props.captureId, id)
			: workingAttachmentRawUrl(props.slug, id);
	}

	async function remove(id: number, filename: string) {
		try {
			if (props.kind === 'capture') {
				await deleteAttachment(props.captureId, id);
			} else {
				await deleteWorkingAttachment(props.slug, id);
			}
			qc.invalidateQueries({ queryKey });
		} catch (err) {
			logError('deleteAttachment', err);
			wb.showToast(`Failed to delete ${filename}`);
		}
	}

	function formatBytes(n: number): string {
		if (n < 1024) return `${n} B`;
		if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
		return `${(n / (1024 * 1024)).toFixed(1)} MB`;
	}
</script>

{#if query.data && query.data.length > 0}
	{#if minimized}
		<div
			class="att-rail att-rail--min"
			title="Attachments ({query.data.length} file{query.data.length === 1 ? '' : 's'})"
		>
			<button
				class="btn btn-ghost att-toggle"
				onclick={toggleMinimized}
				aria-label="Expand attachments"
			>
				<Icon name="minimize" size={13} />
			</button>
			<span class="att-min-badge">{query.data.length}</span>
		</div>
	{:else}
		<div class="att-rail" style="width:{width}px">
			<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
			<div
				class="att-resize-handle"
				role="separator"
				aria-orientation="vertical"
				onmousedown={startResize}
			></div>
			<div class="att-rail-head">
				<span class="att-rail-title">Attachments</span>
				<div class="row" style="gap:4px">
					<span class="faint" style="font-size:11px"
						>{query.data.length} file{query.data.length === 1 ? '' : 's'}</span
					>
					<button
						class="btn btn-ghost att-toggle"
						onclick={toggleMinimized}
						aria-label="Minimize attachments"
					>
						<Icon name="minimize" size={12} />
					</button>
				</div>
			</div>
			<div class="att-list">
				{#each query.data as att (att.id)}
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
							aria-label="Delete {att.filename}"
						>
							×
						</button>
					</div>
				{/each}
			</div>
		</div>
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
