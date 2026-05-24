import { getContext, setContext } from 'svelte';
import type { PaneContent, SearchResult } from '$lib/types';
import { triageCapture, type TriageAction } from '$lib/api/captures';
import { fetchSearch } from '$lib/api/search';
import { ApiError } from '$lib/api/client';
import { logError } from '$lib/utils/logError';
import { env } from '$env/dynamic/public';

function flagFromEnv(name: `PUBLIC_${string}`, fallback: boolean): boolean {
	const raw = env[name];
	if (raw == null) return fallback;
	return raw !== 'false' && raw !== '0';
}

const WORKBENCH_KEY = Symbol('workbench');
const STORAGE_KEY = 'lattice.session';

export type Theme = 'light' | 'dark' | 'sepia' | 'system';
export type Density = 'compact' | 'comfortable' | 'spacious';
export type Posture = 'quiet' | 'standard' | 'active';
export type View = 'home' | 'doc' | 'library' | 'tasks';
export type ActiveOverlay =
	| 'none'
	| 'capture'
	| 'palette'
	| 'settings'
	| 'newDoc'
	| 'triage'
	| 'newTask'
	| 'fileUpload';

const THEMES: readonly Theme[] = ['light', 'dark', 'sepia', 'system'];
const DENSITIES: readonly Density[] = ['compact', 'comfortable', 'spacious'];
const POSTURES: readonly Posture[] = ['quiet', 'standard', 'active'];

export interface FeatureFlags {
	resurfacing: boolean;
	clusters: boolean;
	relatedRail: boolean;
	triage: boolean;
}

export interface TriageDecision {
	id: number;
	action: TriageAction;
}

export interface Toast {
	id: number;
	msg: string;
	onclick?: () => void;
}

export type DeepSearchState =
	| { q: string; status: 'running' }
	| { q: string; status: 'done'; results: SearchResult[] }
	| { q: string; status: 'error'; error: string };

interface PersistedSession {
	theme?: Theme;
	density?: Density;
	font?: string;
	posture?: Posture;
	focusMode?: boolean;
	vimMode?: boolean;
}

export class WorkbenchStore {
	panes = $state<[PaneContent] | [PaneContent, PaneContent]>([{ kind: 'home' }]);
	focusedPane = $state<0 | 1>(0);
	vimMode = $state(true);

	theme = $state<Theme>('light');
	density = $state<Density>('comfortable');
	font = $state('Inter');
	posture = $state<Posture>('quiet');
	focusMode = $state(false);

	// One overlay (or fullscreen mode) owns the screen at a time. Mutually
	// exclusive by construction — assign directly, no manual sync needed.
	// All persisted fields auto-save via +layout.svelte's $effect; never call
	// persist() from components.
	activeOverlay = $state<ActiveOverlay>('none');
	// Text carried from QuickCapture when switching to the file upload overlay.
	fileUploadInitialNote = $state('');

	// TODO(spine): Resurfaced / clusters / triage need backing endpoints.
	// Resurfaced renders hardcoded mock data when on — default off until
	// /api/resurfaced ships. Env-overridable via PUBLIC_LATTICE_FEATURE_*.
	featureFlags = $state<FeatureFlags>({
		resurfacing: flagFromEnv('PUBLIC_LATTICE_FEATURE_RESURFACING', false),
		clusters: flagFromEnv('PUBLIC_LATTICE_FEATURE_CLUSTERS', false),
		relatedRail: flagFromEnv('PUBLIC_LATTICE_FEATURE_RELATED_RAIL', true),
		triage: flagFromEnv('PUBLIC_LATTICE_FEATURE_TRIAGE', true)
	});
	toast = $state<Toast | null>(null);
	deepSearch = $state<DeepSearchState | null>(null);

	isSplit = $derived(this.panes.length === 2);

	// Nav highlight follows the focused pane's content. `doc`/`editor`/`results`
	// fall through to `'doc'` — neither Home nor Library nor Tasks highlights.
	view = $derived.by<View>(() => {
		const kind = this.panes[0].kind;
		if (kind === 'home') return 'home';
		if (kind === 'library') return 'library';
		if (kind === 'tasks') return 'tasks';
		return 'doc';
	});

	// Derived posture surface — every section reads from here so the three
	// modes (quiet / standard / active) stay coherent.
	//   quiet    — no counts, no resurfaced rail, no background toasts
	//   standard — counts + resurfaced visible
	//   active   — also surfaces a "needs review" hint on the greeting
	postureView = $derived({
		showCounts: this.posture !== 'quiet',
		showResurfaced: this.posture !== 'quiet',
		showReviewHint: this.posture === 'active',
		allowBackgroundToasts: this.posture !== 'quiet'
	});

	private toastTimer: ReturnType<typeof setTimeout> | null = null;
	private toastSeq = 0;

	constructor() {
		if (typeof localStorage === 'undefined') return;
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (!raw) return;
			const s = JSON.parse(raw) as PersistedSession;
			if (s.theme && (THEMES as readonly string[]).includes(s.theme)) this.theme = s.theme;
			if (s.density && (DENSITIES as readonly string[]).includes(s.density))
				this.density = s.density;
			if (typeof s.font === 'string' && s.font) this.font = s.font;
			if (s.posture && (POSTURES as readonly string[]).includes(s.posture))
				this.posture = s.posture;
			if (typeof s.focusMode === 'boolean') this.focusMode = s.focusMode;
			if (typeof s.vimMode === 'boolean') this.vimMode = s.vimMode;
		} catch (err) {
			// corrupted state — keep defaults
			logError('workbench:rehydrate', err);
		}
	}

	persist() {
		if (typeof localStorage === 'undefined') return;
		const data: PersistedSession = {
			theme: this.theme,
			density: this.density,
			font: this.font,
			posture: this.posture,
			focusMode: this.focusMode,
			vimMode: this.vimMode
		};
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
		} catch (err) {
			// QuotaExceededError, Safari private mode, etc. — don't throw inside
			// reactive paths; just log.
			logError('workbench:persist', err);
		}
	}

	openInPane(index: 0 | 1, content: PaneContent) {
		if (index === 0) {
			this.panes = this.isSplit
				? ([content, this.panes[1]] as [PaneContent, PaneContent])
				: ([content] as [PaneContent]);
		} else {
			this.panes = [this.panes[0], content];
		}
		this.focusedPane = index;
	}

	openInOther(currentPane: 0 | 1, content: PaneContent) {
		this.openInPane(currentPane === 0 ? 1 : 0, content);
	}

	closeRightPane() {
		this.panes = [this.panes[0]];
		if (this.focusedPane === 1) this.focusedPane = 0;
	}

	toggleVim() {
		this.vimMode = !this.vimMode;
	}

	// Triage is intentionally excluded — bare-`c` and Esc handlers must not
	// fire during triage. The global keymap early-returns when activeOverlay
	// is 'triage', so this gate is for the popover overlays only.
	anyOverlayOpen = $derived(this.activeOverlay !== 'none' && this.activeOverlay !== 'triage');

	startTriage() {
		this.activeOverlay = 'triage';
	}

	async exitTriage(decisions: TriageDecision[]): Promise<void> {
		this.activeOverlay = 'none';
		if (decisions.length === 0) return;
		const settled = await Promise.allSettled(decisions.map((d) => triageCapture(d.id, d.action)));
		const failed = settled.filter((s) => s.status === 'rejected').length;
		if (failed > 0) {
			this.showToast(`${decisions.length} processed, ${failed} failed`);
		} else {
			this.showToast(`${decisions.length} processed`);
		}
	}

	// `background` toasts are suppressed in quiet posture — see postureView.
	// User-initiated actions (capture, triage) leave it unset so they always fire.
	showToast(msg: string, opts: { background?: boolean; onclick?: () => void } = {}) {
		if (opts.background && !this.postureView.allowBackgroundToasts) return;
		const id = ++this.toastSeq;
		this.toast = { id, msg, onclick: opts.onclick };
		if (this.toastTimer) clearTimeout(this.toastTimer);
		// Clickable toasts stay longer so the user has time to act on them.
		this.toastTimer = setTimeout(
			() => {
				if (this.toast?.id === id) this.toast = null;
			},
			opts.onclick ? 5000 : 2600
		);
	}

	async runDeepSearch(q: string) {
		if (this.deepSearch?.status === 'running') return;
		this.deepSearch = { q, status: 'running' };
		try {
			const data = await fetchSearch(q, true);
			this.deepSearch = { q, status: 'done', results: data.results };
			const count = data.results.length;
			const label = count === 1 ? '1 result' : `${count} results`;
			this.showToast(`Deep search: ${label} for "${q}"`, {
				onclick: () => this.openInPane(0, { kind: 'library', query: q })
			});
		} catch (e) {
			const httpStatus = e instanceof ApiError ? e.status : 0;
			const detail = httpStatus >= 500 ? 'search index may be unavailable' : 'please try again';
			this.deepSearch = { q, status: 'error', error: String(e) };
			logError('deepSearch', e);
			this.showToast(`Deep search failed for "${q}" — ${detail}`);
		}
	}

	dismissToast() {
		this.toast = null;
	}
}

export function setWorkbenchContext(store: WorkbenchStore) {
	setContext(WORKBENCH_KEY, store);
}

export function getWorkbenchContext(): WorkbenchStore {
	return getContext<WorkbenchStore>(WORKBENCH_KEY);
}
