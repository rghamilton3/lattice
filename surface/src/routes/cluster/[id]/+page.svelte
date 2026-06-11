<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import WorkbenchShell from '$components/workbench/WorkbenchShell.svelte';
	import { getWorkbenchContext } from '$lib/state/workbench.svelte';
	import { logError } from '$lib/utils/logError';

	const wb = getWorkbenchContext();

	onMount(() => {
		// Deep-link parity for clusters (018 F9): /cluster/:id opens the cluster
		// view directly, e.g. for bookmarks. A bad id falls back to home.
		const raw = page.params.id ?? '';
		const clusterId = Number(raw);
		if (Number.isInteger(clusterId) && clusterId > 0) {
			wb.openInPane(
				0,
				{ kind: 'cluster', clusterId },
				{ recordHistory: false, fallback: { kind: 'home' } }
			);
		} else {
			logError('deeplink', `cluster:${raw}`);
			wb.showToast('Invalid cluster link');
		}
	});
</script>

<WorkbenchShell />
