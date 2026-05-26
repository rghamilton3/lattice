<script lang="ts">
	import { createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { browser } from '$app/environment';
	import { getWorkbenchContext, type TriageDecision } from '$lib/state/workbench.svelte';
	import {
		captureKeys,
		fetchCaptures,
		TRIAGE_ACTION_LABEL,
		type TriageAction
	} from '$lib/api/captures';
	import { taskKeys } from '$lib/api/tasks';
	import { relTime } from '$lib/utils/relTime';
	import Icon from '$components/icons/Icon.svelte';

	const wb = getWorkbenchContext();
	const queryClient = useQueryClient();
	let now = $state(Date.now());
	$effect(() => {
		const t = setInterval(() => (now = Date.now()), 60_000);
		return () => clearInterval(t);
	});

	const capturesQuery = createQuery(() => ({
		queryKey: captureKeys.list(20),
		queryFn: () => fetchCaptures(20),
		enabled: browser
	}));

	const queue = $derived((capturesQuery.data ?? []).slice(0, 10));

	interface TriageSession {
		index: number;
		paused: boolean;
		secondsLeft: number;
		decisions: TriageDecision[];
	}

	let session = $state<TriageSession>({
		index: 0,
		paused: false,
		secondsLeft: 5 * 60,
		decisions: []
	});

	$effect(() => {
		if (session.paused) return;
		const t = setInterval(() => {
			session.secondsLeft = Math.max(0, session.secondsLeft - 1);
		}, 1000);
		return () => clearInterval(t);
	});

	const done = $derived(session.decisions.length);
	const hasError = $derived(capturesQuery.isError);
	const empty = $derived(!capturesQuery.isLoading && !capturesQuery.isError && queue.length === 0);
	const queueDone = $derived(queue.length > 0 && session.index >= queue.length);
	const timerExpired = $derived(
		queue.length > 0 && session.index < queue.length && session.secondsLeft === 0
	);
	const finished = $derived(queueDone || timerExpired);
	const mm = $derived(Math.floor(session.secondsLeft / 60));
	const ss = $derived((session.secondsLeft % 60).toString().padStart(2, '0'));
	const pct = $derived(queue.length === 0 ? 0 : Math.min(100, (done / queue.length) * 100));
	const current = $derived(queue[session.index]);

	function resumeTimer() {
		session.secondsLeft = 5 * 60;
		session.paused = false;
	}

	const counts = $derived.by(() => {
		const acc: Record<string, number> = {};
		for (const d of session.decisions) {
			const label = TRIAGE_ACTION_LABEL[d.action];
			acc[label] = (acc[label] ?? 0) + 1;
		}
		return Object.entries(acc) as [string, number][];
	});

	function advance(action: TriageAction) {
		const cap = current;
		if (!cap) return;
		session.decisions = [...session.decisions, { id: cap.id, action }];
		session.index += 1;
	}

	function exit() {
		wb.exitTriage(session.decisions).then(() => {
			queryClient.invalidateQueries({ queryKey: captureKeys.list(20) });
			if (session.decisions.some((d) => d.action === 'task')) {
				queryClient.invalidateQueries({ queryKey: taskKeys.list() });
			}
		});
	}

	function handleKeydown(e: KeyboardEvent) {
		if (finished || empty || hasError) {
			if (e.key === 'Escape') {
				e.preventDefault();
				exit();
			}
			return;
		}
		switch (e.key) {
			case 'k':
			case 'K':
				e.preventDefault();
				advance('keep');
				break;
			case 'a':
			case 'A':
				e.preventDefault();
				advance('archive');
				break;
			case 'p':
			case 'P':
				e.preventDefault();
				advance('promote');
				break;
			case 't':
			case 'T':
				e.preventDefault();
				advance('task');
				break;
			case ' ':
				e.preventDefault();
				advance('skip');
				break;
			case 'Escape':
				e.preventDefault();
				exit();
				break;
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="process-mode">
	<header class="process-head">
		<div class="row" style="gap:10px">
			<Icon name="clock" size={14} />
			<span style="font-weight:500">Process 10 in 5 min</span>
			<span class="faint" style="font-size:13px">· you can stop anytime</span>
		</div>
		<div class="row" style="gap:12px">
			<span class="process-progress mono">
				{Math.min(done + 1, Math.max(queue.length, 1))} of {queue.length}
			</span>
			<button
				class="btn btn-ghost"
				onclick={() => (session.paused = !session.paused)}
				title="Pause timer"
				aria-label={session.paused ? 'Resume process timer' : 'Pause process timer'}
			>
				<span aria-hidden="true">{session.paused ? '▶' : '⏸'}</span>
				<span class="mono" style="width:40px; text-align:right">
					{mm}:{ss}
				</span>
			</button>
			<button class="btn btn-ghost" onclick={exit} aria-label="Stop processing captures">
				<Icon name="x" size={14} />
				<span>Stop</span>
			</button>
		</div>
	</header>

	<div
		class="process-bar"
		role="progressbar"
		aria-label="Triage progress"
		aria-valuemin="0"
		aria-valuemax={queue.length}
		aria-valuenow={done}
	>
		<div class="process-fill" style:width="{pct}%"></div>
	</div>

	<div class="process-body">
		{#if capturesQuery.isLoading}
			<div class="cap-card" style="text-align:center">
				<p class="faint" style="margin:0" role="status" aria-live="polite">Loading inbox…</p>
			</div>
		{:else if hasError}
			<div class="cap-card done-card" role="alert">
				<div aria-hidden="true">⚠</div>
				<h2 style="font-size:22px; margin:6px 0 6px">Couldn't load inbox.</h2>
				<p class="faint" style="font-size:14px; margin:0">
					Your captures didn't load — your inbox may not actually be empty.
				</p>
				<div class="row" style="gap:8px; margin-top:18px; justify-content:center">
					<button class="btn btn-ghost" onclick={() => capturesQuery.refetch()}>Try again</button>
					<button class="btn btn-primary" onclick={exit}>Back to home</button>
				</div>
			</div>
		{:else if empty}
			<div class="cap-card done-card">
				<div aria-hidden="true">○</div>
				<h2 style="font-size:22px; margin:6px 0 6px">Nothing to triage.</h2>
				<p class="faint" style="font-size:14px; margin:0">
					Your inbox is empty — or already cleared.
				</p>
				<div class="row" style="gap:8px; margin-top:18px; justify-content:center">
					<button class="btn btn-primary" onclick={exit}>Back to home</button>
				</div>
			</div>
		{:else if timerExpired}
			<div class="cap-card done-card">
				<div aria-hidden="true">⏱</div>
				<h2 style="font-size:22px; margin:6px 0 6px">Timer up.</h2>
				<p class="faint" style="font-size:14px; margin:0">
					{session.decisions.length}
					{session.decisions.length === 1 ? 'capture' : 'captures'} triaged. {queue.length -
						session.index} still in your inbox — no penalty.
				</p>
				<div class="row" style="gap:8px; margin-top:18px; justify-content:center">
					<button class="btn btn-ghost" onclick={resumeTimer}>Keep going</button>
					<button class="btn btn-primary" onclick={exit}>Back to home</button>
				</div>
			</div>
		{:else if queueDone}
			<div class="cap-card done-card">
				<div aria-hidden="true">✓</div>
				<h2 style="font-size:22px; margin:6px 0 6px">Inbox processed.</h2>
				<p class="faint" style="font-size:14px; margin:0">
					{session.decisions.length}
					{session.decisions.length === 1 ? 'capture' : 'captures'} triaged. Whatever you didn't reach
					is still in your inbox — no penalty.
				</p>
				{#if counts.length > 0}
					<div class="done-summary">
						{#each counts as [label, n] (label)}
							<div class="done-row">
								<span class="mono faint">{n}</span>
								<span>{label}</span>
							</div>
						{/each}
					</div>
				{/if}
				<div class="row" style="gap:8px; margin-top:18px; justify-content:center">
					<button class="btn btn-primary" onclick={exit}>Back to home</button>
				</div>
			</div>
		{:else if current}
			<div class="cap-card">
				<div class="cap-card-meta faint">
					<span class="chip chip-capture">capture</span>
					<span>·</span>
					<span class="mono">{current.source}</span>
					<span>·</span>
					<span>{relTime(current.captured_at, now)}</span>
					<span class="mono" style="margin-left:auto">#{current.id}</span>
				</div>
				<p class="cap-card-body">{current.text}</p>
				<div class="cap-card-actions">
					<button class="cap-action" onclick={() => advance('keep')} aria-label="Keep capture">
						<div class="cap-action-key"><span class="kbd">k</span></div>
						<div class="cap-action-label">
							<Icon name="check" size={15} />
							<span>Keep</span>
						</div>
						<div class="cap-action-hint faint">leave it where it is</div>
					</button>
					<button
						class="cap-action"
						onclick={() => advance('archive')}
						aria-label="Archive capture"
					>
						<div class="cap-action-key"><span class="kbd">a</span></div>
						<div class="cap-action-label">
							<Icon name="archive" size={15} />
							<span>Archive</span>
						</div>
						<div class="cap-action-hint faint">out of sight, still searchable</div>
					</button>
					<button
						class="cap-action"
						onclick={() => advance('promote')}
						aria-label="Promote capture"
					>
						<div class="cap-action-key"><span class="kbd">p</span></div>
						<div class="cap-action-label">
							<Icon name="promote" size={15} />
							<span>Promote</span>
						</div>
						<div class="cap-action-hint faint">become a working doc</div>
					</button>
					<button
						class="cap-action"
						onclick={() => advance('task')}
						aria-label="Turn capture into task"
					>
						<div class="cap-action-key"><span class="kbd">t</span></div>
						<div class="cap-action-label">
							<Icon name="task" size={15} />
							<span>Task</span>
						</div>
						<div class="cap-action-hint faint">route to your task channel</div>
					</button>
					<button class="cap-action" onclick={() => advance('skip')} aria-label="Skip capture">
						<div class="cap-action-key"><span class="kbd">␣</span></div>
						<div class="cap-action-label">
							<Icon name="skip" size={15} />
							<span>Skip</span>
						</div>
						<div class="cap-action-hint faint">decide later, no penalty</div>
					</button>
				</div>
				<p class="cap-card-foot faint">
					no shame mechanics. ambiguous? skip it. tired? close this — your queue waits.
				</p>
			</div>
		{/if}
	</div>
</div>

<style>
	@media (prefers-reduced-motion: reduce) {
		:global(.process-fill) {
			transition: none;
		}
	}
</style>
