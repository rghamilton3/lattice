import { describe, it, expect, afterEach } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { livePreview } from './livePreview';

let view: EditorView | null = null;

function mount(doc: string, selection = 0): EditorView {
	view = new EditorView({
		state: EditorState.create({
			doc,
			selection: { anchor: selection },
			extensions: [markdown({ base: markdownLanguage }), livePreview()]
		}),
		parent: document.body
	});
	return view;
}

afterEach(() => {
	view?.destroy();
	view = null;
});

describe('livePreview', () => {
	it('renders headings large and conceals the `#` marker when the cursor is elsewhere', () => {
		const v = mount('intro line\n\n# Title here\n');
		const heading = v.dom.querySelector('.cm-lp-heading');
		expect(heading).not.toBeNull();
		// The `# ` prefix is concealed, so the visible heading text omits it.
		expect(heading?.textContent).toBe('Title here');
	});

	it('reveals the `#` marker when the selection is on the heading line', () => {
		const v = mount('# Title here\n', 2);
		const heading = v.dom.querySelector('.cm-lp-heading');
		expect(heading?.textContent).toBe('# Title here');
	});

	it('styles bold, italic, and inline code', () => {
		const v = mount('plain\n\n**bold** _em_ `code`\n');
		expect(v.dom.querySelector('.cm-lp-strong')).not.toBeNull();
		expect(v.dom.querySelector('.cm-lp-em')).not.toBeNull();
		expect(v.dom.querySelector('.cm-lp-code')).not.toBeNull();
	});

	it('renders a bullet for unordered list items', () => {
		const v = mount('intro\n\n- first\n- second\n');
		const bullets = v.dom.querySelectorAll('.cm-lp-bullet');
		expect(bullets.length).toBe(2);
		expect(bullets[0].textContent).toBe('•');
	});

	it('renders interactive checkboxes for task list items', () => {
		const v = mount('intro\n\n- [ ] todo\n- [x] done\n');
		const boxes = v.dom.querySelectorAll<HTMLInputElement>('.cm-lp-checkbox');
		expect(boxes.length).toBe(2);
		expect(boxes[0].checked).toBe(false);
		expect(boxes[1].checked).toBe(true);
	});

	it('toggling a checkbox edits the underlying markdown', () => {
		const v = mount('intro\n\n- [ ] todo\n');
		const box = v.dom.querySelector<HTMLInputElement>('.cm-lp-checkbox');
		box?.click();
		expect(v.state.doc.toString()).toContain('- [x] todo');
	});

	it('styles blockquotes and conceals the `>` marker', () => {
		const v = mount('intro\n\n> quoted line\n');
		const quote = v.dom.querySelector('.cm-lp-quote');
		expect(quote).not.toBeNull();
		expect(quote?.textContent).toBe('quoted line');
	});
});
