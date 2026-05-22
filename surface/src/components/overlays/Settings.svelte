<script lang="ts">
	import {
		getWorkbenchContext,
		type Theme,
		type Density,
		type Posture
	} from '$lib/state/workbench.svelte';
	import Icon from '$components/icons/Icon.svelte';

	const wb = getWorkbenchContext();

	const themes: Theme[] = ['light', 'dark', 'sepia', 'system'];
	const densities: Density[] = ['compact', 'comfortable', 'spacious'];
	const postures: Posture[] = ['quiet', 'standard', 'active'];
	const fonts: { id: string; label: string }[] = [
		{ id: 'Inter', label: 'Inter' },
		{ id: 'Atkinson Hyperlegible', label: 'Atkinson' },
		{ id: 'system-ui', label: 'System' }
	];

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
	onkeydown={onKey}
>
	<div class="settings-head">
		<div class="row" style="gap:8px">
			<Icon name="cog" size={14} />
			<span style="font-weight:500">Settings</span>
		</div>
		<button class="btn btn-ghost" onclick={close} aria-label="Close settings">
			<Icon name="x" size={14} />
		</button>
	</div>
	<div class="settings-body">
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
			Lattice respects <span class="mono">prefers-reduced-motion</span>. Animations cross-fade only.
		</p>
	</div>
</div>
