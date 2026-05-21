<script lang="ts">
	type Props = {
		name: string;
		size?: number;
		class?: string;
	};
	let { name, size = 16, class: klass = '' }: Props = $props();
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="1.6"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
	focusable="false"
	class={klass}
>
	{#if name === 'search'}
		<circle cx="11" cy="11" r="6.5" />
		<path d="M20 20l-3.7-3.7" />
	{:else if name === 'plus'}
		<path d="M12 5v14M5 12h14" />
	{:else if name === 'inbox'}
		<path d="M3 13l3-8h12l3 8v6H3v-6z" />
		<path d="M3 13h5l1 2h6l1-2h5" />
	{:else if name === 'doc'}
		<path d="M6 3h9l4 4v14H6z" />
		<path d="M14 3v5h5" />
	{:else if name === 'edit'}
		<path d="M4 20h4l10-10-4-4L4 16v4z" />
	{:else if name === 'home'}
		<path d="M3 11l9-7 9 7v9h-6v-6h-6v6H3z" />
	{:else if name === 'sparkle'}
		<path d="M12 4v6M12 14v6M4 12h6M14 12h6" />
		<path d="M7 7l3 3M14 14l3 3M17 7l-3 3M10 14l-3 3" />
	{:else if name === 'sim'}
		<path d="M5 7c2.5-3 5-3 7 0M5 12c2.5-3 5-3 7 0M5 17c2.5-3 5-3 7 0" />
		<path d="M12 7c2.5-3 5-3 7 0M12 12c2.5-3 5-3 7 0M12 17c2.5-3 5-3 7 0" />
	{:else if name === 'quote'}
		<path d="M6 8h5v4c0 3-2 5-5 5" />
		<path d="M14 8h5v4c0 3-2 5-5 5" />
	{:else if name === 'clock'}
		<circle cx="12" cy="12" r="8.5" />
		<path d="M12 7v5l3 2" />
	{:else if name === 'arrow-right'}
		<path d="M5 12h13M13 6l6 6-6 6" />
	{:else if name === 'split'}
		<rect x="3.5" y="4" width="17" height="16" rx="2" />
		<path d="M12 4v16" />
	{:else if name === 'x'}
		<path d="M6 6l12 12M18 6L6 18" />
	{:else if name === 'check'}
		<path d="M5 12l4 4 10-10" />
	{:else if name === 'archive'}
		<rect x="3.5" y="5" width="17" height="4" rx="1" />
		<path d="M5 9v10h14V9" />
		<path d="M10 13h4" />
	{:else if name === 'promote'}
		<path d="M12 19V5M5 12l7-7 7 7" />
	{:else if name === 'task'}
		<rect x="3.5" y="3.5" width="17" height="17" rx="3" />
		<path d="M8 12l3 3 5-6" />
	{:else if name === 'skip'}
		<path d="M5 5l8 7-8 7zM16 5v14" />
	{:else if name === 'focus'}
		<path d="M4 9V5h4M16 5h4v4M20 15v4h-4M8 19H4v-4" />
		<circle cx="12" cy="12" r="3" />
	{:else if name === 'cmd'}
		<path
			d="M9 9V6a2 2 0 1 0-2 2h10a2 2 0 1 0-2-2v3M9 15v3a2 2 0 1 1-2-2h10a2 2 0 1 1-2 2v-3M9 9h6v6H9z"
		/>
	{:else if name === 'cog'}
		<circle cx="12" cy="12" r="3" />
		<path
			d="M12 3v3M12 18v3M21 12h-3M6 12H3M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1M18.4 18.4l-2.1-2.1M7.7 7.7L5.6 5.6"
		/>
	{:else if name === 'circle'}
		<circle cx="12" cy="12" r="4" />
	{:else if name === 'mic'}
		<rect x="9" y="3.5" width="6" height="11" rx="3" />
		<path d="M6 11a6 6 0 0 0 12 0M12 17v3.5M9 20.5h6" />
	{:else if name === 'link'}
		<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
		<path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
	{:else if name === 'chev-down'}
		<path d="M6 9l6 6 6-6" />
	{:else if name === 'chev-right'}
		<path d="M9 6l6 6-6 6" />
	{/if}
</svg>
