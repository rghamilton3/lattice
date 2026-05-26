<script lang="ts">
	import { createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { browser } from '$app/environment';
	import { getWorkbenchContext } from '$lib/state/workbench.svelte';
	import { triageCapture, TRIAGE_ACTION_LABEL } from '$lib/api/captures';
	import { applyArchiveAction, fetchInbox, inboxKeys, archiveRawUrl } from '$lib/api/archives';
	import type { TriageAction } from '$lib/api/captures';
	import { workingKeys, fetchWorkingList } from '$lib/api/working';
	import { taskKeys, fetchTasks } from '$lib/api/tasks';
	import { useCompleteTask } from '$lib/state/useCompleteTask.svelte';
	import type { ArchiveAction, Capture, DocRef, InboxItem, Task } from '$lib/types';
	import { captureToInboxItem } from '$lib/utils/inbox';
	import Icon from '$components/icons/Icon.svelte';
	import NowCard from './NowCard.svelte';
	import InboxList from './InboxList.svelte';
	import Resurfaced from './Resurfaced.svelte';
	import PostureToggle from './PostureToggle.svelte';
	import { relTime } from '$lib/utils/relTime';
	import { logError } from '$lib/utils/logError';

	const { paneIndex }: { paneIndex: 0 | 1 } = $props();

	const wb = getWorkbenchContext();
	const queryClient = useQueryClient();
	const doneTask = useCompleteTask();

	let connected = false;
	let liveDisconnected = $state(false);
	$effect(() => {
		if (!browser) return;
		const sse = new EventSource('/api/captures/stream');
		sse.addEventListener('capture', (e) => {
			try {
				const capture = JSON.parse(e.data) as Capture;
				if (capture.triaged_at !== null) return; // pre-triaged: bypass inbox
				queryClient.setQueryData(inboxKeys.list(20), (old: { items: InboxItem[] } | undefined) => {
					const item = captureToInboxItem(capture);
					if (!old) return { items: [item], next_cursor: null };
					if (old.items.some((i) => i.id === item.id)) return old;
					return { ...old, items: [item, ...old.items].slice(0, 20) };
				});
			} catch (err) {
				console.error('[sse] malformed capture event:', err);
			}
		});
		sse.addEventListener('open', () => {
			liveDisconnected = false;
			if (!connected) {
				connected = true;
				queryClient.invalidateQueries({ queryKey: inboxKeys.list(20) });
			}
		});
		sse.addEventListener('error', (e) => {
			if (sse.readyState === EventSource.CLOSED) {
				liveDisconnected = true;
				logError('sse:captures', e);
				wb.showToast('Live updates disconnected — refresh to reconnect');
			}
		});
		return () => {
			sse.close();
			connected = false;
		};
	});

	const inboxQuery = createQuery(() => ({
		queryKey: inboxKeys.list(20),
		queryFn: () => fetchInbox(20),
		enabled: browser
	}));

	const workingQuery = createQuery(() => ({
		queryKey: workingKeys.list(),
		queryFn: fetchWorkingList,
		enabled: browser
	}));

	const tasksQuery = createQuery(() => ({
		queryKey: taskKeys.list(),
		queryFn: fetchTasks,
		enabled: browser
	}));

	let now = $state(Date.now());
	$effect(() => {
		const t = setInterval(() => (now = Date.now()), 60_000);
		return () => clearInterval(t);
	});

	const inboxItems = $derived<InboxItem[]>(inboxQuery.data?.items ?? []);
	const captureCount = $derived(inboxItems.length);
	const visibleCaptures = $derived(inboxItems);
	const workingDocs = $derived(workingQuery.data ?? []);
	const last = $derived(workingDocs[0] ?? null);

	const allTasks = $derived<Task[]>(tasksQuery.data ?? []);
	const previewTasks = $derived(allTasks.slice(0, 5));

	function openDocRef(ref: DocRef) {
		wb.openInPane(paneIndex, { kind: 'doc', ref });
	}

	function openCapture(id: number) {
		openDocRef({ kind: 'capture', id });
	}

	function openArchive(id: number) {
		window.open(archiveRawUrl(id), '_blank', 'noopener,noreferrer');
	}

	function onProcessMode() {
		wb.startTriage();
	}

	async function onTriage(id: number, action: TriageAction) {
		queryClient.setQueryData(inboxKeys.list(20), (old: { items: InboxItem[] } | undefined) =>
			old ? { ...old, items: old.items.filter((item) => item.id !== `capture:${id}`) } : old
		);
		wb.showToast(`${TRIAGE_ACTION_LABEL[action]} · capture #${id}`);
		try {
			await triageCapture(id, action);
			if (action === 'task') {
				queryClient.invalidateQueries({ queryKey: taskKeys.list() });
			}
		} catch {
			queryClient.invalidateQueries({ queryKey: inboxKeys.list(20) });
			wb.showToast(`Triage failed for capture #${id}`);
		}
	}

	async function onArchiveInboxAction(id: number, action: ArchiveAction) {
		queryClient.setQueryData(inboxKeys.list(20), (old: { items: InboxItem[] } | undefined) =>
			old ? { ...old, items: old.items.filter((item) => item.id !== `archive:${id}`) } : old
		);
		try {
			const result = await applyArchiveAction(id, action);
			if (action === 'recapture') {
				window.open(result.url, '_blank', 'noopener,noreferrer');
				queryClient.invalidateQueries({ queryKey: inboxKeys.list(20) });
			}
			wb.showToast(`${action === 'recapture' ? 'Opened' : 'Saved'} · archive #${id}`);
		} catch {
			queryClient.invalidateQueries({ queryKey: inboxKeys.list(20) });
			wb.showToast(`Archive action failed for #${id}`);
		}
	}

	async function archiveAll() {
		const ids = (inboxItems ?? [])
			.filter((item) => item.item_type === 'capture')
			.map((item) => item.capture_id);
		if (ids.length === 0) return;
		queryClient.setQueryData(inboxKeys.list(20), (old: { items: InboxItem[] } | undefined) =>
			old ? { ...old, items: old.items.filter((item) => item.item_type !== 'capture') } : old
		);
		const settled = await Promise.allSettled(ids.map((id) => triageCapture(id, 'archive')));
		const failed = settled.filter((s) => s.status === 'rejected').length;
		const ok = ids.length - failed;
		if (failed > 0) {
			queryClient.invalidateQueries({ queryKey: inboxKeys.list(20) });
		}
		wb.showToast(failed > 0 ? `Archived ${ok}, ${failed} failed` : `Archived ${ok}`);
	}
</script>

<div class="home-scroll">
	<div class="home">
		<div class="home-greet">
			<div>
				<h1 class="home-title">
					Where you were
					{#if wb.postureView.showReviewHint && visibleCaptures.length > 0}
						<span class="review-hint" title="captures needing review">
							{visibleCaptures.length} to review
						</span>
					{/if}
				</h1>
				<p class="mute home-sub">Pick up, or capture something new. No streaks, no overdue.</p>
			</div>
			<PostureToggle
				value={wb.posture}
				onChange={(p) => {
					wb.posture = p;
				}}
			/>
		</div>

		{#if last}
			<NowCard
				doc={last}
				{now}
				onOpen={() => openDocRef({ kind: 'working', slug: last.slug })}
				onOpenSplit={() =>
					wb.openInPane(1, { kind: 'doc', ref: { kind: 'working', slug: last.slug } })}
			/>
		{:else if workingQuery.isLoading}
			<div class="card" style="padding:20px 22px">
				<p class="faint">loading recent work…</p>
			</div>
		{:else}
			<div class="card" style="padding:20px 22px">
				<p class="soft" style="margin:0">
					No working docs yet. Capture something, or create a new doc to begin.
				</p>
			</div>
		{/if}

		<div class="home-grid">
			<section class="card home-section">
				<div class="home-section-head">
					<h2 class="section-title">
						<Icon name="inbox" size={16} />
						<span>Inbox</span>
						{#if wb.postureView.showCounts}
							<span class="count-soft">{captureCount}</span>
						{/if}
					</h2>
					<span class="faint" style="font-size:12px; white-space:nowrap; margin-left:12px">
						process when you feel like it
					</span>
				</div>
				{#if liveDisconnected}
					<div class="inbox-empty soft" role="status">
						Live updates are disconnected. Existing captures remain here; refresh to reconnect.
					</div>
				{/if}
				{#if inboxQuery.isLoading}
					<div class="inbox-empty soft" role="status">Loading recent captures…</div>
				{:else if inboxQuery.isError}
					<div class="inbox-empty soft" style="color:var(--c-alarm)" role="alert">
						Couldn't load captures. Try refreshing the page.
					</div>
				{:else}
					<InboxList
						items={visibleCaptures}
						{now}
						onOpenCapture={openCapture}
						onOpenArchive={openArchive}
						{onTriage}
						onArchiveAction={onArchiveInboxAction}
					/>
				{/if}
				<div class="home-section-foot">
					<button class="btn btn-ghost" onclick={archiveAll}>
						<Icon name="archive" size={14} />Archive all read
					</button>
					{#if wb.featureFlags.triage}
						<button class="btn btn-ghost" onclick={onProcessMode}>
							<Icon name="clock" size={14} />Process 10 in 5 min
						</button>
					{/if}
				</div>
			</section>

			<section class="card home-section">
				<div class="home-section-head">
					<h2 class="section-title">
						<Icon name="task" size={16} />
						<span>Tasks</span>
						{#if wb.postureView.showCounts && allTasks.length > 0}
							<span class="count-soft">{allTasks.length}</span>
						{/if}
					</h2>
					<button class="btn btn-ghost" onclick={() => (wb.activeOverlay = 'newTask')}>
						<Icon name="plus" size={14} />New task
					</button>
				</div>
				{#if tasksQuery.isLoading}
					<div class="inbox-empty soft" role="status" aria-live="polite">Loading tasks…</div>
				{:else if tasksQuery.isError}
					<div class="inbox-empty soft" style="color:var(--c-alarm)" role="alert">
						Couldn't load tasks.
					</div>
				{:else if allTasks.length === 0}
					<div class="inbox-empty soft">no active tasks</div>
				{:else}
					<div class="home-task-list">
						{#each previewTasks as task (task.id)}
							<div class="home-task-row">
								<button
									class="home-task-check"
									title="Mark done"
									aria-label="Mark done: {task.text}"
									onclick={() => doneTask(task)}
								>
									<Icon name="checkbox" size={15} class="home-task-check-empty" />
									<Icon name="task" size={15} class="home-task-check-done" />
								</button>
								<button
									class="home-task-body"
									onclick={() => wb.openInPane(paneIndex, { kind: 'tasks' })}
								>
									<span class="home-task-text">{task.text}</span>
									{#if task.task_due_date || task.task_priority}
										<span class="home-task-chips">
											{#if task.task_due_date}
												<span class="home-chip home-chip-due">{task.task_due_date}</span>
											{/if}
											{#if task.task_priority}
												<span class="home-chip home-chip-{task.task_priority}"
													>{task.task_priority}</span
												>
											{/if}
										</span>
									{/if}
								</button>
							</div>
						{/each}
					</div>
					{#if allTasks.length > 5}
						<div class="home-section-foot">
							<button
								class="btn btn-ghost"
								onclick={() => wb.openInPane(paneIndex, { kind: 'tasks' })}
							>
								See all {allTasks.length} tasks
							</button>
						</div>
					{/if}
				{/if}
			</section>

			{#if wb.featureFlags.resurfacing && wb.postureView.showResurfaced}
				<section class="card home-section">
					<div class="home-section-head">
						<h2 class="section-title">
							<Icon name="sparkle" size={16} />
							<span>From your past</span>
						</h2>
						<span class="faint" style="font-size:12px; white-space:nowrap; margin-left:12px">
							quiet · dismissible
						</span>
					</div>
					<Resurfaced onOpen={openDocRef} />
				</section>
			{/if}
		</div>

		<section class="card home-section">
			<div class="home-section-head">
				<h2 class="section-title">
					<Icon name="edit" size={16} />
					<span>Working docs</span>
				</h2>
				<button class="btn btn-ghost" onclick={() => (wb.activeOverlay = 'newDoc')}>
					<Icon name="plus" size={14} />New doc
				</button>
			</div>
			{#if workingDocs.length === 0}
				<div class="inbox-empty soft">
					{workingQuery.isLoading ? 'loading…' : 'no working docs yet'}
				</div>
			{:else}
				<div class="working-grid">
					{#each workingDocs as d (d.slug)}
						<button
							class="working-card"
							onclick={() => openDocRef({ kind: 'working', slug: d.slug })}
						>
							<div class="working-card-title">{d.title}</div>
							<div class="working-card-meta mono">
								{d.slug}.md · {relTime(d.modified_at, now)}
							</div>
						</button>
					{/each}
				</div>
			{/if}
		</section>
	</div>
</div>
