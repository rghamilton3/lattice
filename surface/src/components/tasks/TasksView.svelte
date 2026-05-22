<script lang="ts">
	import { createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { browser } from '$app/environment';
	import { getWorkbenchContext } from '$lib/state/workbench.svelte';
	import {
		taskKeys,
		fetchTasks,
		fetchCompletedTasks,
		updateTaskMeta,
		uncompleteTask
	} from '$lib/api/tasks';
	import { useCompleteTask } from '$lib/state/useCompleteTask.svelte';
	import type { Task, TaskPriority } from '$lib/types';
	import Icon from '$components/icons/Icon.svelte';
	import { relTime } from '$lib/utils/relTime';
	import { logError } from '$lib/utils/logError';

	const { paneIndex: _paneIndex }: { paneIndex: 0 | 1 } = $props();

	const wb = getWorkbenchContext();
	const queryClient = useQueryClient();
	const done = useCompleteTask();

	let now = $state(Date.now());
	$effect(() => {
		const t = setInterval(() => (now = Date.now()), 60_000);
		return () => clearInterval(t);
	});

	const query = createQuery(() => ({
		queryKey: taskKeys.list(),
		queryFn: fetchTasks,
		enabled: browser
	}));

	const doneQuery = createQuery(() => ({
		queryKey: taskKeys.done(),
		queryFn: fetchCompletedTasks,
		enabled: browser
	}));

	const tasks = $derived<Task[]>(query.data ?? []);
	const completedTasks = $derived<Task[]>(doneQuery.data ?? []);

	let expandedId = $state<number | null>(null);
	let showCompleted = $state(false);

	// Per-task edit state (only one expanded at a time)
	let editDueDate = $state('');
	let editPriority = $state<TaskPriority | ''>('');
	let editNotes = $state('');
	let saving = $state(false);

	function expand(task: Task) {
		if (expandedId === task.id) {
			expandedId = null;
			return;
		}
		expandedId = task.id;
		editDueDate = task.task_due_date ?? '';
		editPriority = task.task_priority ?? '';
		editNotes = task.task_notes ?? '';
	}

	async function saveEdit(task: Task) {
		saving = true;
		try {
			await updateTaskMeta(task.id, {
				due_date: editDueDate || null,
				priority: (editPriority as TaskPriority) || null,
				notes: editNotes || null
			});
			queryClient.invalidateQueries({ queryKey: taskKeys.list() });
			expandedId = null;
			wb.showToast('Task updated');
		} catch (err) {
			logError('updateTaskMeta', err);
			wb.showToast('Save failed');
		} finally {
			saving = false;
		}
	}

	async function undone(task: Task) {
		queryClient.setQueryData(taskKeys.done(), (old: Task[] | undefined) =>
			old ? old.filter((t) => t.id !== task.id) : []
		);
		try {
			await uncompleteTask(task.id);
			queryClient.invalidateQueries({ queryKey: taskKeys.list() });
		} catch (err) {
			logError('uncompleteTask', err);
			queryClient.invalidateQueries({ queryKey: taskKeys.done() });
			wb.showToast('Restore failed');
		}
	}

	const PRIORITY_LABEL: Record<TaskPriority, string> = { high: 'high', medium: 'med', low: 'low' };
</script>

<div class="tasks-scroll">
	<div class="tasks">
		<div class="tasks-head">
			<div class="row" style="gap:16px; flex-wrap:wrap; align-items:baseline">
				<h1 class="home-title">Tasks</h1>
				{#if !query.isLoading}
					<span class="faint" style="font-size:13px">{tasks.length} active</span>
				{/if}
			</div>
			<button class="btn btn-primary btn-mini" onclick={() => (wb.activeOverlay = 'newTask')}>
				<Icon name="plus" size={13} />
				New task
			</button>
		</div>

		{#if query.isLoading}
			<div class="tasks-empty soft">loading…</div>
		{:else if query.isError}
			<div class="tasks-empty soft" style="color:var(--c-alarm)">couldn't load tasks</div>
		{:else if tasks.length === 0}
			<div class="tasks-empty">
				<p class="soft" style="margin:0">No active tasks.</p>
				<button
					class="btn btn-ghost"
					style="margin-top:10px"
					onclick={() => (wb.activeOverlay = 'newTask')}
				>
					<Icon name="plus" size={14} />
					Create one
				</button>
			</div>
		{:else}
			<div class="task-list">
				{#each tasks as task (task.id)}
					<div class="task-row" class:task-row--expanded={expandedId === task.id}>
						<div class="task-row-main">
							<button
								class="task-check"
								title="Mark done"
								aria-label="Mark done"
								onclick={() => done(task)}
							>
								<Icon name="checkbox" size={16} class="task-check-empty" />
								<Icon name="task" size={16} class="task-check-done" />
							</button>

							<button class="task-body" onclick={() => expand(task)}>
								<span class="task-text">{task.text}</span>
								<span class="task-chips">
									{#if task.task_due_date}
										<span class="chip chip-due">{task.task_due_date}</span>
									{/if}
									{#if task.task_priority}
										<span class="chip chip-priority chip-priority--{task.task_priority}">
											{PRIORITY_LABEL[task.task_priority]}
										</span>
									{/if}
									<span class="faint" style="font-size:11.5px"
										>{relTime(task.captured_at, now)}</span
									>
								</span>
								{#if task.task_notes}
									<span class="task-notes-preview faint">{task.task_notes}</span>
								{/if}
							</button>
						</div>

						{#if expandedId === task.id}
							<div class="task-edit">
								<div class="task-edit-row">
									<label class="task-edit-label faint" for="tedit-due-{task.id}">Due</label>
									<input
										id="tedit-due-{task.id}"
										type="date"
										class="task-edit-input"
										bind:value={editDueDate}
										onkeydown={(e) => e.key === 'Escape' && (expandedId = null)}
									/>
								</div>
								<div class="task-edit-row">
									<label class="task-edit-label faint" for="tedit-priority-{task.id}"
										>Priority</label
									>
									<select
										id="tedit-priority-{task.id}"
										class="task-edit-input task-edit-select"
										bind:value={editPriority}
									>
										<option value="">none</option>
										<option value="high">high</option>
										<option value="medium">medium</option>
										<option value="low">low</option>
									</select>
								</div>
								<div class="task-edit-row task-edit-notes">
									<label class="task-edit-label faint" for="tedit-notes-{task.id}">Notes</label>
									<textarea
										id="tedit-notes-{task.id}"
										class="task-edit-input task-edit-textarea"
										bind:value={editNotes}
										placeholder="optional notes…"
										rows="2"
										onkeydown={(e) => {
											if (e.key === 'Escape') expandedId = null;
											if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveEdit(task);
										}}
									></textarea>
								</div>
								<div class="task-edit-actions">
									<button class="btn btn-ghost btn-mini" onclick={() => (expandedId = null)}>
										cancel
									</button>
									<button
										class="btn btn-primary btn-mini"
										disabled={saving}
										onclick={() => saveEdit(task)}
									>
										save
									</button>
								</div>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}

		{#if !doneQuery.isLoading && completedTasks.length > 0}
			<div class="completed-section">
				<button
					class="completed-toggle"
					onclick={() => (showCompleted = !showCompleted)}
					aria-expanded={showCompleted}
				>
					<Icon
						name="chev-right"
						size={13}
						class="completed-chevron {showCompleted ? 'completed-chevron--open' : ''}"
					/>
					<span class="faint" style="font-size:13px">Completed ({completedTasks.length})</span>
				</button>

				{#if showCompleted}
					<div class="task-list">
						{#each completedTasks as task (task.id)}
							<div class="task-row task-row--done">
								<div class="task-row-main">
									<button
										class="task-check task-check--done"
										title="Mark active"
										aria-label="Mark active"
										onclick={() => undone(task)}
									>
										<Icon name="task" size={16} class="task-check-filled" />
										<Icon name="checkbox" size={16} class="task-check-restore" />
									</button>

									<div class="task-body">
										<span class="task-text task-text--done">{task.text}</span>
										<span class="task-chips">
											{#if task.task_due_date}
												<span class="chip chip-due">{task.task_due_date}</span>
											{/if}
											{#if task.task_priority}
												<span class="chip chip-priority chip-priority--{task.task_priority}">
													{PRIORITY_LABEL[task.task_priority]}
												</span>
											{/if}
											{#if task.task_completed_at}
												<span class="faint" style="font-size:11.5px"
													>done {relTime(task.task_completed_at, now)}</span
												>
											{/if}
										</span>
									</div>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>

<style>
	.tasks-scroll {
		height: 100%;
		overflow-y: auto;
	}

	.tasks {
		max-width: 680px;
		margin: 0 auto;
		padding: 32px 24px 48px;
	}

	.tasks-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 16px;
		margin-bottom: 24px;
		flex-wrap: wrap;
	}

	.tasks-empty {
		padding: 40px 0;
		text-align: center;
	}

	.task-list {
		display: flex;
		flex-direction: column;
	}

	.task-row {
		border-bottom: 1px solid var(--line);
	}

	.task-row:first-child {
		border-top: 1px solid var(--line);
	}

	.task-row-main {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		padding: 10px 0;
	}

	.task-row--expanded .task-row-main {
		padding-bottom: 6px;
	}

	.task-check {
		flex-shrink: 0;
		padding: 2px;
		margin-top: 1px;
		color: var(--text-faint);
		border-radius: var(--radius-sm);
		transition: color var(--t-fast) var(--ease);
	}

	.task-check:hover {
		color: var(--c-ok);
	}

	.task-check :global(.task-check-done) {
		display: none;
	}

	.task-check:hover :global(.task-check-empty) {
		display: none;
	}

	.task-check:hover :global(.task-check-done) {
		display: block;
	}

	/* Completed task check button */
	.task-check--done {
		color: var(--c-ok);
	}

	.task-check--done :global(.task-check-restore) {
		display: none;
	}

	.task-check--done:hover {
		color: var(--text-faint);
	}

	.task-check--done:hover :global(.task-check-filled) {
		display: none;
	}

	.task-check--done:hover :global(.task-check-restore) {
		display: block;
	}

	.task-body {
		flex: 1;
		min-width: 0;
		text-align: left;
		display: flex;
		flex-direction: column;
		gap: 4px;
		background: none;
		cursor: pointer;
	}

	.task-text {
		font-size: 14px;
		line-height: 1.5;
		color: var(--text);
	}

	.task-text--done {
		color: var(--text-mute);
		text-decoration: line-through;
	}

	.task-chips {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-wrap: wrap;
	}

	.task-notes-preview {
		font-size: 12px;
		line-height: 1.4;
		overflow: hidden;
		display: -webkit-box;
		-webkit-line-clamp: 1;
		line-clamp: 1;
		-webkit-box-orient: vertical;
	}

	/* ── completed section ── */
	.completed-section {
		margin-top: 32px;
	}

	.completed-toggle {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 4px 0;
		background: none;
		cursor: pointer;
		width: 100%;
		text-align: left;
	}

	.completed-toggle :global(.completed-chevron) {
		color: var(--text-faint);
		transition: transform var(--t-fast) var(--ease);
	}

	.completed-toggle :global(.completed-chevron--open) {
		transform: rotate(90deg);
	}

	.completed-section .task-list {
		margin-top: 8px;
	}

	/* ── chips ── */
	.chip {
		display: inline-flex;
		align-items: center;
		border-radius: 3px;
		padding: 1px 6px;
		font-size: 11px;
		font-variant-numeric: tabular-nums;
	}

	.chip-due {
		background: color-mix(in oklch, var(--c-info) 12%, transparent);
		color: var(--c-info);
	}

	.chip-priority {
		font-weight: 500;
	}

	.chip-priority--high {
		background: color-mix(in oklch, var(--c-alarm) 12%, transparent);
		color: var(--c-alarm);
	}

	.chip-priority--medium {
		background: color-mix(in oklch, var(--c-caution) 12%, transparent);
		color: var(--c-caution);
	}

	.chip-priority--low {
		background: var(--bg-high);
		color: var(--text-mute);
	}

	/* ── inline edit ── */
	.task-edit {
		padding: 0 0 14px 24px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.task-edit-row {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.task-edit-notes {
		align-items: flex-start;
	}

	.task-edit-label {
		width: 52px;
		flex-shrink: 0;
		font-size: 12px;
		text-align: right;
	}

	.task-edit-input {
		flex: 1;
		background: var(--bg-raised);
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
		padding: 4px 8px;
		font-size: 13px;
		color: var(--text);
		outline: none;
	}

	.task-edit-input:focus {
		border-color: var(--c-accent);
	}

	.task-edit-select {
		cursor: pointer;
	}

	.task-edit-textarea {
		resize: vertical;
		min-height: 48px;
		font-family: inherit;
		line-height: 1.4;
	}

	.task-edit-actions {
		display: flex;
		justify-content: flex-end;
		gap: 6px;
		padding-top: 2px;
	}
</style>
