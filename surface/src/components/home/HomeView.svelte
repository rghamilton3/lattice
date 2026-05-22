<script lang="ts">
	import { createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { browser } from '$app/environment';
	import { getWorkbenchContext } from '$lib/state/workbench.svelte';
	import { captureKeys, fetchCaptures, triageCapture } from '$lib/api/captures';
	import { workingKeys, fetchWorkingList } from '$lib/api/working';
	import type { Capture, DocRef } from '$lib/types';
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

	let connected = false;
	$effect(() => {
		if (!browser) return;
		const sse = new EventSource('/api/captures/stream');
		sse.addEventListener('capture', (e) => {
			try {
				const capture = JSON.parse(e.data) as Capture;
				queryClient.setQueryData(captureKeys.list(20), (old: Capture[] | undefined) => {
					if (!old) return [capture];
					if (old.some((c) => c.id === capture.id)) return old;
					return [capture, ...old].slice(0, 20);
				});
			} catch (err) {
				console.error('[sse] malformed capture event:', err);
			}
		});
		sse.addEventListener('open', () => {
			if (!connected) {
				connected = true;
				queryClient.invalidateQueries({ queryKey: captureKeys.list(20) });
			}
		});
		sse.addEventListener('error', (e) => {
			if (sse.readyState === EventSource.CLOSED) {
				logError('sse:captures', e);
				wb.showToast('Live updates disconnected — refresh to reconnect');
			}
		});
		return () => { sse.close(); connected = false; };
	});

	const capturesQuery = createQuery(() => ({
		queryKey: captureKeys.list(20),
		queryFn: () => fetchCaptures(20),
		enabled: browser
	}));

	const workingQuery = createQuery(() => ({
		queryKey: workingKeys.list(),
		queryFn: fetchWorkingList,
		enabled: browser
	}));

	let now = $state(Date.now());
	$effect(() => {
		const t = setInterval(() => (now = Date.now()), 60_000);
		return () => clearInterval(t);
	});

	const captureCount = $derived(capturesQuery.data?.length ?? 0);
	const visibleCaptures = $derived(
		(capturesQuery.data ?? []).filter((c) => !wb.dismissedCaptureIds.includes(c.id))
	);
	const workingDocs = $derived(workingQuery.data ?? []);
	const last = $derived(workingDocs[0] ?? null);

	function openDocRef(ref: DocRef) {
		wb.openInPane(paneIndex, { kind: 'doc', ref });
	}

	function openCapture(id: number) {
		openDocRef({ kind: 'capture', id });
	}

	function onProcessMode() {
		wb.startTriage();
	}

	async function archiveAll() {
		const ids = visibleCaptures.map((c) => c.id);
		if (ids.length === 0) return;

		const fresh = ids.filter((id) => !wb.dismissedCaptureIds.includes(id));
		if (fresh.length > 0) {
			wb.dismissedCaptureIds = [...wb.dismissedCaptureIds, ...fresh];
		}

		const settled = await Promise.allSettled(ids.map((id) => triageCapture(id, 'archive')));
		const failed = settled.filter((s) => s.status === 'rejected').length;
		const ok = ids.length - failed;
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
				{#if capturesQuery.isLoading}
					<div class="inbox-empty soft">loading…</div>
				{:else if capturesQuery.isError}
					<div class="inbox-empty soft" style="color:var(--c-alarm)">couldn't load captures</div>
				{:else}
					<InboxList
						captures={visibleCaptures}
						{now}
						onOpen={openCapture}
						onTriage={(id, action) => wb.dismissCapture(id, action)}
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

		<div class="home-foot faint">
			Lattice · ADHD-aware substrate · captured loosely, retrieved intelligently
		</div>
	</div>
</div>
