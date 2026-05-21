<script lang="ts">
	import type { PaneContent } from '$lib/types';
	import SearchPane from '$components/search/SearchPane.svelte';
	import ResultList from '$components/search/ResultList.svelte';
	import ReadingPane from '$components/reading/ReadingPane.svelte';
	import EditorPane from '$components/editor/EditorPane.svelte';

	const { paneIndex, content }: { paneIndex: 0 | 1; content: PaneContent } = $props();
</script>

{#if content.kind === 'empty'}
	<div class="flex h-full items-center justify-center text-text-muted text-sm">
		<span>open something to begin</span>
	</div>
{:else if content.kind === 'search'}
	<SearchPane {paneIndex} query={content.query} />
{:else if content.kind === 'results'}
	<ResultList {paneIndex} source={content.source} />
{:else if content.kind === 'doc'}
	<ReadingPane {paneIndex} ref={content.ref} />
{:else if content.kind === 'editor'}
	<EditorPane slug={content.slug} />
{/if}
