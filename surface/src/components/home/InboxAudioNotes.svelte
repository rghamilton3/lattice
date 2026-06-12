<script lang="ts">
	import { createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { browser } from '$app/environment';
	import {
		attachmentKeys,
		fetchAttachments,
		fetchAttachmentDescription,
		updateAttachmentDescription,
		retryExtraction,
		isAudioAttachment,
		displayFailureReason
	} from '$lib/api/attachments';
	import { ApiError } from '$lib/api/client';
	import type { AttachmentDescription, CaptureAttachment } from '$lib/types';
	import { logError } from '$lib/utils/logError';

	const { captureId }: { captureId: number } = $props();

	const qc = useQueryClient();

	const query = createQuery<CaptureAttachment[]>(() => ({
		queryKey: attachmentKeys.captureList(captureId),
		queryFn: () => fetchAttachments(captureId),
		enabled: browser
	}));
	const audioAttachments = $derived((query.data ?? []).filter(isAudioAttachment));

	let openId = $state<number | null>(null);
	let editing = $state(false);
	let draft = $state('');
	let saving = $state(false);
	let saveError = $state('');
	let retryingId = $state<number | null>(null);

	// The attachment list payload has no extracted_text, so the transcript
	// (description head row) is fetched lazily when expanded, mirroring the
	// image-description pattern in AttachmentRail.
	const descQuery = createQuery<AttachmentDescription>(() => ({
		queryKey: attachmentKeys.captureDescription(captureId, openId ?? -1),
		queryFn: () => fetchAttachmentDescription(captureId, openId!),
		enabled: browser && openId !== null,
		retry: false
	}));

	function toggle(attId: number) {
		openId = openId === attId ? null : attId;
		editing = false;
		saveError = '';
	}

	function startEdit() {
		if (!descQuery.data) return;
		draft = descQuery.data.final_text;
		editing = true;
		saveError = '';
	}

	async function save(attId: number) {
		if (draft.trim().length === 0) return;
		saving = true;
		saveError = '';
		try {
			// A user edit confirms the transcript so regeneration never
			// overwrites it (020 RH-4).
			const updated = await updateAttachmentDescription(captureId, attId, {
				final_text: draft,
				confirmed: true
			});
			qc.setQueryData(attachmentKeys.captureDescription(captureId, attId), updated);
			editing = false;
		} catch (err) {
			logError('saveTranscript', err);
			saveError =
				err instanceof ApiError && err.status === 409
					? 'Transcript changed elsewhere. Reopen to reload it.'
					: 'Failed to save transcript.';
		} finally {
			saving = false;
		}
	}

	async function retry(attId: number) {
		retryingId = attId;
		try {
			await retryExtraction(captureId, attId);
			// Optimistically flip back to pending so the hint shows immediately.
			qc.setQueryData(
				attachmentKeys.captureList(captureId),
				(old: CaptureAttachment[] | undefined) =>
					old?.map((a) =>
						a.id === attId
							? { ...a, extraction_status: 'pending' as const, extraction_failure_reason: '' }
							: a
					)
			);
		} catch (err) {
			logError('retryExtraction', err);
			// 409 means the status moved on (e.g. already retried elsewhere); refetch either way.
			qc.invalidateQueries({ queryKey: attachmentKeys.captureList(captureId) });
		} finally {
			retryingId = null;
		}
	}
</script>

{#if audioAttachments.length > 0}
	<!-- Lives inside a clickable inbox row; keep clicks and keys from opening the capture. -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="audio-notes"
		onclick={(e) => e.stopPropagation()}
		onkeydown={(e) => e.stopPropagation()}
	>
		{#each audioAttachments as att (att.id)}
			<div class="audio-note">
				<div class="audio-note-line">
					<span class="audio-note-name mono" title={att.filename}>{att.filename}</span>
					{#if att.extraction_status === 'pending' || att.extraction_status === 'processing'}
						<span class="audio-note-hint">Transcribing…</span>
					{:else if att.extraction_status === 'failed'}
						<span class="audio-note-hint">
							{displayFailureReason(att.extraction_failure_reason) || 'Transcription failed'}
						</span>
						<button
							class="btn btn-ghost btn-mini"
							disabled={retryingId === att.id}
							onclick={() => retry(att.id)}
						>
							{retryingId === att.id ? 'Retrying…' : 'Retry'}
						</button>
					{:else if att.extraction_status === 'done'}
						<button
							class="btn btn-ghost btn-mini"
							aria-expanded={openId === att.id}
							onclick={() => toggle(att.id)}
						>
							Transcript
						</button>
					{/if}
				</div>
				{#if openId === att.id}
					<div class="audio-note-body">
						{#if descQuery.isLoading}
							<p class="audio-note-hint" role="status">Loading transcript…</p>
						{:else if descQuery.isError}
							<p class="audio-note-hint" role="status">No transcript available yet.</p>
						{:else if descQuery.data}
							{#if editing}
								<textarea
									class="inbox-edit-textarea"
									rows="4"
									bind:value={draft}
									aria-label="Transcript for {att.filename}"
									onkeydown={(e) => {
										if (e.key === 'Escape') editing = false;
										if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save(att.id);
									}}
								></textarea>
								<div class="inbox-edit-actions">
									{#if saveError}
										<span class="audio-note-hint" role="alert">{saveError}</span>
									{/if}
									<button
										class="btn btn-ghost btn-mini"
										disabled={saving}
										onclick={() => (editing = false)}
									>
										cancel
									</button>
									<button
										class="btn btn-primary btn-mini"
										disabled={saving || draft.trim().length === 0}
										onclick={() => save(att.id)}
									>
										{saving ? 'saving…' : 'save'}
									</button>
								</div>
							{:else}
								<p class="audio-note-text">{descQuery.data.final_text}</p>
								<div class="inbox-edit-actions">
									{#if descQuery.data.confirmed}
										<span class="audio-note-confirmed" title="Edited and confirmed by you">
											edited
										</span>
									{/if}
									<button class="btn btn-ghost btn-mini" onclick={startEdit}>edit</button>
								</div>
							{/if}
						{/if}
					</div>
				{/if}
			</div>
		{/each}
	</div>
{/if}

<style>
	.audio-notes {
		display: flex;
		flex-direction: column;
		gap: 2px;
		cursor: default;
	}
	.audio-note-line {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 22px;
		font-size: 12px;
		color: var(--text-mute);
	}
	.audio-note-name {
		max-width: 180px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.audio-note-hint {
		font-size: 12px;
		color: var(--text-faint);
	}
	.audio-note-body {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin: 2px 0 4px;
	}
	.audio-note-text {
		margin: 0;
		font-size: 13px;
		line-height: 1.5;
		color: var(--text-mute);
		white-space: pre-wrap;
	}
	.audio-note-confirmed {
		font-size: 11px;
		color: var(--text-faint);
		margin-right: auto;
	}
</style>
