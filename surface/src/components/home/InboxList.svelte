<script lang="ts">
	import type { Capture } from '$lib/types';
	import type { TriageAction } from '$lib/api/captures';
	import { attachmentRawUrl } from '$lib/api/attachments';
	import Icon from '$components/icons/Icon.svelte';
	import TriageBtn from './TriageBtn.svelte';
	import { relTime } from '$lib/utils/relTime';

	type Props = {
		captures: Capture[];
		now: number;
		onOpen: (id: number) => void;
		onTriage: (id: number, action: TriageAction) => void;
	};
	const { captures, now, onOpen, onTriage }: Props = $props();

	let active = $state(0);
</script>

{#if captures.length === 0}
	<div class="inbox-empty soft">
		<div style="font-size:22px; margin-bottom:6px">📭</div>
		<div style="font-weight:500">Inbox is clear.</div>
		<div class="faint" style="font-size:13px; margin-top:4px">
			Capture something the moment you think of it — sort later, or never.
		</div>
	</div>
{:else}
	<div class="inbox">
		{#each captures.slice(0, 5) as c, i (c.id)}
			<div
				class="inbox-row"
				data-active={i === active}
				data-has-thumb={c.first_image_id != null}
				role="button"
				tabindex="0"
				onmouseenter={() => (active = i)}
				onclick={() => onOpen(c.id)}
				onkeydown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						onOpen(c.id);
					}
				}}
			>
				<div class="inbox-mark">
					<Icon name="circle" size={8} />
				</div>
				<div class="inbox-body">
					<div class="inbox-text">{c.text}</div>
					<div class="inbox-meta">
						<span class="chip chip-capture">capture</span>
						<span>·</span>
						<span class="mono">{c.source}</span>
						<span>·</span>
						<span>{relTime(c.captured_at, now)}</span>
					</div>
					<div class="inbox-actions">
						<TriageBtn icon="check" label="Keep" kkey="k" onclick={() => onTriage(c.id, 'keep')} />
						<TriageBtn
							icon="archive"
							label="Archive"
							kkey="a"
							onclick={() => onTriage(c.id, 'archive')}
						/>
						<TriageBtn
							icon="promote"
							label="Promote"
							kkey="p"
							onclick={() => onTriage(c.id, 'promote')}
						/>
						<TriageBtn icon="task" label="Task" kkey="t" onclick={() => onTriage(c.id, 'task')} />
						<TriageBtn icon="skip" label="Skip" kkey="␣" onclick={() => onTriage(c.id, 'skip')} />
					</div>
				</div>
				{#if c.first_image_id != null}
					<img
						class="inbox-thumb"
						src={attachmentRawUrl(c.id, c.first_image_id)}
						alt="attachment preview"
						loading="lazy"
						onerror={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')}
					/>
				{/if}
			</div>
		{/each}
	</div>
{/if}
