/// <reference no-default-lib="true" />
/// <reference lib="esnext" />
/// <reference lib="webworker" />
/// <reference types="@sveltejs/kit" />

import { build, files, prerendered, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;
const CACHE = `lattice-surface-shell-${version}`;
const SHELL_ASSETS = [...build, ...files, ...prerendered].filter(isShellAsset);

function isShellAsset(pathname: string): boolean {
	return !pathname.startsWith('/api/') && !pathname.includes('/api/');
}

function isShellNavigation(request: Request): boolean {
	return (
		request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html') === true
	);
}

sw.addEventListener('install', (event) => {
	event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL_ASSETS)));
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(
					keys
						.filter((key) => key.startsWith('lattice-surface-shell-') && key !== CACHE)
						.map((key) => caches.delete(key))
				)
			)
			.then(() => sw.clients.claim())
	);
});

sw.addEventListener('message', (event) => {
	if (event.data?.type === 'SKIP_WAITING') void sw.skipWaiting();
});

sw.addEventListener('fetch', (event) => {
	const { request } = event;
	const url = new URL(request.url);
	if (
		request.method !== 'GET' ||
		url.origin !== sw.location.origin ||
		url.pathname.startsWith('/api/')
	)
		return;

	event.respondWith(respond(request, url));
});

async function respond(request: Request, url: URL): Promise<Response> {
	const cache = await caches.open(CACHE);
	if (SHELL_ASSETS.includes(url.pathname)) {
		const cached = await cache.match(url.pathname);
		if (cached) return cached;
	}

	if (isShellNavigation(request)) {
		try {
			const response = await fetch(request);
			if (response instanceof Response && response.ok) return response;
		} catch {
			// Fall back to the cached SPA shell below.
		}
		const shell = await cache.match('/index.html');
		if (shell) return shell;
	}

	try {
		return await fetch(request);
	} catch (error) {
		const cached = await cache.match(request);
		if (cached) return cached;
		throw error;
	}
}
