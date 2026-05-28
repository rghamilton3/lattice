import { getContext, setContext } from 'svelte';
import { browser } from '$app/environment';
import { detectDisplayMode, detectNetworkState, isActiveTextEntry } from '$lib/pwa/browserState';
import { readInstallDismissed, writeInstallDismissed } from '$lib/pwa/installPreference';
import type {
	BeforeInstallPromptEvent,
	DegradedKind,
	PwaDisplayMode,
	PwaNetworkState,
	PwaServiceState,
	PwaUpdateState
} from '$lib/pwa/types';

const PWA_KEY = Symbol('pwa');

type ServiceWorkerContainerLike = Pick<
	ServiceWorkerContainer,
	'addEventListener' | 'controller' | 'getRegistration'
>;

export class PwaRuntimeState {
	#initialized = false;
	#registration: ServiceWorkerRegistration | null = null;

	installEvent = $state<BeforeInstallPromptEvent | null>(null);
	installDismissed = $state(readInstallDismissed());
	displayMode = $state<PwaDisplayMode>('unknown');
	networkState = $state<PwaNetworkState>('unknown');
	serviceState = $state<PwaServiceState>('unknown');
	updateState = $state<PwaUpdateState>('unknown');
	activeTextEntry = $state(false);
	lastCheckedAt = $state<number | null>(null);

	installAvailable = $derived(
		this.installEvent !== null && !this.installDismissed && this.displayMode !== 'standalone'
	);
	installUnsupported = $derived(
		this.installEvent === null && this.displayMode === 'browser' && !this.installDismissed
	);
	degradedKind = $derived.by<DegradedKind | null>(() => {
		if (this.networkState === 'offline') return 'offline';
		if (this.serviceState === 'authorization-required') return 'authorization-required';
		if (this.serviceState === 'missing-resource') return 'missing-resource';
		if (this.serviceState === 'unavailable') return 'service-unavailable';
		return null;
	});
	showUpdateNotice = $derived(
		(this.updateState === 'available' ||
			this.updateState === 'pending' ||
			this.updateState === 'failed') &&
			!this.activeTextEntry
	);

	constructor() {
		this.refreshBrowserState();
	}

	initialize(serviceWorker?: ServiceWorkerContainerLike) {
		if (this.#initialized) return;
		this.#initialized = true;
		const container =
			serviceWorker ?? (browser && 'serviceWorker' in navigator ? navigator.serviceWorker : null);
		if (!container) return;
		this.updateState = container.controller ? 'current' : 'unknown';

		container.addEventListener('controllerchange', () => {
			this.updateState = 'available';
		});

		container
			.getRegistration()
			.then((registration) => {
				if (!registration) return;
				this.#registration = registration;
				if (registration.waiting) this.updateState = 'pending';
				registration.addEventListener('updatefound', () => {
					const worker = registration.installing;
					if (!worker) return;
					worker.addEventListener('statechange', () => {
						if (worker.state === 'installed')
							this.updateState = container.controller ? 'pending' : 'current';
						if (worker.state === 'redundant') this.updateState = 'failed';
					});
				});
			})
			.catch(() => {
				this.updateState = 'failed';
			});
	}

	refreshBrowserState() {
		this.displayMode = detectDisplayMode();
		this.networkState = detectNetworkState();
		this.activeTextEntry = isActiveTextEntry();
	}

	refreshActiveTextEntry() {
		this.activeTextEntry = isActiveTextEntry();
	}

	captureInstallEvent(event: Event) {
		event.preventDefault();
		this.installEvent = event as BeforeInstallPromptEvent;
		this.displayMode = detectDisplayMode();
	}

	async promptInstall() {
		if (!this.installEvent) return;
		const promptEvent = this.installEvent;
		this.installEvent = null;
		await promptEvent.prompt();
		const choice = await promptEvent.userChoice;
		if (choice.outcome === 'dismissed') this.dismissInstall();
	}

	dismissInstall() {
		this.installDismissed = true;
		writeInstallDismissed(true);
	}

	markInstalled() {
		this.installEvent = null;
		this.installDismissed = true;
		this.displayMode = 'standalone';
		writeInstallDismissed(true);
	}

	setNetworkState(online: boolean) {
		this.networkState = online ? 'online' : 'offline';
		if (online && this.serviceState === 'unknown') this.serviceState = 'live';
		this.lastCheckedAt = Date.now();
	}

	classifyServiceError(status: number | null | undefined) {
		if (status === 401 || status === 403) this.serviceState = 'authorization-required';
		else if (status === 404) this.serviceState = 'missing-resource';
		else if (status && status >= 500) this.serviceState = 'unavailable';
		else this.serviceState = 'unavailable';
		this.lastCheckedAt = Date.now();
	}

	markServiceLive() {
		this.serviceState = 'live';
		this.lastCheckedAt = Date.now();
	}

	retry() {
		this.refreshBrowserState();
		window.location.reload();
	}

	returnHome() {
		window.location.assign('/');
	}

	reauthenticate() {
		window.location.reload();
	}

	requestUpdateActivation() {
		this.#registration?.waiting?.postMessage({ type: 'SKIP_WAITING' });
	}

	reloadForUpdate() {
		this.requestUpdateActivation();
		window.location.reload();
	}
}

export function setPwaContext(store: PwaRuntimeState) {
	setContext(PWA_KEY, store);
}

export function getPwaContext(): PwaRuntimeState {
	return getContext<PwaRuntimeState>(PWA_KEY);
}
