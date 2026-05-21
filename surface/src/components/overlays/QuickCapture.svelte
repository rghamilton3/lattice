<script lang="ts">
	import { useQueryClient } from '@tanstack/svelte-query';
	import { getWorkbenchContext } from '$lib/state/workbench.svelte';
	import { createCapture } from '$lib/api/captures';
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

	const canSave = $derived(text.trim().length >= 1 && !submitting);

	$effect(() => {
		textarea?.focus();
	});

	function close() {
		wb.activeOverlay = 'none';
	}

	function submit() {
		if (!canSave) {
			close();
			return;
		}
		const payload = { text: text.trim(), source: voice ? 'voice' : 'desktop-hotkey' };
		confirmed = true;
		failed = false;
		submitting = true;
		createCapture(payload)
			.then(() => {
				queryClient.invalidateQueries({ queryKey: ['captures', 'list'] });
				wb.showToast('Captured — inbox updated');
				setTimeout(close, 650);
			})
			.catch((err) => {
				logError('createCapture', err);
				confirmed = false;
				failed = true;
				wb.showToast('Save failed — capture not stored');
			})
			.finally(() => {
				submitting = false;
			});
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
		role="dialog"
		aria-modal="true"
		aria-label="Quick capture"
		tabindex="-1"
		onclick={(e) => e.stopPropagation()}
		onkeydown={trapTab}
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
		<textarea
			bind:this={textarea}
			bind:value={text}
			class="qcap-area"
			placeholder="What's the thought? (⌘ + Enter to save, Esc to dismiss)"
			onkeydown={onTextareaKey}
		></textarea>
		<div class="qcap-foot">
			<div class="row" style="gap:4px">
				<button
					class="btn btn-ghost"
					class:is-on={voice}
					aria-pressed={voice}
					onclick={() => (voice = !voice)}
				>
					<Icon name="mic" size={13} />
					{voice ? 'Recording' : 'Voice'}
				</button>
				<button class="btn btn-ghost">
					<Icon name="link" size={13} />
					Paste link
				</button>
				<span
					class="faint"
					style="font-size:12px; margin-left:10px"
					style:color={failed ? 'var(--c-alarm)' : undefined}
				>
					{#if failed}
						Save failed — try again
					{:else if confirmed}
						Captured — inbox updated
					{:else}
						{text.length} chars
					{/if}
				</span>
			</div>
			<div class="row" style="gap:8px">
				<span class="faint" style="font-size:12px">save with</span>
				<span class="kbd">⌘</span>
				<span class="kbd">↵</span>
				<button class="btn btn-ghost" onclick={close}>Cancel</button>
				<button class="btn btn-primary" onclick={submit} disabled={!canSave}>
					<Icon name="check" size={13} />
					Save
				</button>
			</div>
		</div>
	</div>
</div>
