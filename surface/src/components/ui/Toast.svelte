<script lang="ts">
	import { getWorkbenchContext } from '$lib/state/workbench.svelte';

	const wb = getWorkbenchContext();
</script>

{#if wb.toast}
	{#if wb.toast.actions && wb.toast.actions.length > 0}
		<div class="toast toast-multi" role="status" aria-live="polite">
			<span class="toast-msg">{wb.toast.msg}</span>
			<span class="toast-btns">
				{#each wb.toast.actions as action (action.label)}
					<button
						class="btn btn-ghost btn-mini"
						onclick={() => {
							action.onclick?.();
							wb.dismissToast();
						}}>{action.label}</button
					>
				{/each}
			</span>
		</div>
	{:else if wb.toast.onclick}
		<button
			class="toast toast-action"
			onclick={() => {
				wb.toast?.onclick?.();
				wb.dismissToast();
			}}>{wb.toast.msg}</button
		>
	{:else}
		<div class="toast" role="status" aria-live="polite">{wb.toast.msg}</div>
	{/if}
{/if}
