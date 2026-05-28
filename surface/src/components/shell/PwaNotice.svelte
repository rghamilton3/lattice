<script lang="ts">
	import type { PwaNoticeModel } from '$lib/pwa/types';

	let { notice }: { notice: PwaNoticeModel } = $props();
</script>

<section class="pwa-notice" data-tone={notice.tone} role="status">
	<div class="pwa-notice-copy">
		<strong>{notice.title}</strong>
		<span>{notice.message}</span>
	</div>
	<div class="pwa-notice-actions" aria-label={`${notice.title} actions`}>
		{#each notice.actions as action (action.label)}
			<button
				class={['btn', action.variant === 'primary' ? 'btn-primary' : 'btn-ghost']}
				onclick={action.onclick}
			>
				{action.label}
			</button>
		{/each}
		{#if notice.ondismiss}
			<button
				class="btn btn-ghost"
				onclick={notice.ondismiss}
				aria-label={`Dismiss ${notice.title}`}
			>
				Dismiss
			</button>
		{/if}
	</div>
</section>
