<script lang="ts">
	import type { InboxAction, InboxActionDescriptor } from '$lib/types';

	interface Props {
		actions: InboxActionDescriptor[];
		active: boolean;
		onAction: (action: InboxAction) => void;
	}

	const { actions, active, onAction }: Props = $props();

	function handleKeydown(event: KeyboardEvent) {
		if (!active) return;
		const target = event.target as HTMLElement | null;
		if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
		const match = actions.find((a) => {
			if (a.shortcut === 'Space') return event.key === ' ';
			return event.key.toLowerCase() === a.shortcut.toLowerCase();
		});
		if (!match) return;
		event.preventDefault();
		onAction(match.action);
	}
</script>

<svelte:window onkeydown={handleKeydown} />

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
