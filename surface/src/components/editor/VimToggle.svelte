<script lang="ts">
	import { getWorkbenchContext } from '$lib/state/workbench.svelte';

	const wb = getWorkbenchContext();
</script>

<button
	class="rounded border px-2 py-0.5 text-xs transition-colors"
	class:border-accent={wb.vimMode}
	class:text-accent={wb.vimMode}
	class:border-border={!wb.vimMode}
	class:text-text-muted={!wb.vimMode}
	title="Toggle vim mode (Ctrl+Alt+V)"
	onclick={() => wb.toggleVim()}
>
	vim {wb.vimMode ? 'on' : 'off'}
</button>
