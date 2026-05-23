<script lang="ts">
	import { useQueryClient } from '@tanstack/svelte-query';
	import { getWorkbenchContext } from '$lib/state/workbench.svelte';
	import { createCapture } from '$lib/api/captures';
	import { uploadAttachment, attachmentKeys } from '$lib/api/attachments';
	import { logError } from '$lib/utils/logError';
	import Icon from '$components/icons/Icon.svelte';

	const wb = getWorkbenchContext();
	const queryClient = useQueryClient();

	let fileInput = $state<HTMLInputElement | null>(null);
	let modal = $state<HTMLDivElement | null>(null);
	let note = $state(wb.fileUploadInitialNote);
	let selectedFile = $state<File | null>(null);
	let submitting = $state(false);
	let failed = $state(false);

	const canSave = $derived(selectedFile !== null && !submitting);

	$effect(() => {
		fileInput?.click();
	});

	function close() {
		wb.fileUploadInitialNote = '';
		wb.activeOverlay = 'none';
	}

	function onFileSelected(e: Event) {
		const input = e.target as HTMLInputElement;
		selectedFile = input.files?.[0] ?? null;
	}

	function formatBytes(n: number): string {
		if (n < 1024) return `${n} B`;
		if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
		return `${(n / (1024 * 1024)).toFixed(1)} MB`;
	}

	async function submit() {
		if (!canSave || !selectedFile) return;
		submitting = true;
		failed = false;
		try {
			// Create a capture first (optionally using the note text), then attach the file.
			const captureText = note.trim() || selectedFile.name;
			const created = await createCapture({ text: captureText, source: 'desktop-hotkey' });
			await uploadAttachment(created.id, selectedFile);
			queryClient.invalidateQueries({ queryKey: ['captures', 'list'] });
			queryClient.invalidateQueries({ queryKey: attachmentKeys.captureList(created.id) });
			wb.showToast(`File attached to new capture`);
			setTimeout(close, 500);
		} catch (err) {
			logError('fileUpload', err);
			failed = true;
			submitting = false;
		}
	}

	function trapTab(e: KeyboardEvent) {
		if (e.key !== 'Tab' || !modal) return;
		const focusables = modal.querySelectorAll<HTMLElement>(
			'button:not([disabled]), textarea:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
		);
		if (focusables.length === 0) return;
		const first = focusables[0];
		const last = focusables[focusables.length - 1];
		if (e.shiftKey && document.activeElement === first) {
			e.preventDefault();
			last.focus();
		} else if (!e.shiftKey && document.activeElement === last) {
			e.preventDefault();
			first.focus();
		}
	}
</script>

<div class="overlay" onclick={close} role="presentation">
	<div
		bind:this={modal}
		class="qcap soft-in"
		role="dialog"
		aria-modal="true"
		aria-label="Attach file"
		tabindex="-1"
		onclick={(e) => e.stopPropagation()}
		onkeydown={trapTab}
	>
		<div class="qcap-head">
			<div class="row" style="gap:8px">
				<Icon name="paperclip" size={14} />
				<span class="faint" style="font-size:12px">Attach file - creates a new capture</span>
			</div>
			<button class="btn btn-ghost" onclick={close} aria-label="Close">
				<Icon name="x" size={14} />
			</button>
		</div>

		<input
			bind:this={fileInput}
			type="file"
			style="display:none"
			onchange={onFileSelected}
			aria-hidden="true"
		/>

		{#if selectedFile}
			<div class="file-preview">
				<Icon name="doc" size={16} />
				<span class="mono" style="font-size:13px">{selectedFile.name}</span>
				<span class="faint" style="font-size:12px">{formatBytes(selectedFile.size)}</span>
				<button
					class="btn btn-ghost"
					onclick={() => {
						selectedFile = null;
						if (fileInput) fileInput.value = '';
					}}
				>
					<Icon name="x" size={12} />
				</button>
			</div>
		{:else}
			<button class="file-drop" onclick={() => fileInput?.click()}>
				<Icon name="paperclip" size={20} />
				<span style="font-size:13px">Click to choose a file</span>
			</button>
		{/if}

		<textarea
			bind:value={note}
			class="qcap-area"
			style="min-height:60px"
			placeholder="Optional note (defaults to filename if blank)"
		></textarea>

		<div class="qcap-foot">
			<span
				class="faint"
				style="font-size:12px"
				style:color={failed ? 'var(--c-alarm)' : undefined}
			>
				{#if failed}
					Upload failed - try again
				{:else if selectedFile}
					Ready to attach
				{:else}
					Choose a file above
				{/if}
			</span>
			<div class="row" style="gap:8px">
				<button class="btn btn-ghost" onclick={close}>Cancel</button>
				<button class="btn btn-primary" onclick={submit} disabled={!canSave}>
					<Icon name="check" size={13} />
					{submitting ? 'Uploading…' : 'Attach'}
				</button>
			</div>
		</div>
	</div>
</div>

<style>
	.file-preview {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 12px;
		background: var(--surface-raised, var(--surface));
		border-bottom: 1px solid var(--border);
	}
	.file-drop {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 24px;
		border: none;
		border-bottom: 1px solid var(--border);
		background: none;
		color: var(--text-mute);
		cursor: pointer;
		width: 100%;
	}
	.file-drop:hover {
		background: var(--surface-raised, var(--surface));
	}
</style>
