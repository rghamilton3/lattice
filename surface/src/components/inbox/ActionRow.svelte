<script lang="ts">
	import type { InboxAction, InboxActionDescriptor } from '$lib/types';

	interface Props {
		actions: InboxActionDescriptor[];
		onAction: (action: InboxAction) => void;
	}

	const { actions, onAction }: Props = $props();
</script>

<div class="inbox-actions">
	{#each actions as action (action.action)}
		<button
			class="triage-btn"
			data-tone={action.tone ?? 'neutral'}
			title={`${action.label} (${action.shortcut})`}
			onclick={(event) => {
				event.stopPropagation();
				onAction(action.action);
			}}
		>
			<span>{action.label}</span>
			<kbd>{action.shortcut === 'Space' ? 'space' : action.shortcut}</kbd>
		</button>
	{/each}
</div>
