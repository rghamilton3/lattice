import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { ensureSyntaxTree } from '@codemirror/language';
import { markdownDecorations } from './livePreview';

interface Deco {
	from: number;
	to: number;
	cls?: string;
	tag: 'line' | 'mark' | 'replace';
	widget?: string;
}

/** Build the live-preview decorations for `doc` with the cursor at `selection`. */
function decorate(doc: string, selection = 0): Deco[] {
	const state = EditorState.create({
		doc,
		selection: { anchor: selection },
		extensions: [markdown({ base: markdownLanguage })]
	});
	// Force a full synchronous parse so syntaxTree covers the whole document.
	ensureSyntaxTree(state, doc.length, 5000);
	return markdownDecorations(state, [{ from: 0, to: doc.length }]).map((r) => {
		const spec = r.value.spec as { class?: string; widget?: { constructor: { name: string } } };
		// CodeMirror tags decorations internally; infer the kind from the spec.
		const tag = spec.widget ? 'replace' : r.from === r.to ? 'line' : guessTag(r.value);
		return {
			from: r.from,
			to: r.to,
			cls: spec.class,
			tag,
			widget: spec.widget?.constructor.name
		};
	});
}

function guessTag(value: { spec: Record<string, unknown> }): 'line' | 'mark' | 'replace' {
	// A point decoration with neither class nor widget is a conceal (replace {}).
	if (!value.spec.class && !value.spec.widget) return 'replace';
	return 'mark';
}

function hasClass(decos: Deco[], cls: string): boolean {
	return decos.some((d) => d.cls?.split(' ').includes(cls));
}

function visibleText(doc: string, decos: Deco[], selection = 0): string {
	// Approximate the rendered text: drop ranges hidden by `replace {}` (conceal).
	const hidden = decos.filter((d) => d.tag === 'replace' && !d.widget);
	let out = '';
	for (let i = 0; i < doc.length; i++) {
		if (!hidden.some((h) => i >= h.from && i < h.to)) out += doc[i];
	}
	void selection;
	return out;
}

describe('markdownDecorations', () => {
	it('marks headings and conceals the `#` prefix when the cursor is off the line', () => {
		const doc = 'intro\n\n# Title\n';
		const decos = decorate(doc);
		expect(hasClass(decos, 'cm-lp-heading')).toBe(true);
		expect(hasClass(decos, 'cm-lp-h1')).toBe(true);
		expect(visibleText(doc, decos)).toContain('Title');
		expect(visibleText(doc, decos)).not.toContain('# Title');
	});

	it('reveals the `#` prefix when the selection is on the heading line', () => {
		const doc = '# Title\n';
		const decos = decorate(doc, 3);
		expect(visibleText(doc, decos)).toContain('# Title');
	});

	it('marks strong, emphasis, strikethrough, and inline code', () => {
		const doc = 'x\n\n**b** _i_ ~~s~~ `c`\n';
		const decos = decorate(doc);
		expect(hasClass(decos, 'cm-lp-strong')).toBe(true);
		expect(hasClass(decos, 'cm-lp-em')).toBe(true);
		expect(hasClass(decos, 'cm-lp-strike')).toBe(true);
		expect(hasClass(decos, 'cm-lp-code')).toBe(true);
	});

	it('conceals emphasis markers but reveals them under the cursor', () => {
		const doc = 'x\n\n**bold**\n';
		const off = decorate(doc, 0);
		expect(visibleText(doc, off)).toContain('bold');
		expect(visibleText(doc, off)).not.toContain('**bold**');

		const boldStart = doc.indexOf('**bold**') + 2;
		const on = decorate(doc, boldStart);
		expect(visibleText(doc, on)).toContain('**bold**');
	});

	it('renders a bullet widget for unordered list markers', () => {
		const doc = 'x\n\n- one\n- two\n';
		const decos = decorate(doc);
		const bullets = decos.filter((d) => d.widget === 'BulletWidget');
		expect(bullets.length).toBe(2);
	});

	it('renders a checkbox widget for task items and drops the list marker', () => {
		const doc = 'x\n\n- [ ] todo\n- [x] done\n';
		const decos = decorate(doc);
		const boxes = decos.filter((d) => d.widget === 'CheckboxWidget');
		expect(boxes.length).toBe(2);
		expect(hasClass(decos, 'cm-lp-task-done')).toBe(true);
	});

	it('styles blockquotes and conceals the `>` marker', () => {
		const doc = 'x\n\n> quoted\n';
		const decos = decorate(doc);
		expect(hasClass(decos, 'cm-lp-quote')).toBe(true);
		expect(visibleText(doc, decos)).toContain('quoted');
		expect(visibleText(doc, decos)).not.toContain('> quoted');
	});

	it('replaces a horizontal rule with a widget', () => {
		const doc = 'x\n\n---\n';
		const decos = decorate(doc);
		expect(decos.some((d) => d.widget === 'HrWidget')).toBe(true);
	});

	it('adds a code-block line decoration for fenced code', () => {
		const doc = 'x\n\n```\ncode\n```\n';
		const decos = decorate(doc);
		expect(hasClass(decos, 'cm-lp-codeblock')).toBe(true);
	});

	it('does not stamp the code-block class on the following line', () => {
		const doc = 'x\n\n```\ncode\n```\nafter\n';
		const decos = decorate(doc);
		// The fenced block spans 3 lines (``` / code / ```); the trailing
		// "after" line must not pick up the code-block decoration.
		const codeLines = decos.filter((d) => d.cls === 'cm-lp-codeblock');
		expect(codeLines.length).toBe(3);
	});

	it('conceals link syntax and styles the text when the cursor is away', () => {
		const doc = 'x\n\n[label](https://example.com)\n';
		const decos = decorate(doc);
		expect(hasClass(decos, 'cm-lp-link')).toBe(true);
		const text = visibleText(doc, decos);
		expect(text).toContain('label');
		expect(text).not.toContain('https://example.com');
		expect(text).not.toContain('](');
	});

	it('reveals the raw link syntax when the cursor is inside it', () => {
		const doc = '[label](https://example.com)\n';
		const decos = decorate(doc, 3);
		expect(hasClass(decos, 'cm-lp-link-raw')).toBe(true);
		expect(visibleText(doc, decos)).toContain('[label](https://example.com)');
	});

	it('conceals strikethrough markers when the cursor is away', () => {
		const doc = 'x\n\n~~gone~~\n';
		const decos = decorate(doc);
		expect(hasClass(decos, 'cm-lp-strike')).toBe(true);
		expect(visibleText(doc, decos)).toContain('gone');
		expect(visibleText(doc, decos)).not.toContain('~~');
	});

	it('replaces an image with a widget when the cursor is away', () => {
		const doc = 'x\n\n![alt text](https://example.com/i.png)\n';
		const decos = decorate(doc);
		expect(decos.some((d) => d.widget === 'ImageWidget')).toBe(true);
	});
});
