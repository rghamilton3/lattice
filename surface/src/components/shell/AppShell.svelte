<script lang="ts">
	import type { Snippet } from 'svelte';
	import { getWorkbenchContext, type View } from '$lib/state/workbench.svelte';
	import Icon from '$components/icons/Icon.svelte';
	import NavBtn from './NavBtn.svelte';

	type Props = {
		oncapture: () => void;
		oncommand: () => void;
		onnav: (view: View) => void;
		children: Snippet;
	};
	let { oncapture, oncommand, onnav, children }: Props = $props();

	const wb = getWorkbenchContext();
</script>

<div class="shell" data-focus={wb.focusMode ? 'on' : 'off'}>
	<!-- TOP TOOLBAR -->
	<header class="toolbar">
		<div class="row" style="gap:14px">
			<button class="brand" title="Home" onclick={() => onnav('home')}>
				<span class="brand-dot"></span>
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
					label="Search"
					icon="search"
					active={wb.view === 'search'}
					onclick={() => onnav('search')}
				/>
				<NavBtn
					label="Tasks"
					icon="task"
					active={wb.view === 'tasks'}
					onclick={() => onnav('tasks')}
				/>
				<NavBtn
					label="Library"
					icon="library"
					active={wb.view === 'library'}
					onclick={() => onnav('library')}
				/>
			</nav>
		</div>

		<div class="toolbar-center">
			<button class="palette-button" title="Command palette" onclick={oncommand}>
				<Icon name="search" size={14} />
				<span class="palette-button-label">Find anything</span>
				<span class="palette-kbd">
					<span class="kbd">Ctrl</span>
					<span class="kbd">K</span>
				</span>
			</button>
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
		<!-- TODO(spine): /api/agents and sync-status endpoints not yet implemented. -->
		<div class="row" style="gap:14px">
			<span class="status-dot" data-state="ok"></span>
			<span class="faint" style="font-size:12px">
				spine&nbsp;·&nbsp;<span class="mono">lattice.rghsoftware.com</span>
			</span>
			<span class="faint" style="font-size:12px">agents&nbsp;·&nbsp;—</span>
			<span class="faint" style="font-size:12px">sync&nbsp;·&nbsp;pending</span>
		</div>
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
