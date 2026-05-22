<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import { browser } from '$app/environment';
	import { getWorkbenchContext } from '$lib/state/workbench.svelte';
	import { captureKeys, fetchCaptures } from '$lib/api/captures';
	import type { Capture, DocRef } from '$lib/types';
	import Icon from '$components/icons/Icon.svelte';
	import { relTime } from '$lib/utils/relTime';

	const { paneIndex }: { paneIndex: 0 | 1 } = $props();

	const wb = getWorkbenchContext();

	const LIBRARY_LIMIT = 200;

	const query = createQuery(() => ({
		queryKey: captureKeys.listAll(LIBRARY_LIMIT),
		queryFn: () => fetchCaptures(LIBRARY_LIMIT, true),
		enabled: browser
	}));

	let now = $state(Date.now());
	$effect(() => {
		const t = setInterval(() => (now = Date.now()), 60_000);
		return () => clearInterval(t);
	});

	const captures = $derived<Capture[]>(query.data ?? []);
	const triaged = $derived(captures.filter((c) => c.triaged_at !== null));
	const inbox = $derived(captures.filter((c) => c.triaged_at === null));

	function openCapture(id: number) {
		wb.openInPane(paneIndex, { kind: 'doc', ref: { kind: 'capture', id } satisfies DocRef });
	}

	const ACTION_LABEL: Record<string, string> = {
		keep: 'kept',
		archive: 'archived',
		promote: 'promoted',
		task: 'tasked',
		skip: 'skipped'
	};
</script>

<div class="library-scroll">
	<div class="library">
		<div class="library-head">
			<h1 class="home-title">Library</h1>
			{#if !query.isLoading}
				<span class="faint" style="font-size:13px">
					{captures.length} total · {inbox.length} in inbox · {triaged.length} processed
				</span>
			{/if}
		</div>

		{#if query.isLoading}
			<div class="lib-empty soft">loading…</div>
		{:else if query.isError}
			<div class="lib-empty soft" style="color:var(--c-alarm)">couldn't load library</div>
		{:else if captures.length === 0}
			<div class="lib-empty soft">Nothing captured yet.</div>
		{:else}
			<div class="lib-list">
				{#each captures as c (c.id)}
					<button
						class="lib-row"
						class:lib-row--triaged={c.triaged_at !== null}
						onclick={() => openCapture(c.id)}
					>
						<div class="lib-row-dot">
							<Icon name="circle" size={8} />
						</div>
						<div class="lib-row-body">
							<div class="lib-row-text">{c.text}</div>
							<div class="lib-row-meta">
								<span class="chip chip-capture">capture</span>
								<span>·</span>
								<span class="mono">{c.source}</span>
								<span>·</span>
								<span>{relTime(c.captured_at, now)}</span>
								{#if c.triage_action}
									<span>·</span>
									<span class="chip chip-triage">{ACTION_LABEL[c.triage_action] ?? c.triage_action}</span>
								{/if}
							</div>
						</div>
					</button>
				{/each}
			</div>
		{/if}
	</div>
</div>

<style>
	.library-scroll {
		height: 100%;
		overflow-y: auto;
	}

	.library {
		max-width: 680px;
		margin: 0 auto;
		padding: 32px 24px 48px;
	}

	.library-head {
		display: flex;
		align-items: baseline;
		gap: 16px;
		margin-bottom: 24px;
	}

	.lib-empty {
		padding: 32px 0;
		text-align: center;
	}

	.lib-list {
		display: flex;
		flex-direction: column;
	}

	.lib-row {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		padding: 10px 0;
		border-bottom: 1px solid var(--c-border);
		background: none;
		border-left: none;
		border-right: none;
		border-top: none;
		cursor: pointer;
		text-align: left;
		width: 100%;
		color: var(--c-text);
		transition: background 0.1s;
	}

	.lib-row:first-child {
		border-top: 1px solid var(--c-border);
	}

	.lib-row:hover {
		background: var(--c-surface-raised);
	}

	.lib-row--triaged {
		opacity: 0.5;
	}

	.lib-row-dot {
		padding-top: 4px;
		color: var(--c-text-muted);
		flex-shrink: 0;
	}

	.lib-row-body {
		flex: 1;
		min-width: 0;
	}

	.lib-row-text {
		font-size: 14px;
		line-height: 1.5;
		overflow: hidden;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
	}

	.lib-row-meta {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-top: 3px;
		font-size: 12px;
		color: var(--c-text-muted);
	}

	.chip-triage {
		background: var(--c-surface-high);
		color: var(--c-text-muted);
		border-radius: 3px;
		padding: 1px 5px;
		font-size: 11px;
	}
</style>
