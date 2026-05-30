<script lang="ts">
	import { Marked, type Token } from 'marked';
	import markedKatex from 'marked-katex-extension';
	import DOMPurify from 'dompurify';
	import { onMount } from 'svelte';

	const { content, onRenderError }: { content: string; onRenderError?: (error: unknown) => void } =
		$props();

	let html = $state('');
	let mermaidInitialized = false;
	let uid = 0;
	let renderSeq = 0;

	onMount(() => {
		if (document.getElementById('katex-css')) return;
		const link = document.createElement('link');
		link.id = 'katex-css';
		link.rel = 'stylesheet';
		link.href = 'https://cdn.jsdelivr.net/npm/katex@0.16/dist/katex.min.css';
		document.head.appendChild(link);
	});

	async function renderMarkdown(md: string): Promise<string> {
		// Local non-reactive collection inside an async function — SvelteMap would add
		// reactivity overhead for a value that's never read from the template.
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const mermaidBlocks = new Map<string, string>();

		const instance = new Marked();
		instance.use(markedKatex({ throwOnError: false, nonStandard: true }));
		instance.use({
			async: true,
			walkTokens: async (token: Token) => {
				if (token.type === 'code' && (token as { lang?: string }).lang === 'mermaid') {
					const { default: mermaid } = await import('mermaid');
					if (!mermaidInitialized) {
						mermaid.initialize({ startOnLoad: false, theme: 'dark' });
						mermaidInitialized = true;
					}
					const id = `mermaid-${uid++}`;
					try {
						const { svg } = await mermaid.render(id, (token as { text: string }).text);
						mermaidBlocks.set(id, svg);
						(token as unknown as { mermaidId: string }).mermaidId = id;
					} catch {
						// leave as code block on render failure
					}
				}
			},
			renderer: {
				code(codeToken) {
					const t = codeToken as { lang?: string; mermaidId?: string; text: string };
					if (t.lang === 'mermaid' && t.mermaidId) {
						return mermaidBlocks.get(t.mermaidId) ?? `<pre><code>${t.text}</code></pre>`;
					}
					return false; // use default renderer
				}
			}
		});

		return (await instance.parse(md)) as string;
	}

	function escapeHtml(value: string): string {
		return value
			.replaceAll('&', '&amp;')
			.replaceAll('<', '&lt;')
			.replaceAll('>', '&gt;')
			.replaceAll('"', '&quot;')
			.replaceAll("'", '&#39;');
	}

	$effect(() => {
		const md = content;
		const seq = ++renderSeq;
		renderMarkdown(md)
			.then((result) => {
				if (seq !== renderSeq) return;
				// Allow SVG (mermaid) and MathML (KaTeX) in addition to HTML.
				html = DOMPurify.sanitize(result, {
					USE_PROFILES: { html: true, svg: true, mathMl: true }
				});
			})
			.catch((error) => {
				if (seq !== renderSeq) return;
				onRenderError?.(error);
				html = `<pre><code>${escapeHtml(md)}</code></pre>`;
			});
	});
</script>

<div class="markdown-renderer prose prose-sm h-full max-w-none overflow-y-auto p-4 prose-invert">
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html html}
</div>

<style>
	.markdown-renderer {
		overflow-wrap: anywhere;
	}

	.markdown-renderer :global(pre),
	.markdown-renderer :global(code) {
		max-width: 100%;
	}

	.markdown-renderer :global(pre) {
		overflow-x: auto;
	}

	.markdown-renderer :global(svg),
	.markdown-renderer :global(.katex-display) {
		max-width: 100%;
		overflow-x: auto;
	}

	.markdown-renderer :global(a) {
		word-break: break-word;
	}
</style>
