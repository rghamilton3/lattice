<script lang="ts">
	import type { Snippet } from 'svelte';
	import { onMount } from 'svelte';
	import { createQuery } from '@tanstack/svelte-query';
	import { browser } from '$app/environment';
	import { ApiError } from '$lib/api/client';
	import { getPwaContext } from '$lib/state/pwa.svelte';
	import type { PwaNoticeModel } from '$lib/pwa/types';
	import { getWorkbenchContext, type View } from '$lib/state/workbench.svelte';
	import Icon from '$components/icons/Icon.svelte';
	import NavBtn from './NavBtn.svelte';
	import PwaNotice from './PwaNotice.svelte';
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
	const pwa = getPwaContext();

	// Narrow-viewport navigation menu (replaces the inline nav below the phone
	// breakpoint, where the full toolbar no longer fits on one row).
	let menuOpen = $state(false);
	let menuTrigger = $state<HTMLButtonElement | null>(null);
	let menuPanel = $state<HTMLElement | null>(null);

	function closeMenu() {
		menuOpen = false;
		menuTrigger?.focus();
	}
	function navFromMenu(view: View) {
		onnav(view);
		menuOpen = false;
	}

	$effect(() => {
		// Move focus into the menu when it opens so it is keyboard-operable.
		if (menuOpen) menuPanel?.querySelector('button')?.focus();
	});

	const statusQuery = createQuery(() => ({
		queryKey: statusKeys.all(),
		queryFn: fetchStatus,
		enabled: browser,
		refetchInterval: 30_000,
		retry: false
	}));

	let now = $state(Date.now());
	$effect(() => {
		const t = setInterval(() => (now = Date.now()), 60_000);
		return () => clearInterval(t);
	});

	const agentCount = $derived(statusQuery.data?.active_agent_count ?? null);
	const statusState = $derived(statusQuery.isError ? 'warn' : 'ok');
	const agentLabel = $derived(
		statusQuery.isError
			? 'temporarily unavailable'
			: agentCount !== null
				? String(agentCount)
				: 'unknown'
	);
	// Keyword-only pill: driven by the inference breaker state reported by spine.
	const searchDegraded = $derived(statusQuery.data?.search_degraded ?? false);
	const needsEmbedding = $derived(statusQuery.data?.needs_embedding ?? null);
	const keywordOnlyTitle = $derived(
		needsEmbedding !== null && needsEmbedding > 0
			? `Inference endpoint unavailable — search is keyword-only. ${needsEmbedding} document${needsEmbedding === 1 ? '' : 's'} awaiting embedding.`
			: 'Inference endpoint unavailable — search is keyword-only until it recovers.'
	);
	const latestScan = $derived(
		(statusQuery.data?.agents ?? [])
			.map((a) => a.last_scan_at)
			.filter((s): s is string => s !== null)
			.sort()
			.at(-1) ?? null
	);

	$effect(() => {
		if (statusQuery.isError) {
			const status = statusQuery.error instanceof ApiError ? statusQuery.error.status : undefined;
			pwa.classifyServiceError(status);
		} else if (statusQuery.isSuccess) {
			pwa.markServiceLive();
		}
	});

	const pwaNotice = $derived.by<PwaNoticeModel | null>(() => {
		if (pwa.installAvailable) {
			return {
				kind: 'install',
				tone: 'info',
				title: 'Install Surface',
				message: 'Add Lattice Surface to your launcher for a focused workbench window.',
				actions: [{ label: 'Install', onclick: () => pwa.promptInstall(), variant: 'primary' }],
				ondismiss: () => pwa.dismissInstall()
			};
		}
		if (pwa.degradedKind) {
			const authorization = pwa.degradedKind === 'authorization-required';
			const missing = pwa.degradedKind === 'missing-resource';
			return {
				kind: 'degraded',
				tone: 'warn',
				title: authorization ? 'Sign-in needs attention' : 'Surface is in recovery mode',
				message: authorization
					? 'The shell is available, but live content needs a fresh authenticated request.'
					: missing
						? 'This route is not available from the cached shell. Your saved data has not been removed.'
						: 'The shell is available, but live services are temporarily unreachable. Your data has not been deleted.',
				actions: [
					{
						label: authorization ? 'Reauthenticate' : 'Retry',
						onclick: () => (authorization ? pwa.reauthenticate() : pwa.retry()),
						variant: 'primary'
					},
					{ label: 'Home', onclick: () => pwa.returnHome() }
				]
			};
		}
		if (pwa.showUpdateNotice && wb.activeOverlay === 'none') {
			const failed = pwa.updateState === 'failed';
			return {
				kind: 'update',
				tone: failed ? 'warn' : 'info',
				title: failed ? 'Update needs a reload' : 'New version of the Surface app available',
				message: failed
					? 'Reload to recover the newest app shell. No cache clearing or reinstall is needed.'
					: 'A newer version of this web app downloaded in the background. Reload to switch to it. Your captures and documents live on the server and are not affected.',
				actions: [{ label: 'Reload', onclick: () => pwa.reloadForUpdate(), variant: 'primary' }],
				// A failed update means the shell may be stale or broken; keep that
				// notice visible instead of letting it be dismissed for the session.
				ondismiss: failed ? undefined : () => pwa.dismissUpdate()
			};
		}
		if (pwa.installUnsupported) {
			return {
				kind: 'unsupported',
				tone: 'info',
				title: 'Install unavailable',
				message:
					'This browser did not expose an install prompt. You can still use Surface in this tab.',
				actions: [{ label: 'Dismiss', onclick: () => pwa.dismissInstall() }]
			};
		}
		return null;
	});

	onMount(() => {
		const markInstalled = () => pwa.markInstalled();
		window.addEventListener('appinstalled', markInstalled);
		return () => window.removeEventListener('appinstalled', markInstalled);
	});
</script>

<svelte:window
	onbeforeinstallprompt={(event) => pwa.captureInstallEvent(event)}
	ononline={() => pwa.setNetworkState(true)}
	onoffline={() => pwa.setNetworkState(false)}
	onfocus={() => pwa.refreshBrowserState()}
	onfocusin={() => pwa.refreshActiveTextEntry()}
	onfocusout={() => pwa.refreshActiveTextEntry()}
	onpointerdown={() => pwa.refreshBrowserState()}
/>

<div class="shell" data-focus={wb.focusMode ? 'on' : 'off'}>
	<!-- TOP TOOLBAR -->
	<header class="toolbar">
		<div class="row" style="gap:14px">
			<button
				class="nav-btn toolbar-menu-btn"
				bind:this={menuTrigger}
				aria-label="Menu"
				aria-haspopup="menu"
				aria-expanded={menuOpen}
				title="Menu"
				onclick={() => (menuOpen = !menuOpen)}
			>
				<Icon name="menu" size={16} />
			</button>

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

			<nav class="row toolbar-nav" style="gap:2px">
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
				<NavBtn
					label="Tracking"
					icon="focus"
					active={wb.view === 'tracking'}
					onclick={() => onnav('tracking')}
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
			<button
				class="capture-button"
				title="Quick capture (c)"
				aria-label="Quick capture"
				onclick={oncapture}
			>
				<Icon name="plus" size={14} />
				<span>Capture</span>
				<span class="kbd" style="margin-left:6px">c</span>
			</button>

			<div class="row toolbar-aux" style="gap:6px">
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
		</div>

		{#if menuOpen}
			<div class="toolbar-menu-backdrop" role="presentation" onclick={closeMenu}></div>
			<div
				class="toolbar-menu-pop"
				role="menu"
				tabindex="-1"
				aria-label="Navigation menu"
				bind:this={menuPanel}
				onkeydown={(e) => {
					if (e.key === 'Escape') closeMenu();
				}}
			>
				<button role="menuitem" onclick={() => navFromMenu('home')}>
					<Icon name="home" size={15} /> Home
				</button>
				<button role="menuitem" onclick={() => navFromMenu('library')}>
					<Icon name="library" size={15} /> Library
				</button>
				<button role="menuitem" onclick={() => navFromMenu('tasks')}>
					<Icon name="task" size={15} /> Tasks
				</button>
				<div class="toolbar-menu-sep" role="none"></div>
				<button
					role="menuitemcheckbox"
					aria-checked={wb.focusMode}
					onclick={() => {
						wb.focusMode = !wb.focusMode;
						closeMenu();
					}}
				>
					<Icon name="focus" size={15} /> Focus mode
				</button>
				<button
					role="menuitem"
					onclick={() => {
						wb.activeOverlay = 'settings';
						menuOpen = false;
					}}
				>
					<Icon name="cog" size={15} /> Settings
				</button>
			</div>
		{/if}
	</header>

	<!-- MAIN -->
	<main class="main">
		{#if pwaNotice}
			<PwaNotice notice={pwaNotice} />
		{/if}
		{@render children()}
	</main>

	<!-- BOTTOM STATUS BAR -->
	<footer class="statusbar">
		<div class="row" style="gap:14px">
			<span class="status-dot" data-state={statusState} aria-hidden="true"></span>
			<span class="faint" style="font-size:12px">
				spine&nbsp;·&nbsp;<span class="mono">lattice.rghsoftware.com</span>
			</span>
			<span class="faint" style="font-size:12px">
				agents&nbsp;·&nbsp;{agentLabel}
			</span>
			<span class="faint" style="font-size:12px">
				sync&nbsp;·&nbsp;{latestScan ? relTime(latestScan, now) : 'never'}
			</span>
			{#if searchDegraded}
				<span class="chip chip-keyword-only" role="status" title={keywordOnlyTitle}>
					Keyword-only
				</span>
			{/if}
			{#each (statusQuery.data?.inference_endpoints ?? []).filter((ep) => ep.status === 'degraded') as ep (ep.role)}
				<span
					class="chip chip-keyword-only"
					role="status"
					title="{ep.role} endpoint degraded: {ep.url ?? 'unknown URL'}">{ep.role} degraded</span
				>
			{/each}
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
