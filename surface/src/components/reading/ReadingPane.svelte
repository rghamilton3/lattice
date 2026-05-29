<script lang="ts">
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { browser } from '$app/environment';
	import { getWorkbenchContext } from '$lib/state/workbench.svelte';
	import { captureKeys, fetchCapture } from '$lib/api/captures';
	import { fileKeys, fetchFile } from '$lib/api/files';
	import { workingKeys, fetchWorking, createWorking } from '$lib/api/working';
	import { archiveKeys, fetchArchive } from '$lib/api/archives';
	import {
		annotationKeys,
		createAnnotation,
		deleteAnnotation,
		fetchAnnotations
	} from '$lib/api/annotations';
	import { getPendingSelection, getReadingSelection } from '$lib/utils/selection';
	import type { AnnotationTargetKind, DocRef } from '$lib/types';
	import Icon from '$components/icons/Icon.svelte';
	import MarkdownRenderer from './MarkdownRenderer.svelte';
	import PdfViewer from './PdfViewer.svelte';
	import RelatedRail from './RelatedRail.svelte';
	import AttachmentRail from './AttachmentRail.svelte';
	import { uploadAttachment, uploadWorkingAttachment, attachmentKeys } from '$lib/api/attachments';
	import { logError } from '$lib/utils/logError';

	const {
		paneIndex,
		ref,
		revealAnnotationId
	}: { paneIndex: 0 | 1; ref: DocRef; revealAnnotationId?: string } = $props();

	const wb = getWorkbenchContext();
	const qc = useQueryClient();

	let promoteError = $state('');
	let annotationError = $state('');
	let annotationDraft = $state('');
	let pendingSelection = $state<{
		text: string;
		start: number | null;
		end: number | null;
	} | null>(null);
	let readingBody: HTMLDivElement | null = $state(null);
	let attachFileInput = $state<HTMLInputElement | null>(null);
	let attachUploading = $state(false);

	const annotationTarget = $derived<{
		kind: AnnotationTargetKind;
		id: string;
	} | null>(
		ref.kind === 'capture'
			? { kind: 'capture', id: String(ref.id) }
			: ref.kind === 'file'
				? { kind: 'local_file', id: String(ref.id) }
				: ref.kind === 'working'
					? { kind: 'working', id: ref.slug }
					: ref.kind === 'archive'
						? { kind: 'archive', id: String(ref.id) }
						: null
	);

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

	const archiveQuery = createQuery(() => ({
		queryKey: archiveKeys.detail(ref.kind === 'archive' ? ref.id : -1),
		queryFn: () => fetchArchive((ref as { id: number }).id),
		enabled: browser && ref.kind === 'archive'
	}));

	const annotationsQuery = createQuery(() => ({
		queryKey: annotationKeys.list(annotationTarget?.kind ?? null, annotationTarget?.id ?? null),
		queryFn: () => fetchAnnotations(annotationTarget!.kind, annotationTarget!.id),
		enabled: browser && annotationTarget !== null
	}));

	const createAnnotationMutation = createMutation(() => ({
		mutationFn: createAnnotation,
		onSuccess: () => {
			annotationDraft = '';
			pendingSelection = null;
			annotationError = '';
			if (annotationTarget) {
				qc.invalidateQueries({
					queryKey: annotationKeys.list(annotationTarget.kind, annotationTarget.id)
				});
			}
		},
		onError: (err) => {
			annotationError = err instanceof Error ? err.message : 'Could not save annotation';
		}
	}));

	const deleteAnnotationMutation = createMutation(() => ({
		mutationFn: deleteAnnotation,
		onSuccess: () => {
			if (annotationTarget) {
				qc.invalidateQueries({
					queryKey: annotationKeys.list(annotationTarget.kind, annotationTarget.id)
				});
			}
		},
		onError: (err) => {
			annotationError = err instanceof Error ? err.message : 'Could not delete annotation';
		}
	}));

	const isLoading = $derived(
		captureQuery.isLoading ||
			fileQuery.isLoading ||
			workingQuery.isLoading ||
			archiveQuery.isLoading
	);
	const isError = $derived(
		captureQuery.isError || fileQuery.isError || workingQuery.isError || archiveQuery.isError
	);

	// Derive the timestamp for "around this in time"
	const timestamp = $derived(
		captureQuery.data?.captured_at ??
			fileQuery.data?.modified_at ??
			archiveQuery.data?.archived_at ??
			null
	);

	// Derive id/slug/kind for lateral queries
	const lateralRef = $derived<{
		id: number | string;
		docKind: 'capture' | 'local-file' | 'working' | 'archive';
	}>(
		ref.kind === 'capture'
			? { id: ref.id, docKind: 'capture' }
			: ref.kind === 'file'
				? { id: ref.id, docKind: 'local-file' }
				: ref.kind === 'working'
					? { id: ref.slug, docKind: 'working' }
					: { id: ref.id, docKind: 'archive' }
	);

	const chipClass = $derived(
		ref.kind === 'capture'
			? 'chip-capture'
			: ref.kind === 'file' || ref.kind === 'archive'
				? 'chip-file'
				: 'chip-working'
	);
	const chipLabel = $derived(
		ref.kind === 'capture'
			? 'capture'
			: ref.kind === 'file'
				? 'local file'
				: ref.kind === 'archive'
					? 'archive'
					: 'working'
	);
	const filename = $derived(
		ref.kind === 'capture'
			? `capture #${ref.id}`
			: ref.kind === 'file'
				? (fileQuery.data?.path ?? '')
				: ref.kind === 'archive'
					? (archiveQuery.data?.title ?? archiveQuery.data?.url ?? `archive #${ref.id}`)
					: `${ref.slug}.md`
	);
	const annotations = $derived(annotationsQuery.data?.annotations ?? []);

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

	function startAnnotation() {
		annotationError = '';
		const selection = getReadingSelection(readingBody);
		if (!selection) {
			annotationError = 'Select text in this document before adding a note.';
			return;
		}
		pendingSelection = selection;
		annotationDraft = '';
	}

	function saveAnnotation() {
		annotationError = '';
		if (!annotationTarget || !pendingSelection) return;
		const comment = annotationDraft.trim();
		if (!comment) {
			annotationError = 'Write a note before saving.';
			return;
		}
		createAnnotationMutation.mutate({
			target_kind: annotationTarget.kind,
			target_id: annotationTarget.id,
			selection_start: pendingSelection.start,
			selection_end: pendingSelection.end,
			selection_text: pendingSelection.text,
			comment
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
						: 'untitled'
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
		wb.openInOther(paneIndex, { kind: 'doc', ref, revealAnnotationId });
	}
</script>

<div class="doc-view">
	<div class="doc-toolbar">
		<div class="row" style="gap:4px; min-width:0">
			<button
				class="btn btn-ghost"
				title="Add a note to the selected passage"
				onclick={startAnnotation}
			>
				<Icon name="quote" size={14} /> Annotate
			</button>
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
			{:else if ref.kind !== 'archive'}
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
	{#if annotationError}
		<div class="px-3 py-1 text-xs" style="color:var(--c-alarm)" role="alert">{annotationError}</div>
	{/if}
	{#if pendingSelection}
		<section class="annotation-compose" aria-label="New annotation">
			<p><strong>Selected passage:</strong> <mark>{pendingSelection.text}</mark></p>
			<label>
				<span>Note</span>
				<textarea bind:value={annotationDraft} rows="3" placeholder="Add context for this passage"
				></textarea>
			</label>
			<div class="row" style="gap:6px">
				<button class="btn" disabled={createAnnotationMutation.isPending} onclick={saveAnnotation}>
					Save note
				</button>
				<button class="btn btn-ghost" onclick={() => (pendingSelection = null)}>Cancel</button>
			</div>
		</section>
	{/if}

	<div class="doc-content">
		<div class="doc-body" bind:this={readingBody}>
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
				<MarkdownRenderer content={captureQuery.data.text} {annotations} {revealAnnotationId} />
			{:else if ref.kind === 'file' && fileQuery.data}
				{#if fileQuery.data.mime_type === 'application/pdf'}
					<PdfViewer fileId={ref.id} />
				{:else}
					<MarkdownRenderer content={fileQuery.data.text} {annotations} {revealAnnotationId} />
				{/if}
			{:else if ref.kind === 'working' && workingQuery.data}
				<MarkdownRenderer content={workingQuery.data.content} {annotations} {revealAnnotationId} />
			{:else if ref.kind === 'archive' && archiveQuery.data}
				<MarkdownRenderer
					content={archiveQuery.data.extracted_text}
					{annotations}
					{revealAnnotationId}
				/>
			{/if}
		</div>
		{#if annotations.length > 0}
			<aside class="annotation-rail" aria-label="Annotations for this document">
				<h2>Notes</h2>
				{#each annotations as annotation (annotation.id)}
					<article
						class:annotation-revealed={annotation.id === revealAnnotationId}
						aria-label={`Annotation: ${annotation.comment}`}
					>
						{#if annotation.selection_text}
							<p class="annotation-selection"><mark>{annotation.selection_text}</mark></p>
						{/if}
						<p>{annotation.comment}</p>
						<button
							class="btn btn-ghost"
							disabled={deleteAnnotationMutation.isPending}
							aria-label="Delete annotation"
							onclick={() => deleteAnnotationMutation.mutate(annotation.id)}
						>
							Delete
						</button>
					</article>
				{/each}
			</aside>
		{/if}
		{#if ref.kind === 'capture'}
			<AttachmentRail kind="capture" captureId={ref.id} />
		{:else if ref.kind === 'working'}
			<AttachmentRail kind="working" slug={ref.slug} />
		{/if}
	</div>

	<RelatedRail {paneIndex} {lateralRef} />
</div>

<style>
	.annotation-compose,
	.annotation-rail {
		border-top: 1px solid var(--border-subtle);
		padding: 10px 12px;
	}

	.annotation-compose textarea {
		background: var(--color-surface);
		border: 1px solid var(--border-strong);
		border-radius: 8px;
		color: var(--text-main);
		display: block;
		margin-top: 4px;
		padding: 8px;
		width: min(100%, 560px);
	}

	.annotation-rail {
		border-left: 1px solid var(--border-subtle);
		max-width: 280px;
		overflow-y: auto;
	}

	.annotation-rail h2 {
		font-size: 12px;
		font-weight: 700;
		margin: 0 0 8px;
		text-transform: uppercase;
	}

	.annotation-rail article {
		border: 1px solid var(--border-subtle);
		border-radius: 10px;
		margin-bottom: 8px;
		padding: 8px;
	}

	.annotation-revealed {
		border-color: var(--color-accent) !important;
		outline: 2px solid var(--color-accent);
		outline-offset: 2px;
	}

	.annotation-selection {
		font-size: 12px;
		margin-bottom: 6px;
	}

	mark {
		background: color-mix(in srgb, var(--color-accent) 28%, transparent);
		border-bottom: 2px solid var(--color-accent);
		color: inherit;
		padding: 0 2px;
	}
</style>
