<script lang="ts">
	import { useQueryClient } from '@tanstack/svelte-query';
	import { getWorkbenchContext } from '$lib/state/workbench.svelte';
	import { taskKeys, createTask } from '$lib/api/tasks';
	import type { TaskPriority } from '$lib/types';
	import { logError } from '$lib/utils/logError';
	import Icon from '$components/icons/Icon.svelte';

	const wb = getWorkbenchContext();
	const queryClient = useQueryClient();

	let modal = $state<HTMLDivElement | null>(null);
	let textEl = $state<HTMLTextAreaElement | null>(null);

	let text = $state('');
	let dueDate = $state('');
	let priority = $state<TaskPriority | ''>('');
	let notes = $state('');
	let submitting = $state(false);
	let failed = $state(false);

	const canSave = $derived(text.trim().length >= 1 && !submitting);

	$effect(() => {
		textEl?.focus();
	});

	function close() {
		wb.activeOverlay = 'none';
	}

	async function submit() {
		if (!canSave) return;
		submitting = true;
		failed = false;
		try {
			await createTask({
				text: text.trim(),
				due_date: dueDate || undefined,
				priority: (priority as TaskPriority) || undefined,
				notes: notes.trim() || undefined
			});
			queryClient.invalidateQueries({ queryKey: taskKeys.list() });
			wb.showToast('Task created');
			close();
		} catch (err) {
			logError('createTask', err);
			failed = true;
			wb.showToast('Save failed — task not stored');
		} finally {
			submitting = false;
		}
	}

	function trapTab(e: KeyboardEvent) {
		if (e.key !== 'Tab' || !modal) return;
		const focusables = modal.querySelectorAll<HTMLElement>(
			'button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
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
		class="ntask soft-in"
		role="dialog"
		aria-modal="true"
		aria-label="New task"
		tabindex="-1"
		onclick={(e) => e.stopPropagation()}
		onkeydown={trapTab}
	>
		<div class="ntask-head">
			<div class="row" style="gap:8px">
				<Icon name="task" size={14} />
				<span class="faint" style="font-size:12px">New task · due date &amp; priority optional</span
				>
			</div>
			<button class="btn btn-ghost" onclick={close} aria-label="Close">
				<Icon name="x" size={14} />
			</button>
		</div>

		<textarea
			bind:this={textEl}
			bind:value={text}
			class="ntask-area"
			aria-label="Task text"
			placeholder="What needs doing?"
			onkeydown={(e) => {
				if (e.key === 'Escape') close();
				if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit();
			}}
		></textarea>

		<div class="ntask-meta">
			<div class="ntask-meta-row">
				<label class="ntask-label faint" for="ntask-due">Due</label>
				<input
					id="ntask-due"
					type="date"
					class="ntask-input"
					bind:value={dueDate}
					onkeydown={(e) => e.key === 'Escape' && close()}
				/>
			</div>
			<div class="ntask-meta-row">
				<label class="ntask-label faint" for="ntask-priority">Priority</label>
				<select
					id="ntask-priority"
					class="ntask-input ntask-select"
					bind:value={priority}
					onkeydown={(e) => e.key === 'Escape' && close()}
				>
					<option value="">none</option>
					<option value="high">high</option>
					<option value="medium">medium</option>
					<option value="low">low</option>
				</select>
			</div>
			<div class="ntask-meta-row ntask-meta-notes">
				<label class="ntask-label faint" for="ntask-notes">Notes</label>
				<textarea
					id="ntask-notes"
					class="ntask-input ntask-notes"
					bind:value={notes}
					placeholder="optional…"
					rows="2"
					onkeydown={(e) => {
						if (e.key === 'Escape') close();
						if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit();
					}}
				></textarea>
			</div>
		</div>

		<div class="ntask-foot">
			<span
				class="faint"
				style="font-size:12px"
				style:color={failed ? 'var(--c-alarm)' : undefined}
				role={failed || submitting ? 'status' : undefined}
				aria-live="polite"
			>
				{#if submitting}
					Saving task…
				{:else if failed}
					Save failed — try again
				{/if}
			</span>
			<div class="row" style="gap:8px">
				<span class="faint" style="font-size:12px">save with</span>
				<span class="kbd">Ctrl</span>
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

<style>
	.ntask {
		background: var(--bg-raised);
		border: 1px solid var(--line-strong);
		border-radius: var(--radius);
		box-shadow: var(--shadow-pop);
		width: min(520px, calc(100vw - 32px));
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.ntask-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 14px 8px;
		border-bottom: 1px solid var(--line);
	}

	.ntask-area {
		background: none;
		border: none;
		outline: none;
		resize: none;
		padding: 14px 16px;
		font-size: 15px;
		font-family: inherit;
		color: var(--text);
		line-height: 1.5;
		min-height: 80px;
	}

	.ntask-meta {
		border-top: 1px solid var(--line);
		padding: 10px 16px;
		display: flex;
		flex-direction: column;
		gap: 7px;
	}

	.ntask-meta-row {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.ntask-meta-notes {
		align-items: flex-start;
	}

	.ntask-label {
		width: 52px;
		flex-shrink: 0;
		font-size: 12px;
		text-align: right;
	}

	.ntask-input {
		flex: 1;
		background: var(--bg);
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
		padding: 4px 8px;
		font-size: 13px;
		color: var(--text);
		outline: none;
		font-family: inherit;
	}

	.ntask-input:focus {
		border-color: var(--c-accent);
	}

	.ntask-select {
		cursor: pointer;
	}

	.ntask-notes {
		resize: vertical;
		min-height: 44px;
		line-height: 1.4;
	}

	.ntask-foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px 14px;
		border-top: 1px solid var(--line);
		background: var(--bg);
	}
</style>
