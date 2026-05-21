<script lang="ts">
	import { rawFileUrl } from '$lib/api/files';
	// ?url import so Vite resolves the path at build time but only as a URL string
	// This avoids the large worker from being in the main bundle
	import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

	const { fileId }: { fileId: number } = $props();

	let container: HTMLDivElement;
	let error = $state('');
	let loading = $state(true);

	$effect(() => {
		if (!container) return;
		loading = true;
		error = '';

		(async () => {
			try {
				const pdfjs = await import('pdfjs-dist');
				pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

				const res = await fetch(rawFileUrl(fileId));
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				const data = await res.arrayBuffer();
				const pdf = await pdfjs.getDocument({ data }).promise;

				// Remove previous canvases
				while (container.firstChild) container.removeChild(container.firstChild);

				for (let i = 1; i <= pdf.numPages; i++) {
					const page = await pdf.getPage(i);
					const viewport = page.getViewport({ scale: 1.5 });
					const canvas = document.createElement('canvas');
					canvas.width = viewport.width;
					canvas.height = viewport.height;
					canvas.className = 'mb-2 max-w-full';
					container.appendChild(canvas);
					const ctx = canvas.getContext('2d')!;
					await page.render({ canvasContext: ctx, canvas, viewport }).promise;
				}
			} catch (e) {
				error = e instanceof Error ? e.message : 'Failed to load PDF';
			} finally {
				loading = false;
			}
		})();
	});
</script>

<div class="h-full overflow-y-auto p-4">
	{#if loading}
		<p class="text-xs text-text-muted">loading pdf…</p>
	{/if}
	{#if error}
		<p class="text-xs text-red-400">{error}</p>
	{/if}
	<div bind:this={container}></div>
</div>
