/**
 * Obsidian-style "Live Preview" for the CodeMirror markdown editor.
 *
 * Markdown is rendered inline while you edit: syntax markers (`**`, `#`, `>`,
 * `- `, `[ ]`, link brackets …) are concealed and the text is styled to match
 * the rendered output. The raw markers are revealed again the moment the
 * cursor/selection touches the construct, so the source is always directly
 * editable — exactly how Obsidian's Live Preview behaves.
 *
 * The implementation is decoration-only: it never mutates the document. All
 * styling lives in `livePreviewTheme` (palette-aware via CSS custom properties)
 * so it adapts to light/dark/sepia without rebuilding.
 */
import { syntaxTree } from '@codemirror/language';
import type { EditorState, Range } from '@codemirror/state';
import {
	Decoration,
	type DecorationSet,
	EditorView,
	ViewPlugin,
	type ViewUpdate,
	WidgetType
} from '@codemirror/view';
import type { SyntaxNode } from '@lezer/common';

/** True when any selection range overlaps (or is adjacent to) [from, to]. */
function selectionTouches(state: EditorState, from: number, to: number): boolean {
	for (const range of state.selection.ranges) {
		if (range.from <= to && range.to >= from) return true;
	}
	return false;
}

/** True when any selection range sits on the line containing `pos`. */
function selectionOnLine(state: EditorState, pos: number): boolean {
	const line = state.doc.lineAt(pos);
	return selectionTouches(state, line.from, line.to);
}

// ---------------------------------------------------------------------------
// Widgets
// ---------------------------------------------------------------------------

class BulletWidget extends WidgetType {
	eq() {
		return true;
	}
	toDOM() {
		const span = document.createElement('span');
		span.className = 'cm-lp-bullet';
		span.textContent = '•';
		span.setAttribute('aria-hidden', 'true');
		return span;
	}
	ignoreEvent() {
		return false;
	}
}

class CheckboxWidget extends WidgetType {
	constructor(
		readonly checked: boolean,
		readonly statusPos: number
	) {
		super();
	}
	eq(other: CheckboxWidget) {
		return other.checked === this.checked && other.statusPos === this.statusPos;
	}
	toDOM(view: EditorView) {
		const box = document.createElement('input');
		box.type = 'checkbox';
		box.className = 'cm-lp-checkbox';
		box.checked = this.checked;
		box.setAttribute('aria-label', this.checked ? 'Completed task' : 'Incomplete task');
		box.addEventListener('mousedown', (event) => event.preventDefault());
		box.addEventListener('change', () => {
			view.dispatch({
				changes: {
					from: this.statusPos,
					to: this.statusPos + 1,
					insert: this.checked ? ' ' : 'x'
				}
			});
			view.focus();
		});
		return box;
	}
	ignoreEvent() {
		return false;
	}
}

class HrWidget extends WidgetType {
	eq() {
		return true;
	}
	toDOM() {
		const hr = document.createElement('span');
		hr.className = 'cm-lp-hr';
		hr.setAttribute('aria-hidden', 'true');
		return hr;
	}
}

class ImageWidget extends WidgetType {
	constructor(
		readonly url: string,
		readonly alt: string
	) {
		super();
	}
	eq(other: ImageWidget) {
		return other.url === this.url && other.alt === this.alt;
	}
	toDOM() {
		const wrap = document.createElement('span');
		wrap.className = 'cm-lp-image';
		const img = document.createElement('img');
		img.src = this.url;
		img.alt = this.alt;
		img.loading = 'lazy';
		wrap.appendChild(img);
		return wrap;
	}
}

// ---------------------------------------------------------------------------
// Decoration building
// ---------------------------------------------------------------------------

const HEADING_LEVEL: Record<string, number> = {
	ATXHeading1: 1,
	ATXHeading2: 2,
	ATXHeading3: 3,
	ATXHeading4: 4,
	ATXHeading5: 5,
	ATXHeading6: 6,
	SetextHeading1: 1,
	SetextHeading2: 2
};

const INLINE_MARK: Record<string, { cls: string; mark: string }> = {
	StrongEmphasis: { cls: 'cm-lp-strong', mark: 'EmphasisMark' },
	Emphasis: { cls: 'cm-lp-em', mark: 'EmphasisMark' },
	Strikethrough: { cls: 'cm-lp-strike', mark: 'StrikethroughMark' }
};

function conceal(decos: Range<Decoration>[], from: number, to: number) {
	if (to > from) decos.push(Decoration.replace({}).range(from, to));
}

function handleNode(
	node: { name: string; from: number; to: number; node: SyntaxNode },
	state: EditorState,
	decos: Range<Decoration>[]
) {
	const name = node.name;

	// --- Headings -----------------------------------------------------------
	const level = HEADING_LEVEL[name];
	if (level) {
		const line = state.doc.lineAt(node.from);
		decos.push(Decoration.line({ class: `cm-lp-heading cm-lp-h${level}` }).range(line.from));
		if (name.startsWith('ATX') && !selectionTouches(state, node.from, node.to)) {
			const prefix = /^#{1,6}\s+/.exec(line.text);
			if (prefix) conceal(decos, line.from, line.from + prefix[0].length);
		}
		return;
	}

	// --- Inline emphasis / strong / strikethrough ---------------------------
	const inline = INLINE_MARK[name];
	if (inline) {
		decos.push(Decoration.mark({ class: inline.cls }).range(node.from, node.to));
		if (!selectionTouches(state, node.from, node.to)) {
			for (const m of node.node.getChildren(inline.mark)) conceal(decos, m.from, m.to);
		}
		return;
	}

	// --- Inline code --------------------------------------------------------
	if (name === 'InlineCode') {
		decos.push(Decoration.mark({ class: 'cm-lp-code' }).range(node.from, node.to));
		if (!selectionTouches(state, node.from, node.to)) {
			for (const m of node.node.getChildren('CodeMark')) conceal(decos, m.from, m.to);
		}
		return;
	}

	// --- Links --------------------------------------------------------------
	if (name === 'Link') {
		const selected = selectionTouches(state, node.from, node.to);
		decos.push(
			Decoration.mark({ class: selected ? 'cm-lp-link-raw' : 'cm-lp-link' }).range(
				node.from,
				node.to
			)
		);
		if (!selected) {
			for (const m of node.node.getChildren('LinkMark')) conceal(decos, m.from, m.to);
			for (const m of node.node.getChildren('URL')) conceal(decos, m.from, m.to);
			for (const m of node.node.getChildren('LinkTitle')) conceal(decos, m.from, m.to);
		}
		return;
	}

	// --- Images -------------------------------------------------------------
	if (name === 'Image') {
		if (!selectionTouches(state, node.from, node.to)) {
			const raw = state.doc.sliceString(node.from, node.to);
			const m = /^!\[([^\]]*)\]\(([^)\s]+)(?:\s[^)]*)?\)$/.exec(raw);
			if (m) {
				decos.push(
					Decoration.replace({ widget: new ImageWidget(m[2], m[1]) }).range(node.from, node.to)
				);
			}
		}
		return;
	}

	// --- Blockquotes --------------------------------------------------------
	if (name === 'Blockquote') {
		let pos = node.from;
		while (pos <= node.to) {
			const line = state.doc.lineAt(pos);
			decos.push(Decoration.line({ class: 'cm-lp-quote' }).range(line.from));
			pos = line.to + 1;
		}
		for (const m of node.node.getChildren('QuoteMark')) {
			if (!selectionOnLine(state, m.from)) {
				// Conceal the `>` plus a single trailing space when present.
				const after = state.doc.sliceString(m.to, m.to + 1) === ' ' ? 1 : 0;
				conceal(decos, m.from, m.to + after);
			}
		}
		return;
	}

	// --- Horizontal rule ----------------------------------------------------
	if (name === 'HorizontalRule') {
		if (!selectionTouches(state, node.from, node.to)) {
			decos.push(Decoration.replace({ widget: new HrWidget() }).range(node.from, node.to));
		}
		return;
	}

	// --- Fenced / indented code blocks --------------------------------------
	if (name === 'FencedCode' || name === 'CodeBlock') {
		let pos = node.from;
		while (pos <= node.to) {
			const line = state.doc.lineAt(pos);
			decos.push(Decoration.line({ class: 'cm-lp-codeblock' }).range(line.from));
			pos = line.to + 1;
		}
		return;
	}

	// --- List items: bullets & task checkboxes ------------------------------
	if (name === 'ListItem') {
		const listMark = node.node.getChild('ListMark');
		if (!listMark) return;
		const task = node.node.getChild('Task');
		if (task) {
			// `- [ ]` → render only a checkbox; drop the leading list marker.
			conceal(decos, listMark.from, listMark.to);
			const statusPos = task.from + 1;
			const checked = /[xX]/.test(state.doc.sliceString(statusPos, statusPos + 1));
			decos.push(
				Decoration.replace({ widget: new CheckboxWidget(checked, statusPos) }).range(
					task.from,
					task.from + 3
				)
			);
			const line = state.doc.lineAt(task.from);
			decos.push(
				Decoration.line({ class: checked ? 'cm-lp-task cm-lp-task-done' : 'cm-lp-task' }).range(
					line.from
				)
			);
		} else {
			const ch = state.doc.sliceString(listMark.from, listMark.to);
			if (ch === '-' || ch === '*' || ch === '+') {
				decos.push(
					Decoration.replace({ widget: new BulletWidget() }).range(listMark.from, listMark.to)
				);
			}
		}
		return;
	}
}

/**
 * Compute the raw live-preview decoration ranges for the given document ranges.
 * Exposed (DOM-free) so the decoration logic can be unit tested without a view.
 */
export function markdownDecorations(
	state: EditorState,
	ranges: readonly { from: number; to: number }[]
): Range<Decoration>[] {
	const decos: Range<Decoration>[] = [];
	const tree = syntaxTree(state);
	for (const { from, to } of ranges) {
		tree.iterate({
			from,
			to,
			enter: (node) => {
				handleNode(node, state, decos);
			}
		});
	}
	return decos;
}

function buildDecorations(view: EditorView): DecorationSet {
	return Decoration.set(markdownDecorations(view.state, view.visibleRanges), true);
}

const livePreviewPlugin = ViewPlugin.fromClass(
	class {
		decorations: DecorationSet;
		constructor(view: EditorView) {
			this.decorations = buildDecorations(view);
		}
		update(update: ViewUpdate) {
			if (update.docChanged || update.viewportChanged || update.selectionSet) {
				this.decorations = buildDecorations(update.view);
			}
		}
	},
	{
		decorations: (plugin) => plugin.decorations
	}
);

/** Palette-aware styling for concealed/rendered markdown constructs. */
export const livePreviewTheme = EditorView.theme({
	'.cm-lp-heading': { fontWeight: '650', lineHeight: '1.3' },
	'.cm-lp-h1': { fontSize: '1.8em' },
	'.cm-lp-h2': { fontSize: '1.5em' },
	'.cm-lp-h3': { fontSize: '1.3em' },
	'.cm-lp-h4': { fontSize: '1.15em' },
	'.cm-lp-h5': { fontSize: '1.05em' },
	'.cm-lp-h6': { fontSize: '1em', color: 'var(--text-mute)' },

	'.cm-lp-strong': { fontWeight: '700' },
	'.cm-lp-em': { fontStyle: 'italic' },
	'.cm-lp-strike': { textDecoration: 'line-through', color: 'var(--text-mute)' },

	'.cm-lp-code': {
		fontFamily: 'var(--font-mono)',
		fontSize: '0.9em',
		background: 'var(--bg-high)',
		borderRadius: '4px',
		padding: '0.1em 0.32em',
		boxDecorationBreak: 'clone'
	},

	'.cm-lp-link': { color: 'var(--c-accent)', textDecoration: 'underline', cursor: 'pointer' },
	'.cm-lp-link-raw': { color: 'var(--c-accent)' },

	'.cm-lp-quote': {
		borderLeft: '3px solid var(--line-strong)',
		paddingLeft: '1em',
		color: 'var(--text-soft)',
		fontStyle: 'italic'
	},

	'.cm-lp-codeblock': {
		background: 'var(--bg-raised)',
		fontFamily: 'var(--font-mono)',
		fontSize: '0.9em'
	},

	'.cm-lp-bullet': {
		display: 'inline-block',
		color: 'var(--text-mute)',
		fontWeight: '700'
	},

	'.cm-lp-checkbox': {
		appearance: 'auto',
		width: '1em',
		height: '1em',
		margin: '0 0.1em 0 0',
		verticalAlign: 'middle',
		cursor: 'pointer',
		accentColor: 'var(--c-accent)'
	},
	'.cm-lp-task-done': { color: 'var(--text-mute)', textDecoration: 'line-through' },

	'.cm-lp-hr': {
		display: 'inline-block',
		width: '100%',
		borderTop: '2px solid var(--line-strong)',
		verticalAlign: 'middle'
	},

	'.cm-lp-image img': {
		maxWidth: '100%',
		borderRadius: 'var(--radius-sm)'
	}
});

/** Cmd/Ctrl-click opens the link under the cursor in a new tab. */
const linkClickHandler = EditorView.domEventHandlers({
	mousedown(event, view) {
		if (!(event.metaKey || event.ctrlKey)) return false;
		const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
		if (pos == null) return false;
		let node: SyntaxNode | null = syntaxTree(view.state).resolveInner(pos, 1);
		while (node && node.name !== 'Link') node = node.parent;
		if (!node) return false;
		const url = node.getChild('URL');
		if (!url) return false;
		const href = view.state.doc.sliceString(url.from, url.to);
		window.open(href, '_blank', 'noopener,noreferrer');
		event.preventDefault();
		return true;
	}
});

/** The complete Obsidian-style Live Preview extension. */
export function livePreview() {
	return [livePreviewPlugin, livePreviewTheme, linkClickHandler];
}
