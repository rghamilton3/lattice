<script lang="ts">
	import type { Posture } from '$lib/state/workbench.svelte';

	type Props = {
		value: Posture;
		onChange: (p: Posture) => void;
	};
	const { value, onChange }: Props = $props();

	const opts: { id: Posture; label: string; hint: string }[] = [
		{ id: 'quiet', label: 'Quiet', hint: 'no counts, no nudges' },
		{ id: 'standard', label: 'Standard', hint: 'gentle nudges' },
		{ id: 'active', label: 'Active', hint: 'show counts and reviews' }
	];
</script>

<div class="posture">
	<div class="posture-label faint">notification posture</div>
	<div class="posture-row">
		{#each opts as o (o.id)}
			<button
				class="posture-btn"
				aria-pressed={value === o.id}
				title={o.hint}
				onclick={() => onChange(o.id)}
			>
				{o.label}
			</button>
		{/each}
	</div>
</div>
