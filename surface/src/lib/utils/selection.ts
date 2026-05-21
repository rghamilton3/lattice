export function getPendingSelection(): string {
	return window.getSelection()?.toString().trim() ?? '';
}
