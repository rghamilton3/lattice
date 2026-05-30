import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import { WorkbenchStore } from './workbench.svelte';
import { triageCapture } from '$lib/api/captures';

// Mock triageCapture so we can simulate partial failures without hitting fetch.
vi.mock('$lib/api/captures', async () => {
	const actual = await vi.importActual<typeof import('$lib/api/captures')>('$lib/api/captures');
	return { ...actual, triageCapture: vi.fn(async () => undefined) };
});
const triageMock = vi.mocked(triageCapture);

// Vitest's `server` project runs in node, which has no DOM. The store reads
// localStorage at construction time and writes via persist(); stub it in.
beforeAll(() => {
	const store = new Map<string, string>();
	const ls: Storage = {
		get length() {
			return store.size;
		},
		clear: () => store.clear(),
		getItem: (k) => (store.has(k) ? (store.get(k) as string) : null),
		key: (i) => Array.from(store.keys())[i] ?? null,
		removeItem: (k) => {
			store.delete(k);
		},
		setItem: (k, v) => {
			store.set(k, String(v));
		}
	};
	Object.defineProperty(globalThis, 'localStorage', { value: ls, configurable: true });
});

describe('WorkbenchStore', () => {
	beforeEach(() => {
		localStorage.clear();
		triageMock.mockReset();
		triageMock.mockResolvedValue(undefined);
	});

	it('persists and rehydrates user preferences', () => {
		const a = new WorkbenchStore();
		a.theme = 'dark';
		a.density = 'compact';
		a.font = 'Atkinson Hyperlegible';
		a.posture = 'active';
		a.focusMode = true;
		a.vimMode = false;
		a.persist();

		const b = new WorkbenchStore();
		expect(b.theme).toBe('dark');
		expect(b.density).toBe('compact');
		expect(b.font).toBe('Atkinson Hyperlegible');
		expect(b.posture).toBe('active');
		expect(b.focusMode).toBe(true);
		expect(b.vimMode).toBe(false);
	});

	it('ignores corrupted persisted session data', () => {
		localStorage.setItem('lattice.session', '{not json');
		const wb = new WorkbenchStore();
		expect(wb.theme).toBe('light');
		expect(wb.density).toBe('comfortable');
		expect(wb.posture).toBe('quiet');
		expect(wb.focusMode).toBe(false);
	});

	it('ignores invalid persisted enum values while keeping valid booleans', () => {
		localStorage.setItem(
			'lattice.session',
			JSON.stringify({
				theme: 'neon',
				density: 'microscopic',
				font: '',
				posture: 'urgent',
				focusMode: true,
				vimMode: false
			})
		);
		const wb = new WorkbenchStore();
		expect(wb.theme).toBe('light');
		expect(wb.density).toBe('comfortable');
		expect(wb.font).toBe('Inter');
		expect(wb.posture).toBe('quiet');
		expect(wb.focusMode).toBe(true);
		expect(wb.vimMode).toBe(false);
	});

	it('view is derived from panes[0].kind, not persisted', () => {
		const a = new WorkbenchStore();
		expect(a.view).toBe('home');
		a.openInPane(0, { kind: 'library', query: '' });
		expect(a.view).toBe('library');
		a.openInPane(0, { kind: 'doc', ref: { kind: 'working', slug: 'x' } });
		expect(a.view).toBe('doc');
		a.persist();

		// view is not carried by persistence — fresh store defaults to home.
		const b = new WorkbenchStore();
		expect(b.view).toBe('home');
	});

	it('does not persist activeOverlay', () => {
		const a = new WorkbenchStore();
		a.activeOverlay = 'capture';
		a.persist();
		expect(new WorkbenchStore().activeOverlay).toBe('none');

		a.activeOverlay = 'triage';
		a.persist();
		expect(new WorkbenchStore().activeOverlay).toBe('none');
	});

	it('activeOverlay enforces mutual exclusion', () => {
		const wb = new WorkbenchStore();
		expect(wb.activeOverlay).toBe('none');
		expect(wb.anyOverlayOpen).toBe(false);

		wb.activeOverlay = 'capture';
		expect(wb.anyOverlayOpen).toBe(true);

		wb.activeOverlay = 'palette';
		expect(wb.anyOverlayOpen).toBe(true);

		// Triage owns the screen but is excluded from anyOverlayOpen so that
		// the Esc / bare-c handlers defer to ProcessMode's own keymap.
		wb.activeOverlay = 'triage';
		expect(wb.anyOverlayOpen).toBe(false);
	});

	it('openInPane replaces the focused pane and toggles split', () => {
		const wb = new WorkbenchStore();
		expect(wb.panes[0]).toEqual({ kind: 'home' });
		expect(wb.isSplit).toBe(false);

		wb.openInPane(0, { kind: 'library', query: 'foo' });
		expect(wb.panes[0]).toEqual({ kind: 'library', query: 'foo' });
		expect(wb.focusedPane).toBe(0);

		wb.openInPane(1, { kind: 'doc', ref: { kind: 'working', slug: 'notes' } });
		expect(wb.isSplit).toBe(true);
		expect(wb.panes[1]).toEqual({ kind: 'doc', ref: { kind: 'working', slug: 'notes' } });
		expect(wb.focusedPane).toBe(1);
	});

	it('records per-pane history and returns to the immediately previous state', () => {
		const wb = new WorkbenchStore();
		wb.openInPane(0, { kind: 'library', query: 'alpha' });
		wb.openInPane(0, { kind: 'doc', ref: { kind: 'capture', id: 1 } });
		wb.openInPane(0, { kind: 'editor', slug: 'notes' });

		wb.goBackInPane(0);
		expect(wb.panes[0]).toEqual({ kind: 'doc', ref: { kind: 'capture', id: 1 } });

		wb.goBackInPane(0);
		expect(wb.panes[0]).toEqual({ kind: 'library', query: 'alpha' });
	});

	it('preserves split-pane state when navigating back in one pane', () => {
		const wb = new WorkbenchStore();
		wb.openInPane(0, { kind: 'library', query: 'left' });
		wb.openInPane(1, { kind: 'doc', ref: { kind: 'working', slug: 'right' } });
		wb.openInPane(1, { kind: 'editor', slug: 'right' });

		wb.goBackInPane(1);

		expect(wb.panes).toEqual([
			{ kind: 'library', query: 'left' },
			{ kind: 'doc', ref: { kind: 'working', slug: 'right' } }
		]);
		expect(wb.focusedPane).toBe(1);
	});

	it('falls back safely when no usable previous state exists', () => {
		const wb = new WorkbenchStore();
		wb.openInPane(
			0,
			{ kind: 'doc', ref: { kind: 'capture', id: 9 } },
			{
				recordHistory: false,
				fallback: { kind: 'library', query: '' }
			}
		);

		wb.goBackInPane(0);
		expect(wb.panes[0]).toEqual({ kind: 'library', query: '' });

		wb.goBackInPane(0);
		expect(wb.panes[0]).toEqual({ kind: 'library', query: '' });
	});

	it('skips invalidated previous content before falling back', () => {
		const wb = new WorkbenchStore();
		wb.openInPane(0, { kind: 'library', query: 'alpha' });
		wb.openInPane(0, { kind: 'doc', ref: { kind: 'working', slug: 'notes' } });
		wb.openInPane(0, { kind: 'editor', slug: 'notes' });

		wb.goBackInPane(0, {
			fallback: { kind: 'library', query: '' },
			skipContent: (content) =>
				(content.kind === 'doc' &&
					content.ref.kind === 'working' &&
					content.ref.slug === 'notes') ||
				(content.kind === 'editor' && content.slug === 'notes')
		});

		expect(wb.panes[0]).toEqual({ kind: 'library', query: 'alpha' });
	});

	it('does not record duplicate history for the same archive document', () => {
		const wb = new WorkbenchStore();
		wb.openInPane(0, { kind: 'library', query: 'archives' });
		wb.openInPane(0, { kind: 'doc', ref: { kind: 'archive', id: 42 } });
		wb.openInPane(0, { kind: 'doc', ref: { kind: 'archive', id: 42 } });

		wb.goBackInPane(0);

		expect(wb.panes[0]).toEqual({ kind: 'library', query: 'archives' });
	});

	it('does not persist transient back history or fallback metadata', () => {
		const a = new WorkbenchStore();
		a.setBackFallback(0, { kind: 'library', query: '' });
		a.openInPane(0, { kind: 'library', query: 'alpha' });
		a.openInPane(0, { kind: 'doc', ref: { kind: 'capture', id: 1 } });
		a.persist();

		const b = new WorkbenchStore();
		b.goBackInPane(0);
		expect(b.panes[0]).toEqual({ kind: 'home' });
	});

	it('closeRightPane collapses to single pane and refocuses left', () => {
		const wb = new WorkbenchStore();
		wb.openInPane(1, { kind: 'library', query: 'x' });
		expect(wb.isSplit).toBe(true);
		wb.closeRightPane();
		expect(wb.isSplit).toBe(false);
		expect(wb.focusedPane).toBe(0);
	});

	it('clears right-pane back state before a later split-pane session', () => {
		const wb = new WorkbenchStore();
		wb.setBackFallback(1, { kind: 'library', query: 'stale' });
		wb.openInPane(1, { kind: 'library', query: 'old' });
		wb.openInPane(1, { kind: 'doc', ref: { kind: 'capture', id: 1 } });

		wb.closeRightPane();
		wb.openInPane(1, { kind: 'tasks' });
		wb.goBackInPane(1);

		expect(wb.panes[1]).toEqual({ kind: 'home' });
	});

	it('startTriage takes over the overlay; exitTriage fires API calls', async () => {
		const wb = new WorkbenchStore();
		wb.activeOverlay = 'capture';
		wb.startTriage();
		expect(wb.activeOverlay).toBe('triage');

		await wb.exitTriage([
			{ id: 10, action: 'keep' },
			{ id: 11, action: 'archive' }
		]);
		expect(wb.activeOverlay).toBe('none');
		expect(triageMock).toHaveBeenCalledWith(10, 'keep');
		expect(triageMock).toHaveBeenCalledWith(11, 'archive');
	});

	it('postureView reflects current posture', () => {
		const wb = new WorkbenchStore();
		wb.posture = 'quiet';
		expect(wb.postureView.showCounts).toBe(false);
		expect(wb.postureView.showResurfaced).toBe(false);
		expect(wb.postureView.showReviewHint).toBe(false);
		expect(wb.postureView.allowBackgroundToasts).toBe(false);

		wb.posture = 'standard';
		expect(wb.postureView.showCounts).toBe(true);
		expect(wb.postureView.showResurfaced).toBe(true);
		expect(wb.postureView.showReviewHint).toBe(false);

		wb.posture = 'active';
		expect(wb.postureView.showReviewHint).toBe(true);
	});

	it('showToast respects posture for background toasts', () => {
		const wb = new WorkbenchStore();
		wb.posture = 'quiet';
		wb.showToast('hidden', { background: true });
		expect(wb.toast).toBeNull();

		wb.showToast('visible');
		expect(wb.toast?.msg).toBe('visible');
	});

	it('exitTriage surfaces a failure count when triageCapture rejects', async () => {
		triageMock.mockImplementation(async (id: number) => {
			if (id === 11 || id === 14) throw new Error('boom');
		});

		const wb = new WorkbenchStore();
		await wb.exitTriage([
			{ id: 10, action: 'keep' },
			{ id: 11, action: 'keep' },
			{ id: 12, action: 'keep' },
			{ id: 13, action: 'keep' },
			{ id: 14, action: 'keep' }
		]);
		expect(wb.toast?.msg).toBe('5 processed, 2 failed');
	});

	it('exitTriage shows plain success toast when all calls succeed', async () => {
		const wb = new WorkbenchStore();
		await wb.exitTriage([
			{ id: 20, action: 'archive' },
			{ id: 21, action: 'archive' }
		]);
		expect(wb.toast?.msg).toBe('2 processed');
	});
});
