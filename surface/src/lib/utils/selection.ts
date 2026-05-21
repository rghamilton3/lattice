let _pending = '';

export function attachSelectionCapture(el: HTMLElement): () => void {
	const handler = () => {
		const sel = window.getSelection();
		_pending = sel ? sel.toString().trim() : '';
	};
	el.addEventListener('mousedown', handler);
	return () => el.removeEventListener('mousedown', handler);
}

export function getPendingSelection(): string {
	return _pending;
}
