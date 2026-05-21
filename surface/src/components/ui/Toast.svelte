<script lang="ts">
	import { getWorkbenchContext } from '$lib/state/workbench.svelte';

	const wb = getWorkbenchContext();
</script>

{#if wb.toast}
	<div class="toast" role="status" aria-live="polite">{wb.toast.msg}</div>
{/if}
