<script lang="ts">
	import './layout.css';
	import '$lib/styles/components.css';
	import '$components/home/home.css';
	import '$components/search/search.css';
	import '$components/process/process.css';
	import favicon from '$lib/assets/favicon.svg';
	import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';
	import { browser } from '$app/environment';
	import { WorkbenchStore, setWorkbenchContext } from '$lib/state/workbench.svelte';

	const { children } = $props();

	const queryClient = new QueryClient({
		defaultOptions: { queries: { enabled: browser, staleTime: 30_000 } }
	});

	const workbench = new WorkbenchStore();
	setWorkbenchContext(workbench);

	$effect(() => {
		const root = document.documentElement;
		if (workbench.theme === 'system') {
			const mql = window.matchMedia('(prefers-color-scheme: dark)');
			const apply = () => {
				root.dataset.theme = mql.matches ? 'dark' : 'light';
			};
			apply();
			mql.addEventListener('change', apply);
			return () => mql.removeEventListener('change', apply);
		}
		root.dataset.theme = workbench.theme;
	});

	$effect(() => {
		const root = document.documentElement;
		root.dataset.density = workbench.density;
		root.style.setProperty(
			'--font-ui',
			`'${workbench.font}', ui-sans-serif, system-ui, sans-serif`
		);
		// Read every persisted field so the effect re-runs on any change.
		// Centralizing persistence here lets components mutate state directly
		// without remembering to call wb.persist().
		void workbench.theme;
		void workbench.posture;
		void workbench.focusMode;
		void workbench.vimMode;
		void workbench.dismissedCaptureIds;
		workbench.persist();
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<QueryClientProvider client={queryClient}>
	{@render children()}
</QueryClientProvider>
