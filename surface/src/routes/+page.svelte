<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import WorkbenchShell from '$components/workbench/WorkbenchShell.svelte';
	import { getWorkbenchContext } from '$lib/state/workbench.svelte';
	import { parseRef } from '$lib/utils/deeplink';
	import { logError } from '$lib/utils/logError';
	import type { PaneContent } from '$lib/types';

	const wb = getWorkbenchContext();

	onMount(() => {
		const url = page.url;
		const refParam = url.searchParams.get('ref');
		const viewParam = url.searchParams.get('view');

		if (refParam) {
			const ref = parseRef(refParam);
			if (ref) {
				wb.setBackFallback(0, { kind: 'library', query: '' });
				wb.openInPane(0, { kind: 'doc', ref } satisfies PaneContent, { recordHistory: false });
				return;
			}
			logError('deeplink', refParam);
			wb.showToast('Invalid link');
		}

		// `?view=doc` without a ref has nothing to open — fall through to home.
		if (viewParam === 'home') wb.openInPane(0, { kind: 'home' });
		else if (viewParam === 'tasks') {
			wb.setBackFallback(0, { kind: 'home' });
			wb.openInPane(0, { kind: 'tasks' }, { recordHistory: false });
		} else if (viewParam === 'library' || viewParam === 'search') {
			wb.setBackFallback(0, { kind: 'home' });
			wb.openInPane(0, { kind: 'library', query: '' }, { recordHistory: false });
		}
	});
</script>

<WorkbenchShell />
