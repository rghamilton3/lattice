<script lang="ts">
	import { createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { browser } from '$app/environment';
	import { getWorkbenchContext } from '$lib/state/workbench.svelte';
	import { captureKeys, fetchCapture } from '$lib/api/captures';
	import { fileKeys, fetchFile } from '$lib/api/files';
	import { workingKeys, fetchWorking, createWorking } from '$lib/api/working';
	import { getPendingSelection } from '$lib/utils/selection';
	import type { DocRef } from '$lib/types';
	import Icon from '$components/icons/Icon.svelte';
	import MarkdownRenderer from './MarkdownRenderer.svelte';
	import PdfViewer from './PdfViewer.svelte';
	import RelatedRail from './RelatedRail.svelte';
	import AttachmentRail from './AttachmentRail.svelte';
	import { uploadAttachment, uploadWorkingAttachment, attachmentKeys } from '$lib/api/attachments';
	import { logError } from '$lib/utils/logError';

	const { paneIndex, ref }: { paneIndex: 0 | 1; ref: DocRef } = $props();

	const wb = getWorkbenchContext();
	const qc = useQueryClient();

	let promoteError = $state('');
	let attachFileInput = $state<HTMLInputElement | null>(null);
	let attachUploading = $state(false);
	let renderError = $state<{ content: string | undefined; message: string } | null>(null);

	async function onAttachFile(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		input.value = '';
		attachUploading = true;
		try {
			if (ref.kind === 'capture') {
				await uploadAttachment(ref.id, file);
				qc.invalidateQueries({ queryKey: attachmentKeys.captureList(ref.id) });
			} else if (ref.kind === 'working') {
				await uploadWorkingAttachment(ref.slug, file);
				qc.invalidateQueries({ queryKey: attachmentKeys.workingList(ref.slug) });
			}
		} catch (err) {
			logError('attachFile', err);
			wb.showToast('Upload failed');
		} finally {
			attachUploading = false;
		}
	}

	const captureQuery = createQuery(() => ({
		queryKey: captureKeys.detail(ref.kind === 'capture' ? ref.id : -1),
		queryFn: () => fetchCapture((ref as { id: number }).id),
		enabled: browser && ref.kind === 'capture'
	}));

	const fileQuery = createQuery(() => ({
		queryKey: fileKeys.detail(ref.kind === 'file' ? ref.id : -1),
		queryFn: () => fetchFile((ref as { id: number }).id),
		enabled: browser && ref.kind === 'file'
	}));

	const workingQuery = createQuery(() => ({
		queryKey: workingKeys.detail(ref.kind === 'working' ? ref.slug : ''),
		queryFn: () => fetchWorking((ref as { slug: string }).slug),
		enabled: browser && ref.kind === 'working'
	}));

	const isLoading = $derived(
		captureQuery.isLoading || fileQuery.isLoading || workingQuery.isLoading
	);
	const isError = $derived(captureQuery.isError || fileQuery.isError || workingQuery.isError);

	// Derive the timestamp for "around this in time"
	const timestamp = $derived(captureQuery.data?.captured_at ?? fileQuery.data?.modified_at ?? null);

	// Derive id/slug/kind for lateral queries
	const lateralRef = $derived<{
		id: number | string;
		docKind: 'capture' | 'local-file' | 'working';
	}>(
		ref.kind === 'capture'
			? { id: ref.id, docKind: 'capture' }
			: ref.kind === 'file'
				? { id: ref.id, docKind: 'local-file' }
				: { id: ref.slug, docKind: 'working' }
	);

	const chipClass = $derived(
		ref.kind === 'capture' ? 'chip-capture' : ref.kind === 'file' ? 'chip-file' : 'chip-working'
	);
	const chipLabel = $derived(
		ref.kind === 'capture' ? 'capture' : ref.kind === 'file' ? 'local file' : 'working'
	);
	const filename = $derived(
		ref.kind === 'capture'
			? `capture #${ref.id}`
			: ref.kind === 'file'
				? (fileQuery.data?.path ?? '')
				: `${ref.slug}.md`
	);
	const renderedContent = $derived(
		ref.kind === 'capture'
			? captureQuery.data?.text
			: ref.kind === 'file'
				? fileQuery.data?.text
				: workingQuery.data?.content
	);
	const renderErrorMessage = $derived(
		renderError && renderError.content === renderedContent ? renderError.message : ''
	);

	function openMoreLikeThis() {
		wb.openInOther(paneIndex, {
			kind: 'results',
			source: { kind: 'similar', id: lateralRef.id, docKind: lateralRef.docKind }
		});
	}

	function openMentions() {
		const sel = getPendingSelection();
		if (!sel) return;
		wb.openInOther(paneIndex, {
			kind: 'results',
			source: { kind: 'mentions', q: sel }
		});
	}

	function openNearby() {
		if (!timestamp) return;
		wb.openInOther(paneIndex, {
			kind: 'results',
			source: { kind: 'nearby', timestamp, window_hours: 72 }
		});
	}

	async function promoteToWorking() {
		promoteError = '';
		const body: Parameters<typeof createWorking>[0] = {
			title:
				ref.kind === 'capture'
					? `from capture #${(ref as { id: number }).id}`
					: ref.kind === 'file'
						? (fileQuery.data?.path.split('/').pop() ?? 'untitled')
						: ref.slug
		};
		if (ref.kind === 'capture') body.seed_capture_id = (ref as { id: number }).id;
		if (ref.kind === 'file') body.seed_file_id = (ref as { id: number }).id;
		try {
			const result = await createWorking(body);
			qc.invalidateQueries({ queryKey: ['working', 'list'] });
			wb.openInPane(paneIndex, { kind: 'editor', slug: result.slug });
		} catch (e) {
			promoteError = e instanceof Error ? e.message : 'promote failed';
		}
	}

	function splitDoc() {
		wb.openInOther(paneIndex, { kind: 'doc', ref });
	}

	function onRenderError(error: unknown) {
		renderError = {
			content: renderedContent,
			message: error instanceof Error ? error.message : 'Preview render failed'
		};
	}
</script>

<div class="doc-view">
	<div class="doc-toolbar">
		<div class="row" style="gap:4px; min-width:0">
			<button
				class="btn btn-ghost"
				title="Back to library"
				onclick={() => wb.openInPane(paneIndex, { kind: 'library', query: '' })}
			>
				<Icon name="arrow-right" size={14} class="rotate-180" /> Back
			</button>
			<span class="faint" style="font-size:12px">·</span>
			<span class="chip {chipClass}">{chipLabel}</span>
			<span class="mono soft truncate" style="font-size:13px">{filename}</span>
		</div>
		<div class="row" style="gap:2px">
			<button
				class="btn btn-ghost"
				title="Semantic neighbors — opens in the other pane"
				onclick={openMoreLikeThis}
			>
				<Icon name="sim" size={14} /> Similar
			</button>
			<button
				class="btn btn-ghost"
				title="Search for selected text across all corpora"
				onclick={openMentions}
			>
				<Icon name="quote" size={14} /> Mentions
			</button>
			{#if timestamp}
				<button class="btn btn-ghost" title="Items from ±72h around this doc" onclick={openNearby}>
					<Icon name="clock" size={14} /> Nearby
				</button>
			{/if}
			<span class="vbar"></span>
			{#if ref.kind === 'capture' || ref.kind === 'working'}
				<button
					class="btn btn-ghost"
					title="Attach a file to this document"
					aria-label="Attach a file to this {chipLabel}"
					disabled={attachUploading}
					onclick={() => attachFileInput?.click()}
				>
					<Icon name="paperclip" size={14} />
					{attachUploading ? 'Uploading…' : 'Attach'}
				</button>
			{/if}
			{#if ref.kind === 'working'}
				<button
					class="btn btn-ghost"
					title="Edit this doc"
					onclick={() => wb.openInPane(paneIndex, { kind: 'editor', slug: ref.slug })}
				>
					<Icon name="edit" size={14} /> Edit
				</button>
			{:else}
				<button class="btn btn-ghost" title="Promote to working doc" onclick={promoteToWorking}>
					<Icon name="promote" size={14} /> Promote
				</button>
			{/if}
			<button class="btn btn-ghost" title="Open in the other pane" onclick={splitDoc}>
				<Icon name="split" size={14} /> Split
			</button>
		</div>
	</div>

	{#if attachUploading}
		<div class="px-3 py-1 text-xs" role="status" aria-live="polite" style="color:var(--text-mute)">
			Uploading attachment…
		</div>
	{/if}

	<input
		bind:this={attachFileInput}
		type="file"
		style="display:none"
		onchange={onAttachFile}
		aria-hidden="true"
	/>

	{#if promoteError}
		<div class="px-3 py-1 text-xs" style="color:var(--c-alarm)">{promoteError}</div>
	{/if}
	{#if renderErrorMessage}
		<div
			class="px-3 py-1 text-xs"
			style="color:var(--c-alarm)"
			role="alert"
			title={renderErrorMessage}
		>
			Preview render failed. The source remains available to edit and save.
		</div>
	{/if}

	<div class="doc-content">
		<div class="doc-body">
			{#if isLoading}
				<p class="p-3 text-sm" style="color:var(--text-mute)">loading…</p>
			{:else if isError}
				<p class="p-3 text-xs" style="color:var(--c-alarm)">
					{captureQuery.error?.message ??
						fileQuery.error?.message ??
						workingQuery.error?.message ??
						'error loading document'}
				</p>
			{:else if ref.kind === 'capture' && captureQuery.data}
				<MarkdownRenderer content={captureQuery.data.text} {onRenderError} />
			{:else if ref.kind === 'file' && fileQuery.data}
				{#if fileQuery.data.mime_type === 'application/pdf'}
					<PdfViewer fileId={ref.id} />
				{:else}
					<MarkdownRenderer content={fileQuery.data.text} {onRenderError} />
				{/if}
			{:else if ref.kind === 'working' && workingQuery.data}
				<MarkdownRenderer content={workingQuery.data.content} {onRenderError} />
			{/if}
		</div>
		{#if ref.kind === 'capture'}
			<AttachmentRail kind="capture" captureId={ref.id} />
		{:else if ref.kind === 'working'}
			<AttachmentRail kind="working" slug={ref.slug} />
		{/if}
	</div>

	<RelatedRail {paneIndex} {lateralRef} />
</div>
