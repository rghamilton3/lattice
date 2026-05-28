import type { PwaDisplayMode, PwaNetworkState } from './types';

export function detectDisplayMode(
	win: Pick<Window, 'matchMedia'> | undefined = safeWindow()
): PwaDisplayMode {
	if (!win?.matchMedia) return 'unknown';
	try {
		return win.matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser';
	} catch {
		return 'unknown';
	}
}

export function detectNetworkState(
	nav: Pick<Navigator, 'onLine'> | undefined = safeNavigator()
): PwaNetworkState {
	if (!nav || typeof nav.onLine !== 'boolean') return 'unknown';
	return nav.onLine ? 'online' : 'offline';
}

export function isActiveTextEntry(
	element: Element | null | undefined = safeActiveElement()
): boolean {
	if (!element) return false;
	const tag = element.tagName.toLowerCase();
	if (tag === 'textarea' || tag === 'select') return true;
	if (tag === 'input') {
		const input = element as HTMLInputElement;
		return ![
			'button',
			'checkbox',
			'color',
			'file',
			'hidden',
			'image',
			'radio',
			'range',
			'reset',
			'submit'
		].includes(input.type);
	}
	return 'isContentEditable' in element && element.isContentEditable === true;
}

function safeWindow(): Window | undefined {
	return typeof window === 'undefined' ? undefined : window;
}

function safeNavigator(): Navigator | undefined {
	return typeof navigator === 'undefined' ? undefined : navigator;
}

function safeActiveElement(): Element | null | undefined {
	return typeof document === 'undefined' ? undefined : document.activeElement;
}
