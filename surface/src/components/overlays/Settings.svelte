<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import { browser } from '$app/environment';
	import {
		getWorkbenchContext,
		type Theme,
		type Density,
		type Posture
	} from '$lib/state/workbench.svelte';
	import { settingsKeys, fetchSpineVersion } from '$lib/api/settings';
	import Icon from '$components/icons/Icon.svelte';
	import InferenceSettings from './InferenceSettings.svelte';
	import SecuritySettings from './SecuritySettings.svelte';

	const wb = getWorkbenchContext();

	const surfaceVersion = __SURFACE_VERSION__;
	const versionQuery = createQuery(() => ({
		queryKey: settingsKeys.version(),
		queryFn: fetchSpineVersion,
		enabled: browser
	}));

	// Resizable drawer width, persisted across sessions.
	const MIN_WIDTH = 320;
	const MAX_WIDTH = 900;
	const WIDTH_KEY = 'lattice:settings-width';
	let width = $state(360);

	$effect(() => {
		if (!browser) return;
		const saved = Number(localStorage.getItem(WIDTH_KEY));
		if (saved >= MIN_WIDTH && saved <= MAX_WIDTH) width = saved;
	});

	function startResize(e: PointerEvent) {
		const startX = e.clientX;
		const startWidth = width;
		const handle = e.currentTarget as HTMLElement;
		handle.setPointerCapture(e.pointerId);

		function move(ev: PointerEvent) {
			const next = startWidth - (ev.clientX - startX);
			width = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, next));
		}
		function up() {
			handle.releasePointerCapture?.(e.pointerId);
			window.removeEventListener('pointermove', move);
			window.removeEventListener('pointerup', up);
			if (browser) localStorage.setItem(WIDTH_KEY, String(width));
		}
		window.addEventListener('pointermove', move);
		window.addEventListener('pointerup', up);
		e.preventDefault();
	}

	const themes: Theme[] = ['light', 'dark', 'sepia', 'system'];
	const densities: Density[] = ['compact', 'comfortable', 'spacious'];
	const postures: Posture[] = ['quiet', 'standard', 'active'];
	const fonts: { id: string; label: string }[] = [
		{ id: 'Inter', label: 'Inter' },
		{ id: 'Atkinson Hyperlegible', label: 'Atkinson' },
		{ id: 'system-ui', label: 'System' }
	];

	type Tab = 'display' | 'inference' | 'security';
	let activeTab = $state<Tab>('display');

	function close() {
		wb.activeOverlay = 'none';
	}

	function onKey(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.stopPropagation();
			close();
		}
	}
</script>

<div
	class="settings-drawer soft-in"
	role="dialog"
	aria-modal="false"
	aria-label="Settings"
	tabindex="-1"
	style:--settings-width={`${width}px`}
	onkeydown={onKey}
>
	<div
		class="settings-resize"
		role="separator"
		aria-label="Resize settings panel"
		aria-orientation="vertical"
		onpointerdown={startResize}
	></div>
	<div class="settings-head">
		<div class="row" style="gap:8px">
			<Icon name="cog" size={14} />
			<span style="font-weight:500">Settings</span>
		</div>
		<button class="btn btn-ghost" onclick={close} aria-label="Close settings">
			<Icon name="x" size={14} />
		</button>
	</div>
	<div class="tab-strip" role="tablist" aria-label="Settings sections">
		<button
			role="tab"
			aria-selected={activeTab === 'display'}
			onclick={() => {
				activeTab = 'display';
			}}>Display</button
		>
		<button
			role="tab"
			aria-selected={activeTab === 'inference'}
			onclick={() => {
				activeTab = 'inference';
			}}>Inference</button
		>
		<button
			role="tab"
			aria-selected={activeTab === 'security'}
			onclick={() => {
				activeTab = 'security';
			}}>Security</button
		>
	</div>
	<div class="settings-body">
		{#if activeTab === 'inference'}
			<InferenceSettings />
		{:else if activeTab === 'security'}
			<SecuritySettings />
		{:else}
			<section class="settings-section">
				<div class="settings-section-title faint">Theme</div>
				<div class="seg" role="group" aria-label="Theme">
					{#each themes as t (t)}
						<button
							type="button"
							aria-pressed={wb.theme === t}
							onclick={() => {
								wb.theme = t;
							}}>{t}</button
						>
					{/each}
				</div>
			</section>

			<section class="settings-section">
				<div class="settings-section-title faint">Density</div>
				<div class="seg" role="group" aria-label="Density">
					{#each densities as d (d)}
						<button
							type="button"
							aria-pressed={wb.density === d}
							onclick={() => {
								wb.density = d;
							}}>{d}</button
						>
					{/each}
				</div>
			</section>

			<section class="settings-section">
				<div class="settings-section-title faint">Reading font</div>
				<div class="seg" role="group" aria-label="Reading font">
					{#each fonts as f (f.id)}
						<button
							type="button"
							aria-pressed={wb.font === f.id}
							onclick={() => {
								wb.font = f.id;
							}}>{f.label}</button
						>
					{/each}
				</div>
			</section>

			<section class="settings-section">
				<div class="settings-section-title faint">Notification posture</div>
				<div class="seg" role="group" aria-label="Notification posture">
					{#each postures as p (p)}
						<button
							type="button"
							aria-pressed={wb.posture === p}
							onclick={() => {
								wb.posture = p;
							}}>{p}</button
						>
					{/each}
				</div>
				<p class="faint" style="font-size:12px; margin:6px 0 0">
					Quiet hides counts and resurfacing nudges entirely. Active shows them on the home view.
				</p>
			</section>

			<section class="settings-section">
				<div class="settings-section-title faint">Editor</div>
				<label class="row" style="gap:8px; cursor:pointer">
					<input
						type="checkbox"
						checked={wb.vimMode}
						onchange={(e) => {
							wb.vimMode = (e.currentTarget as HTMLInputElement).checked;
						}}
					/>
					<span>Vim mode</span>
				</label>
			</section>

			<p class="faint" style="font-size:12px; margin-top:14px">
				Lattice respects <span class="mono">prefers-reduced-motion</span>. Animations cross-fade
				only.
			</p>
		{/if}
	</div>
	<div class="settings-foot faint">
		<span>Surface v{surfaceVersion}</span>
		<span>·</span>
		<span>Spine v{versionQuery.data?.spine ?? '…'}</span>
	</div>
</div>

<style>
	.settings-resize {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 6px;
		cursor: ew-resize;
		touch-action: none;
		z-index: 1;
	}

	.settings-resize:hover {
		background: var(--accent);
		opacity: 0.4;
	}

	.settings-foot {
		display: flex;
		gap: 8px;
		align-items: center;
		padding: 8px 16px;
		border-top: 1px solid var(--line);
		font-size: 11px;
	}

	.tab-strip {
		display: flex;
		border-bottom: 1px solid var(--border);
		padding: 0 16px;
		gap: 2px;
	}

	.tab-strip button[role='tab'] {
		padding: 6px 10px;
		font-size: 12px;
		background: none;
		border: none;
		border-bottom: 2px solid transparent;
		cursor: pointer;
		color: var(--text-faint);
		margin-bottom: -1px;
	}

	.tab-strip button[role='tab'][aria-selected='true'] {
		color: var(--text);
		border-bottom-color: var(--accent);
		font-weight: 500;
	}
</style>
