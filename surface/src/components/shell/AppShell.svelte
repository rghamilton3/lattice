<script lang="ts">
	import type { Snippet } from 'svelte';
	import { createQuery } from '@tanstack/svelte-query';
	import { browser } from '$app/environment';
	import { getWorkbenchContext, type View } from '$lib/state/workbench.svelte';
	import Icon from '$components/icons/Icon.svelte';
	import NavBtn from './NavBtn.svelte';
	import { fetchStatus, statusKeys } from '$lib/api/status';
	import { relTime } from '$lib/utils/relTime';
	import CommandPalette from '$components/overlays/CommandPalette.svelte';

	type Props = {
		oncapture: () => void;
		onnav: (view: View) => void;
		children: Snippet;
	};
	let { oncapture, onnav, children }: Props = $props();

	const wb = getWorkbenchContext();

	const statusQuery = createQuery(() => ({
		queryKey: statusKeys.all(),
		queryFn: fetchStatus,
		enabled: browser,
		refetchInterval: 30_000
	}));

	let now = $state(Date.now());
	$effect(() => {
		const t = setInterval(() => (now = Date.now()), 60_000);
		return () => clearInterval(t);
	});

	const agentCount = $derived(statusQuery.data?.active_agent_count ?? null);
	const latestScan = $derived(
		(statusQuery.data?.agents ?? [])
			.map((a) => a.last_scan_at)
			.filter((s): s is string => s !== null)
			.sort()
			.at(-1) ?? null
	);
</script>

<div class="shell" data-focus={wb.focusMode ? 'on' : 'off'}>
	<!-- TOP TOOLBAR -->
	<header class="toolbar">
		<div class="row" style="gap:14px">
			<button class="brand" title="Home" onclick={() => onnav('home')}>
				<svg
					class="brand-icon"
					viewBox="0 0 16 16"
					xmlns="http://www.w3.org/2000/svg"
					aria-hidden="true"
				>
					<line
						x1="2"
						y1="2"
						x2="14"
						y2="2"
						stroke="var(--c-accent)"
						stroke-width="1.2"
						stroke-linecap="round"
					/>
					<line
						x1="2"
						y1="8"
						x2="14"
						y2="8"
						stroke="var(--c-accent)"
						stroke-width="1.2"
						stroke-linecap="round"
					/>
					<line
						x1="2"
						y1="14"
						x2="14"
						y2="14"
						stroke="var(--c-accent)"
						stroke-width="1.2"
						stroke-linecap="round"
					/>
					<line
						x1="2"
						y1="2"
						x2="2"
						y2="14"
						stroke="var(--c-accent)"
						stroke-width="1.2"
						stroke-linecap="round"
					/>
					<line
						x1="8"
						y1="2"
						x2="8"
						y2="14"
						stroke="var(--c-accent)"
						stroke-width="1.2"
						stroke-linecap="round"
					/>
					<line
						x1="14"
						y1="2"
						x2="14"
						y2="14"
						stroke="var(--c-accent)"
						stroke-width="1.2"
						stroke-linecap="round"
					/>
					<circle cx="2" cy="2" r="1.5" fill="var(--c-accent)" />
					<circle cx="8" cy="2" r="1.5" fill="var(--c-accent)" />
					<circle cx="14" cy="2" r="1.5" fill="var(--c-accent)" />
					<circle cx="2" cy="8" r="1.5" fill="var(--c-accent)" />
					<circle cx="8" cy="8" r="1.5" fill="var(--c-accent)" />
					<circle cx="14" cy="8" r="1.5" fill="var(--c-accent)" />
					<circle cx="2" cy="14" r="1.5" fill="var(--c-accent)" />
					<circle cx="8" cy="14" r="1.5" fill="var(--c-accent)" />
					<circle cx="14" cy="14" r="1.5" fill="var(--c-accent)" />
				</svg>
				<span class="brand-name">lattice</span>
			</button>

			<nav class="row" style="gap:2px">
				<NavBtn
					label="Home"
					icon="home"
					active={wb.view === 'home'}
					onclick={() => onnav('home')}
				/>
				<NavBtn
					label="Library"
					icon="library"
					active={wb.view === 'library'}
					onclick={() => onnav('library')}
				/>
				<NavBtn
					label="Tasks"
					icon="task"
					active={wb.view === 'tasks'}
					onclick={() => onnav('tasks')}
				/>
			</nav>
		</div>

		<div class="toolbar-center">
			<button
				class="palette-button"
				title="Command palette"
				aria-expanded={wb.activeOverlay === 'palette'}
				onclick={(e) => {
					e.stopPropagation();
					wb.activeOverlay = wb.activeOverlay === 'palette' ? 'none' : 'palette';
				}}
			>
				<Icon name="search" size={14} />
				<span class="palette-button-label">Find anything</span>
				<span class="palette-kbd">
					<span class="kbd">Ctrl</span>
					<span class="kbd">K</span>
				</span>
			</button>
			{#if wb.activeOverlay === 'palette'}
				<CommandPalette />
			{/if}
		</div>

		<div class="row" style="gap:6px">
			<button class="capture-button" title="Quick capture (c)" onclick={oncapture}>
				<Icon name="plus" size={14} />
				<span>Capture</span>
				<span class="kbd" style="margin-left:6px">c</span>
			</button>

			<div class="vbar"></div>

			<button
				class="btn btn-ghost"
				aria-pressed={wb.focusMode}
				aria-label="Focus mode"
				title="Focus mode (hide chrome)"
				onclick={() => (wb.focusMode = !wb.focusMode)}
			>
				<Icon name="focus" size={15} />
			</button>
			<button
				class="btn btn-ghost"
				aria-pressed={wb.activeOverlay === 'settings'}
				aria-label="Settings"
				title="Settings"
				onclick={() => (wb.activeOverlay = wb.activeOverlay === 'settings' ? 'none' : 'settings')}
			>
				<Icon name="cog" size={15} />
			</button>
		</div>
	</header>

	<!-- MAIN -->
	<main class="main">
		{@render children()}
	</main>

	<!-- BOTTOM STATUS BAR -->
	<footer class="statusbar">
		<div class="row" style="gap:14px">
			<span class="status-dot" data-state="ok"></span>
			<span class="faint" style="font-size:12px">
				spine&nbsp;·&nbsp;<span class="mono">lattice.rghsoftware.com</span>
			</span>
			<span class="faint" style="font-size:12px">
				agents&nbsp;·&nbsp;{agentCount !== null ? agentCount : '—'}
			</span>
			<span class="faint" style="font-size:12px">
				sync&nbsp;·&nbsp;{latestScan ? relTime(latestScan, now) : 'never'}
			</span>
		</div>
		<span class="faint statusbar-tagline">
			Lattice&nbsp;·&nbsp;ADHD-aware substrate&nbsp;·&nbsp;captured loosely, retrieved intelligently
		</span>
		<div class="row" style="gap:12px; font-size:12px">
			<span class="faint">posture · {wb.posture}</span>
			<span class="faint">
				vim ·
				<span style:color={wb.vimMode ? 'var(--c-ok)' : undefined}>
					{wb.vimMode ? 'on' : 'off'}
				</span>
			</span>
			<span class="kbd">?</span>
		</div>
	</footer>
</div>
