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
	const mermaidPrefix = `mermaid-${crypto.randomUUID()}`;
	let uid = 0;
	let renderSeq = 0;
	let themeKey = $state('');

	function mermaidPalette(theme: string) {
		if (theme === 'light') {
			return {
				background: '#faf9f4',
				mainBkg: '#f1efe7',
				primaryBorderColor: '#cfcac0',
				primaryTextColor: '#252632',
				secondaryColor: '#e5e2d8',
				tertiaryColor: '#ebe8df',
				textColor: '#252632',
				lineColor: '#575967'
			};
		}
		if (theme === 'sepia') {
			return {
				background: '#f1e9d8',
				mainBkg: '#e7dcc6',
				primaryBorderColor: '#bdae90',
				primaryTextColor: '#493d2c',
				secondaryColor: '#ded0b8',
				tertiaryColor: '#e3d6bf',
				textColor: '#493d2c',
				lineColor: '#6d5a3f'
			};
		}
		return {
			background: '#181a20',
			mainBkg: '#22252d',
			primaryBorderColor: '#535762',
			primaryTextColor: '#eeece4',
			secondaryColor: '#303440',
			tertiaryColor: '#15171d',
			textColor: '#eeece4',
			lineColor: '#cbc8bf'
		};
	}

	function styleMermaidSvg(svg: string, theme: string, id: string): string {
		const palette = mermaidPalette(theme);
		const style = `<style>
#${id} .node rect,
#${id} .node polygon,
#${id} .node circle,
#${id} .node ellipse,
#${id} .node path { fill: ${palette.mainBkg} !important; stroke: ${palette.primaryBorderColor} !important; }
#${id} text,
#${id} tspan,
#${id} .label,
#${id} .nodeLabel,
#${id} .nodeLabel *,
#${id} .edgeLabel,
#${id} .edgeLabel *,
#${id} .cluster-label,
#${id} .cluster-label *,
#${id} .messageText,
#${id} .actor { color: ${palette.textColor} !important; fill: ${palette.textColor} !important; }
#${id} .edgeLabel,
#${id} .edgeLabel p,
#${id} .edgeLabel span { background: ${palette.background} !important; color: ${palette.textColor} !important; }
</style>`;
		return svg.replace(/<svg\b([^>]*)>/, `<svg$1>${style}`);
	}

	function configureMermaid(theme: string) {
		const palette = mermaidPalette(theme);
		return {
			startOnLoad: false,
			theme: 'base' as const,
			htmlLabels: false,
			themeVariables: {
				background: palette.background,
				mainBkg: palette.mainBkg,
				primaryColor: palette.mainBkg,
				primaryBorderColor: palette.primaryBorderColor,
				primaryTextColor: palette.primaryTextColor,
				secondaryColor: palette.secondaryColor,
				tertiaryColor: palette.tertiaryColor,
				textColor: palette.textColor,
				nodeTextColor: palette.textColor,
				lineColor: palette.lineColor,
				clusterBkg: palette.secondaryColor,
				clusterBorder: palette.primaryBorderColor,
				edgeLabelBackground: palette.background
			}
		};
	}

	async function renderMarkdown(md: string, theme: string): Promise<string> {
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
					const id = `${mermaidPrefix}-${theme || 'theme'}-${uid++}`;
					const source = (token as { text: string }).text;
					try {
						mermaid.initialize(configureMermaid(theme));
						const { svg } = await mermaid.render(id, source);
						mermaidBlocks.set(id, styleMermaidSvg(svg, theme, id));
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
		const theme = themeKey;
		const seq = ++renderSeq;
		renderMarkdown(md, theme)
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
		const rootEl = document.documentElement;
		themeKey = rootEl.dataset.theme ?? '';
		const observer = new MutationObserver(() => {
			themeKey = rootEl.dataset.theme ?? '';
		});
		observer.observe(rootEl, { attributes: true, attributeFilter: ['data-theme'] });
		return () => observer.disconnect();
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
		if (start < 0 || end > node.length) return;
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
	class="markdown-renderer prose prose-sm h-full max-w-none overflow-y-auto p-4"
></div>

<style>
	.markdown-renderer {
		--tw-prose-body: var(--text);
		--tw-prose-headings: var(--text);
		--tw-prose-lead: var(--text-soft);
		--tw-prose-links: var(--c-accent);
		--tw-prose-bold: var(--text);
		--tw-prose-counters: var(--text-mute);
		--tw-prose-bullets: var(--text-mute);
		--tw-prose-hr: var(--line);
		--tw-prose-quotes: var(--text);
		--tw-prose-quote-borders: var(--line-strong);
		--tw-prose-captions: var(--text-mute);
		--tw-prose-code: var(--text);
		--tw-prose-pre-code: var(--text);
		--tw-prose-pre-bg: var(--bg-raised);
		--tw-prose-th-borders: var(--line-strong);
		--tw-prose-td-borders: var(--line);
		color: var(--text);
	}

	.markdown-renderer :global(svg) {
		max-width: 100%;
	}

	.markdown-renderer :global(.label),
	.markdown-renderer :global(.nodeLabel),
	.markdown-renderer :global(.nodeLabel *),
	.markdown-renderer :global(.node foreignObject),
	.markdown-renderer :global(.node foreignObject *),
	.markdown-renderer :global(.node text),
	.markdown-renderer :global(.edgeLabel),
	.markdown-renderer :global(.edgeLabel *),
	.markdown-renderer :global(.cluster-label),
	.markdown-renderer :global(.cluster-label *),
	.markdown-renderer :global(.messageText),
	.markdown-renderer :global(.actor),
	.markdown-renderer :global(text) {
		color: var(--text) !important;
		fill: var(--text) !important;
	}

	.markdown-renderer :global(.node rect),
	.markdown-renderer :global(.node polygon),
	.markdown-renderer :global(.node circle),
	.markdown-renderer :global(.node ellipse) {
		fill: var(--bg-raised) !important;
		stroke: var(--line-strong) !important;
	}

	.markdown-renderer :global(.edgeLabel),
	.markdown-renderer :global(.edgeLabel p),
	.markdown-renderer :global(.edgeLabel span) {
		background: var(--bg) !important;
		color: var(--text) !important;
	}

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
