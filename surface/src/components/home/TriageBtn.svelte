<script lang="ts">
	import Icon from '$components/icons/Icon.svelte';

	type Props = {
		icon: string;
		label: string;
		kkey: string;
		onclick: () => void;
	};
	const { icon, label, kkey, onclick }: Props = $props();
</script>

<button
	class="triage-btn"
	title="{label} · {kkey}"
	onclick={(e) => {
		e.stopPropagation();
		onclick();
	}}
>
	<Icon name={icon} size={14} />
	<span class="triage-label">{label}</span>
	<span class="kbd triage-kbd">{kkey}</span>
</button>
