// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	// Injected by Vite at build time (see vite.config.ts `define`).
	const __SURFACE_VERSION__: string;

	interface WindowEventMap {
		appinstalled: Event;
		beforeinstallprompt: Event;
	}

	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
