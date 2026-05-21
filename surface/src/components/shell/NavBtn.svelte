<script lang="ts">
	import Icon from '$components/icons/Icon.svelte';

	type Props = {
		label: string;
		icon: string;
		active: boolean;
		onclick: () => void;
	};
	let { label, icon, active, onclick }: Props = $props();
</script>

<button class="nav-btn" aria-pressed={active} {onclick}>
	<Icon name={icon} size={14} />
	<span>{label}</span>
</button>
