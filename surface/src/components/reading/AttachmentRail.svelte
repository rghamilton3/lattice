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
		workingAttachmentRawUrl,
		fetchAttachmentDescription,
		updateAttachmentDescription,
		fetchWorkingAttachmentDescription,
		updateWorkingAttachmentDescription,
		retryExtraction,
		isAudioAttachment,
		displayFailureReason,
		type DescriptionPatch
	} from '$lib/api/attachments';
	import { ApiError } from '$lib/api/client';
	import type { AttachmentDescription, BaseAttachment, CaptureAttachment } from '$lib/types';
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

	// ── Machine descriptions (dark attachments) ─────────────────────────────────

	let descOpenId = $state<number | null>(null);
	let draft = $state('');
	let draftFor = $state<number | null>(null);
	let saving = $state(false);
	let saveError = $state('');

	// Descriptions exist for dark attachments; for capture audio attachments the
	// description row is the transcript (020 RH-4), editable through the same flow.
	function hasDescription(att: BaseAttachment): boolean {
		return att.extraction_status === 'dark' || (props.kind === 'capture' && isAudioAttachment(att));
	}

	function descLabel(att: BaseAttachment): string {
		return isAudioAttachment(att) ? 'Transcript' : 'Machine description';
	}

	// Only capture attachments carry extraction_failure_reason in the payload.
	function failureTitle(att: BaseAttachment): string {
		const reason = (att as Partial<CaptureAttachment>).extraction_failure_reason ?? '';
		return displayFailureReason(reason) || 'Text extraction failed';
	}

	let retryingId = $state<number | null>(null);

	async function retryFailed(att: BaseAttachment) {
		if (props.kind !== 'capture') return;
		retryingId = att.id;
		try {
			await retryExtraction(props.captureId, att.id);
			// Optimistically flip back to pending so the hint shows immediately.
			qc.setQueryData(queryKey, (old: BaseAttachment[] | undefined) =>
				old?.map((a) =>
					a.id === att.id
						? { ...a, extraction_status: 'pending' as const, extraction_failure_reason: '' }
						: a
				)
			);
			status = `Retrying extraction for ${att.filename}`;
		} catch (err) {
			logError('retryExtraction', err);
			// 409 means the status moved on (e.g. already retried elsewhere); refetch either way.
			qc.invalidateQueries({ queryKey });
		} finally {
			retryingId = null;
		}
	}

	function descKey(attachmentId: number) {
		return props.kind === 'capture'
			? attachmentKeys.captureDescription(props.captureId, attachmentId)
			: attachmentKeys.workingDescription(props.slug, attachmentId);
	}

	const descQuery = createQuery<AttachmentDescription>(() => ({
		queryKey: descKey(descOpenId ?? -1),
		queryFn: () =>
			props.kind === 'capture'
				? fetchAttachmentDescription(props.captureId, descOpenId!)
				: fetchWorkingAttachmentDescription(props.slug, descOpenId!),
		enabled: browser && descOpenId !== null,
		retry: false
	}));

	// A 404 typically means extraction marked the attachment dark but the
	// description has not been generated yet (it can also mean the attachment
	// was deleted concurrently) — expected state, not an error.
	const descMissing = $derived(
		descQuery.isError && descQuery.error instanceof ApiError && descQuery.error.status === 404
	);

	$effect(() => {
		// Seed the editor once per opened attachment; don't clobber in-progress edits.
		const data = descQuery.data;
		if (data && descOpenId !== null && draftFor !== descOpenId) {
			draft = data.final_text;
			draftFor = descOpenId;
		}
	});

	function toggleDescription(attachmentId: number) {
		if (descOpenId === attachmentId) {
			descOpenId = null;
		} else {
			descOpenId = attachmentId;
		}
		draftFor = null;
		saveError = '';
	}

	async function saveDescription(att: BaseAttachment) {
		const current = descQuery.data;
		if (!current || descOpenId === null) return;
		const patch: DescriptionPatch = {};
		if (draft !== current.final_text) patch.final_text = draft;
		// A user edit (or explicit save) confirms the description so automated
		// re-description passes never overwrite it (017 semantics).
		if (!current.confirmed) patch.confirmed = true;
		if (Object.keys(patch).length === 0) return;
		saving = true;
		saveError = '';
		try {
			const updated =
				props.kind === 'capture'
					? await updateAttachmentDescription(props.captureId, att.id, patch)
					: await updateWorkingAttachmentDescription(props.slug, att.id, patch);
			qc.setQueryData(descKey(att.id), updated);
			status = `Saved ${descLabel(att).toLowerCase()} for ${att.filename}`;
		} catch (err) {
			logError('saveAttachmentDescription', err);
			// Spine's 409/400 bodies are actionable ("Attachment is not dark" after a
			// re-extraction race) — surface them instead of a generic failure.
			saveError = serverErrorMessage(err) ?? 'Failed to save description.';
		} finally {
			saving = false;
		}
	}

	function serverErrorMessage(err: unknown): string | null {
		if (!(err instanceof ApiError) || (err.status !== 400 && err.status !== 409)) return null;
		try {
			const parsed = JSON.parse(err.body) as { error?: unknown };
			return typeof parsed.error === 'string' ? parsed.error : null;
		} catch {
			return null;
		}
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
						<div class="att-item-wrap">
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
								{#if att.extraction_status === 'pending' || att.extraction_status === 'processing'}
									<span class="att-extract att-extract--pending" title="Text extraction in progress"
										>{isAudioAttachment(att) ? 'transcribing…' : 'extracting…'}</span
									>
								{:else if att.extraction_status === 'failed'}
									<span class="att-extract att-extract--failed" title={failureTitle(att)}
										>failed</span
									>
									{#if props.kind === 'capture'}
										<button
											class="btn btn-ghost btn-mini"
											disabled={retryingId === att.id}
											onclick={() => retryFailed(att)}
											aria-label="Retry extraction for {att.filename}"
										>
											{retryingId === att.id ? 'retrying…' : 'retry'}
										</button>
									{/if}
								{/if}
								<span class="att-size faint">{formatBytes(att.size_bytes)}</span>
								{#if hasDescription(att)}
									<button
										class="btn btn-ghost att-desc-toggle"
										class:att-desc-toggle--open={descOpenId === att.id}
										onclick={() => toggleDescription(att.id)}
										aria-expanded={descOpenId === att.id}
										aria-label="Toggle {descLabel(att).toLowerCase()} for {att.filename}"
										title={descLabel(att)}
									>
										<Icon name="sparkle" size={12} />
									</button>
								{/if}
								<button
									class="btn btn-ghost att-del"
									onclick={() => remove(att.id, att.filename)}
									disabled={deletingId !== null}
									aria-label="Delete {att.filename}"
								>
									{deletingId === att.id ? '…' : '×'}
								</button>
							</div>
							{#if descOpenId === att.id}
								<div class="att-desc">
									{#if descQuery.isLoading}
										<p class="att-message" role="status">Loading {descLabel(att).toLowerCase()}…</p>
									{:else if descMissing}
										<p class="att-message" role="status">
											No {descLabel(att).toLowerCase()} yet; it will appear once generated.
										</p>
									{:else if descQuery.isError}
										<p class="att-message att-message--error" role="alert">
											Failed to load {descLabel(att).toLowerCase()}.
										</p>
									{:else if descQuery.data}
										<textarea
											class="att-desc-text mono"
											rows="5"
											bind:value={draft}
											aria-label="{descLabel(att)} for {att.filename}"
										></textarea>
										<div class="att-desc-actions">
											{#if descQuery.data.confirmed}
												<span class="att-confirmed" title="Confirmed — re-runs will not overwrite">
													<Icon name="check" size={11} />confirmed
												</span>
											{/if}
											<button
												class="btn btn-ghost btn-mini"
												onclick={() => saveDescription(att)}
												disabled={saving ||
													draft.trim().length === 0 ||
													(draft === descQuery.data.final_text && descQuery.data.confirmed)}
											>
												{saving
													? 'Saving…'
													: descQuery.data.confirmed
														? 'Save'
														: draft === descQuery.data.final_text
															? 'Confirm'
															: 'Save & confirm'}
											</button>
										</div>
										{#if saveError}
											<p class="att-message att-message--error" role="alert">{saveError}</p>
										{/if}
									{/if}
								</div>
							{/if}
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
	.att-item-wrap {
		display: flex;
		flex-direction: column;
	}
	.att-item {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 12px;
	}
	.att-extract {
		font-size: 10px;
		white-space: nowrap;
		border-radius: 3px;
		padding: 0 4px;
		flex-shrink: 0;
	}
	.att-extract--pending {
		color: var(--text-mute);
		background: var(--bg-high);
	}
	.att-extract--failed {
		color: var(--c-alarm);
		background: color-mix(in oklch, var(--c-alarm) 12%, transparent);
	}
	.att-desc-toggle {
		padding: 1px 3px;
		opacity: 0.5;
		flex-shrink: 0;
	}
	.att-desc-toggle:hover,
	.att-desc-toggle--open {
		opacity: 1;
	}
	.att-desc {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin: 2px 0 6px;
		padding: 6px;
		border: 1px solid var(--line);
		border-radius: 4px;
		background: var(--bg);
	}
	.att-desc .att-message {
		padding: 0;
	}
	.att-desc-text {
		width: 100%;
		resize: vertical;
		font-size: 11px;
		line-height: 1.4;
		color: var(--text);
		background: var(--bg-raised);
		border: 1px solid var(--line);
		border-radius: 3px;
		padding: 4px 6px;
	}
	.att-desc-actions {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 6px;
	}
	.att-confirmed {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		font-size: 10px;
		color: var(--c-ok);
		margin-right: auto;
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
