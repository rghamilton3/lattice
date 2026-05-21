<script lang="ts">
	import { marked, type Token } from 'marked';
	import markedKatex from 'marked-katex-extension';

	const { content }: { content: string } = $props();

	let html = $state('');
	let mermaidInitialized = false;
	let uid = 0;

	marked.use(markedKatex({ throwOnError: false, nonStandard: true }));

	// Inject katex CSS once
	function ensureKatexCss() {
		if (document.getElementById('katex-css')) return;
		const link = document.createElement('link');
		link.id = 'katex-css';
		link.rel = 'stylesheet';
		link.href = 'https://cdn.jsdelivr.net/npm/katex@0.16/dist/katex.min.css';
		document.head.appendChild(link);
	}

	async function renderMarkdown(md: string): Promise<string> {
		const mermaidBlocks = new Map<string, string>();

		const instance = marked.use({
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

		return await instance.parse(md);
	}

	$effect(() => {
		const md = content;
		ensureKatexCss();
		renderMarkdown(md).then((result) => {
			html = result;
		});
	});
</script>

<div class="prose prose-invert prose-sm max-w-none p-4 h-full overflow-y-auto">
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html html}
</div>
