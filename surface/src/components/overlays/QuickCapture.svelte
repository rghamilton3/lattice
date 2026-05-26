<script lang="ts">
	import { onDestroy } from 'svelte';
	import { useQueryClient } from '@tanstack/svelte-query';
	import { getWorkbenchContext } from '$lib/state/workbench.svelte';
	import { createCapture, MAX_CAPTURE_TEXT_LENGTH } from '$lib/api/captures';
	import { uploadAttachment, attachmentKeys } from '$lib/api/attachments';
	import { taskKeys } from '$lib/api/tasks';
	import { logError } from '$lib/utils/logError';
	import Icon from '$components/icons/Icon.svelte';

	const wb = getWorkbenchContext();
	const queryClient = useQueryClient();

	let textarea = $state<HTMLTextAreaElement | null>(null);
	let modal = $state<HTMLDivElement | null>(null);
	let text = $state('');
	let voice = $state(false);
	let confirmed = $state(false);
	let failed = $state(false);
	let submitting = $state(false);
	let attachedFile = $state<File | null>(null);
	let previewUrl = $state<string | null>(null);
	let dragDepth = $state(0);

	const overTextLimit = $derived(text.length > MAX_CAPTURE_TEXT_LENGTH);
	const canSave = $derived(
		(text.trim().length >= 1 || attachedFile !== null) && !overTextLimit && !submitting
	);
	const dragOver = $derived(dragDepth > 0);

	$effect(() => {
		textarea?.focus();
	});

	onDestroy(() => {
		if (previewUrl) URL.revokeObjectURL(previewUrl);
	});

	function close() {
		wb.activeOverlay = 'none';
	}

	function toastForAction(action: string | null): string {
		if (action === 'task') return 'Task created — see Tasks view';
		if (action === 'keep') return 'Noted — kept';
		if (action === 'skip') return 'Skipped';
		return 'Captured — inbox updated';
	}

	function extFromMime(mime: string): string {
		const map: Record<string, string> = {
			'image/png': 'png',
			'image/jpeg': 'jpg',
			'image/gif': 'gif',
			'image/webp': 'webp',
			'image/svg+xml': 'svg',
			'image/avif': 'avif'
		};
		return map[mime] ?? mime.split('/')[1] ?? 'bin';
	}

	function setFile(file: File) {
		if (file.size > 20 * 1024 * 1024) {
			wb.showToast('File too large — 20 MB max');
			return;
		}
		if (previewUrl) URL.revokeObjectURL(previewUrl);
		attachedFile = file;
		previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
	}

	function clearFile() {
		if (previewUrl) URL.revokeObjectURL(previewUrl);
		attachedFile = null;
		previewUrl = null;
	}

	function onPaste(e: ClipboardEvent) {
		const item = Array.from(e.clipboardData?.items ?? []).find(
			(i) => i.kind === 'file' && i.type.startsWith('image/')
		);
		if (!item) return;
		e.preventDefault();
		const blob = item.getAsFile();
		if (!blob) return;
		const ext = extFromMime(blob.type);
		setFile(new File([blob], `pasted-${Date.now()}.${ext}`, { type: blob.type }));
	}

	function onDragEnter(e: DragEvent) {
		if (!e.dataTransfer?.types.includes('Files')) return;
		dragDepth++;
	}

	function onDragOver(e: DragEvent) {
		if (!e.dataTransfer?.types.includes('Files')) return;
		e.preventDefault();
		e.dataTransfer.dropEffect = 'copy';
	}

	function onDragLeave() {
		dragDepth = Math.max(0, dragDepth - 1);
	}

	function onDrop(e: DragEvent) {
		e.preventDefault();
		dragDepth = 0;
		const file = e.dataTransfer?.files[0];
		if (!file) return;
		setFile(file);
	}

	async function submit() {
		if (!canSave) {
			return;
		}
		const captureText = text.trim() || (attachedFile ? `(attached: ${attachedFile.name})` : '');
		if (!captureText) {
			close();
			return;
		}
		const payload = { text: captureText, source: voice ? 'voice' : 'desktop-hotkey' };
		failed = false;
		submitting = true;
		let result: Awaited<ReturnType<typeof createCapture>>;
		try {
			result = await createCapture(payload);
		} catch (err) {
			logError('createCapture', err);
			failed = true;
			submitting = false;
			wb.showToast('Save failed — capture not stored');
			return;
		}
		confirmed = true;
		submitting = false;
		if (attachedFile) {
			try {
				await uploadAttachment(result.id, attachedFile);
				queryClient.invalidateQueries({ queryKey: attachmentKeys.captureList(result.id) });
			} catch (err) {
				logError('uploadAttachment', err);
				wb.showToast('Captured — attachment upload failed');
				queryClient.invalidateQueries({ queryKey: ['captures', 'list'] });
				setTimeout(close, 650);
				return;
			}
		}
		queryClient.invalidateQueries({ queryKey: ['captures', 'list'] });
		if (result.triage_action === 'task') {
			queryClient.invalidateQueries({ queryKey: taskKeys.list() });
		}
		wb.showToast(toastForAction(result.triage_action));
		setTimeout(close, 650);
	}

	function onTextareaKey(e: KeyboardEvent) {
		if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
			e.preventDefault();
			submit();
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
		class:qcap-drag-over={dragOver}
		role="dialog"
		aria-modal="true"
		aria-label="Quick capture"
		tabindex="-1"
		onclick={(e) => e.stopPropagation()}
		onkeydown={trapTab}
		onpaste={onPaste}
		ondragenter={onDragEnter}
		ondragover={onDragOver}
		ondragleave={onDragLeave}
		ondrop={onDrop}
	>
		<div class="qcap-head">
			<div class="row" style="gap:8px; flex-wrap:wrap">
				<Icon name="inbox" size={14} />
				<span class="faint" style="font-size:12px">
					Capture · lands in your inbox · no fields required
				</span>
			</div>
			<button class="btn btn-ghost" onclick={close} aria-label="Close">
				<Icon name="x" size={14} />
			</button>
		</div>
		{#if attachedFile}
			<div class="qcap-attachment">
				{#if previewUrl}
					<img class="qcap-preview-img" src={previewUrl} alt="Attached" />
				{:else}
					<Icon name="doc" size={16} />
					<span class="mono" style="font-size:13px">{attachedFile.name}</span>
				{/if}
				<button
					class="btn btn-ghost qcap-clear-att"
					onclick={clearFile}
					aria-label="Remove attachment"
				>
					<Icon name="x" size={12} />
				</button>
			</div>
		{/if}
		<textarea
			bind:this={textarea}
			bind:value={text}
			class="qcap-area"
			placeholder="What's the thought? (Ctrl + Enter to save, Esc to dismiss)"
			aria-describedby="qcap-status"
			aria-invalid={overTextLimit}
			onkeydown={onTextareaKey}
		></textarea>
		<div class="qcap-foot">
			<div class="row" style="gap:4px">
				<button
					class="btn btn-ghost"
					class:is-on={voice}
					aria-pressed={voice}
					title={voice ? 'Stop recording' : 'Voice input'}
					onclick={() => (voice = !voice)}
				>
					<Icon name="mic" size={13} />
				</button>
				<button
					class="btn btn-ghost"
					title="Attach file"
					onclick={() => {
						wb.fileUploadInitialNote = text.trim();
						wb.activeOverlay = 'fileUpload';
					}}
				>
					<Icon name="paperclip" size={13} />
				</button>
				<span
					id="qcap-status"
					class="faint"
					style="font-size:12px; margin-left:6px"
					style:color={failed || overTextLimit ? 'var(--c-alarm)' : undefined}
				>
					{#if overTextLimit}
						{text.length}/{MAX_CAPTURE_TEXT_LENGTH} chars — shorten before saving
					{:else if failed}
						Save failed — try again
					{:else if confirmed}
						Captured — inbox updated
					{:else if attachedFile && !text.trim()}
						{attachedFile.name} · paste or drag to replace
					{:else if !text.trim()}
						Add text or an attachment to save
					{:else}
						{text.length}/{MAX_CAPTURE_TEXT_LENGTH} chars · /task, /note, /skip
					{/if}
				</span>
			</div>
			<div class="row" style="gap:8px">
				<button class="btn btn-ghost" onclick={close}>Cancel</button>
				<button class="btn btn-primary" onclick={submit} disabled={!canSave}>
					<Icon name="check" size={13} />
					Save
				</button>
			</div>
		</div>
	</div>
</div>

<style>
	.qcap-drag-over {
		outline: 2px dashed var(--c-accent, var(--text-link));
		outline-offset: -2px;
	}
	.qcap-attachment {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 12px;
		background: var(--bg-raised);
		border-bottom: 1px solid var(--line);
		position: relative;
	}
	.qcap-preview-img {
		max-height: 160px;
		max-width: 100%;
		object-fit: contain;
		border-radius: 4px;
		display: block;
	}
	.qcap-clear-att {
		position: absolute;
		top: 6px;
		right: 8px;
	}
</style>
