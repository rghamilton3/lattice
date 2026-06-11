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
		const trackParam = url.searchParams.get('track');

		if (refParam) {
			const ref = parseRef(refParam);
			if (ref) {
				wb.openInPane(0, { kind: 'doc', ref } satisfies PaneContent, {
					recordHistory: false,
					fallback: { kind: 'library', query: '' }
				});
				return;
			}
			logError('deeplink', refParam);
			wb.showToast('Invalid link');
		}

		// `?view=doc` without a ref has nothing to open — fall through to home.
		if (trackParam) {
			const trackId = Number.parseInt(trackParam, 10);
			if (Number.isInteger(trackId) && trackId > 0) {
				wb.openInPane(
					0,
					{ kind: 'tracking-detail', trackId },
					{ recordHistory: false, fallback: { kind: 'tracking' } }
				);
				return;
			}
			logError('tracking-deeplink', trackParam);
			wb.showToast('Invalid tracking link');
		}

		if (viewParam === 'home') wb.openInPane(0, { kind: 'home' });
		else if (viewParam === 'tasks') {
			wb.openInPane(0, { kind: 'tasks' }, { recordHistory: false, fallback: { kind: 'home' } });
		} else if (viewParam === 'tracking') {
			wb.openInPane(0, { kind: 'tracking' }, { recordHistory: false, fallback: { kind: 'home' } });
		} else if (viewParam === 'library' || viewParam === 'search') {
			wb.openInPane(
				0,
				{ kind: 'library', query: '' },
				{
					recordHistory: false,
					fallback: { kind: 'home' }
				}
			);
		}
	});
</script>

<WorkbenchShell />
