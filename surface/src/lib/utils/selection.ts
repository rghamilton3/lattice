export function getPendingSelection(): string {
	return window.getSelection()?.toString().trim() ?? '';
}

export interface ReadingSelection {
	text: string;
	start: number | null;
	end: number | null;
}

function nodeOffsetWithin(root: Node, target: Node, offset: number): number | null {
	const range = document.createRange();
	range.selectNodeContents(root);
	try {
		range.setEnd(target, offset);
		return range.toString().length;
	} catch {
		return null;
	} finally {
		range.detach();
	}
}

export function getReadingSelection(container: HTMLElement | null): ReadingSelection | null {
	const selection = window.getSelection();
	const rawText = selection?.toString() ?? '';
	const text = rawText.trim();
	if (!selection || selection.rangeCount === 0 || !text) return null;
	const range = selection.getRangeAt(0);
	if (!container?.contains(range.commonAncestorContainer)) {
		return { text, start: null, end: null };
	}
	const rawStart = nodeOffsetWithin(container, range.startContainer, range.startOffset);
	const rawEnd = nodeOffsetWithin(container, range.endContainer, range.endOffset);
	if (rawStart === null || rawEnd === null) return { text, start: null, end: null };
	const leadingTrim = rawText.length - rawText.trimStart().length;
	return { text, start: rawStart + leadingTrim, end: rawStart + leadingTrim + text.length };
}
