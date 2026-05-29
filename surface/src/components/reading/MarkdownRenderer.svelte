<script lang="ts">
	import { Marked, type Token } from 'marked';
	import markedKatex from 'marked-katex-extension';
	import DOMPurify from 'dompurify';
	import 'katex/dist/katex.min.css';
	import type { Annotation } from '$lib/types';

	const {
		content,
		annotations = [],
		revealAnnotationId
	}: { content: string; annotations?: Annotation[]; revealAnnotationId?: string } = $props();

	let html = $state('');
	let root: HTMLDivElement | null = $state(null);
	let mermaidInitialized = false;
	let uid = 0;
	let renderSeq = 0;

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
					const source = (token as { text: string }).text;
					try {
						const { svg } = await mermaid.render(id, source);
						mermaidBlocks.set(id, svg);
						(token as unknown as { mermaidId: string }).mermaidId = id;
					} catch (error) {
						const message =
							error instanceof Error ? error.message : 'Unable to render Mermaid diagram';
						mermaidBlocks.set(
							id,
							`<figure class="mermaid-error" role="alert" tabindex="0" aria-label="Mermaid diagram error"><figcaption>Mermaid diagram could not be rendered. The markdown source is still editable.</figcaption><pre><code>${escapeHtml(message)}\n\n${escapeHtml(source)}</code></pre></figure>`
						);
						(token as unknown as { mermaidId: string }).mermaidId = id;
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
			.catch(() => {
				if (seq !== renderSeq) return;
				html = `<pre><code>${escapeHtml(md)}</code></pre>`;
			});
	});

	$effect(() => {
		const el = root;
		const rendered = html;
		const activeAnnotations = annotations;
		const revealedId = revealAnnotationId;
		if (!el) return;
		el.innerHTML = rendered;
		applyAnnotationHighlights(el, activeAnnotations, revealedId);
	});

	function applyAnnotationHighlights(
		el: HTMLElement,
		activeAnnotations: Annotation[],
		revealedId: string | undefined
	) {
		const ranges = activeAnnotations
			.filter(
				(annotation) => annotation.selection_start !== null && annotation.selection_end !== null
			)
			.sort((a, b) => (b.selection_start ?? 0) - (a.selection_start ?? 0));
		if (ranges.length === 0) return;

		const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
			acceptNode(node) {
				const parent = node.parentElement;
				if (!parent || ['SCRIPT', 'STYLE', 'SVG'].includes(parent.tagName)) {
					return NodeFilter.FILTER_REJECT;
				}
				return NodeFilter.FILTER_ACCEPT;
			}
		});
		const spans: { node: Text; start: number; end: number }[] = [];
		let offset = 0;
		let current = walker.nextNode();
		while (current) {
			const text = current.textContent ?? '';
			spans.push({ node: current as Text, start: offset, end: offset + text.length });
			offset += text.length;
			current = walker.nextNode();
		}

		for (const annotation of ranges) {
			const start = annotation.selection_start ?? 0;
			const end = annotation.selection_end ?? 0;
			for (const span of spans) {
				if (!span.node.parentNode || span.end <= start || span.start >= end) continue;
				wrapTextSegment(
					span.node,
					Math.max(0, start - span.start),
					Math.min(span.end, end) - span.start,
					annotation.id,
					annotation.id === revealedId
				);
			}
		}
	}

	function wrapTextSegment(
		node: Text,
		start: number,
		end: number,
		annotationId: string,
		revealed: boolean
	) {
		if (end <= start) return;
		const middle = node.splitText(start);
		middle.splitText(end - start);
		const mark = document.createElement('mark');
		mark.className = revealed
			? 'annotation-highlight annotation-highlight-revealed'
			: 'annotation-highlight';
		mark.dataset.annotationId = annotationId;
		middle.parentNode?.insertBefore(mark, middle);
		mark.appendChild(middle);
	}
</script>

<div
	bind:this={root}
	class="prose prose-sm h-full max-w-none overflow-y-auto p-4 prose-invert"
></div>

<style>
	:global(.annotation-highlight) {
		background: color-mix(in srgb, var(--color-accent) 28%, transparent);
		border-bottom: 2px solid var(--color-accent);
		color: inherit;
		padding: 0 2px;
	}

	:global(.annotation-highlight-revealed) {
		outline: 2px solid var(--color-accent);
		outline-offset: 2px;
	}
</style>
