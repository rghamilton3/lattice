<script lang="ts">
	import { getWorkbenchContext } from '$lib/state/workbench.svelte';

	const wb = getWorkbenchContext();
	const vimModeLabel = $derived(`Vim mode: ${wb.vimMode ? 'on' : 'off'}`);
</script>

<button
	class="btn btn-ghost"
	style="font-size:12px; padding:4px 8px"
	aria-pressed={wb.vimMode}
	aria-label={`${vimModeLabel}. Toggle Vim mode`}
	title="Toggle Vim mode (Ctrl+Alt+V)"
	onclick={() => wb.toggleVim()}
>
	{vimModeLabel}
</button>
