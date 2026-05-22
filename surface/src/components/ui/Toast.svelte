<script lang="ts">
	import { getWorkbenchContext } from '$lib/state/workbench.svelte';

	const wb = getWorkbenchContext();
</script>

{#if wb.toast}
	{#if wb.toast.onclick}
		<button
			class="toast toast-action"
			onclick={() => { wb.toast?.onclick?.(); wb.toast = null; }}
		>{wb.toast.msg}</button>
	{:else}
		<div class="toast" role="status" aria-live="polite">{wb.toast.msg}</div>
	{/if}
{/if}
