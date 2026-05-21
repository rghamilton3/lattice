<script lang="ts">
	import { getWorkbenchContext } from '$lib/state/workbench.svelte';

	const wb = getWorkbenchContext();
</script>

<button
	class="btn btn-ghost"
	style="font-size:12px; padding:4px 8px"
	aria-pressed={wb.vimMode}
	title="Toggle vim mode (Ctrl+Alt+V)"
	onclick={() => wb.toggleVim()}
>
	vim {wb.vimMode ? 'on' : 'off'}
</button>
