import { describe, expect, it } from 'vitest';
import { getReadingSelection } from './selection';

describe('getReadingSelection', () => {
	it('rejects selections outside the reading container', () => {
		const container = document.createElement('div');
		container.textContent = 'inside document';
		const outside = document.createElement('button');
		outside.textContent = 'outside toolbar';
		document.body.append(container, outside);

		const range = document.createRange();
		range.selectNodeContents(outside);
		const selection = window.getSelection();
		selection?.removeAllRanges();
		selection?.addRange(range);

		expect(getReadingSelection(container)).toBeNull();
		selection?.removeAllRanges();
		container.remove();
		outside.remove();
	});

	it('returns offsets for selections inside the reading container', () => {
		const container = document.createElement('div');
		container.textContent = 'inside document';
		document.body.append(container);

		const textNode = container.firstChild as Text;
		const range = document.createRange();
		range.setStart(textNode, 7);
		range.setEnd(textNode, 15);
		const selection = window.getSelection();
		selection?.removeAllRanges();
		selection?.addRange(range);

		expect(getReadingSelection(container)).toEqual({ text: 'document', start: 7, end: 15 });
		selection?.removeAllRanges();
		container.remove();
	});
});
