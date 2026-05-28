# Quickstart: Surface PWA

## Prerequisites

- Spine and Surface can run locally with the existing monorepo commands.
- For installability checks, use a browser and origin that support PWA installation. Production-like HTTPS behind Caddy/Authentik is the target; localhost may support development checks in Chromium.

## Development Loop

1. From the repository root, start the app with `just dev` or run spine and Surface using the existing component commands.
2. From `surface/`, run `bun run check` after PWA code changes.
3. From `surface/`, run targeted unit tests with `bun run test:unit -- --run`.
4. Run `bun run build` from `surface/` to verify static output includes PWA assets and service worker build output.
5. Run `just check` before marking implementation complete.

## Manual Install Verification

1. Open Surface in a supported browser.
2. Confirm the browser reports the app as installable.
3. Install Surface.
4. Close normal browser tabs for Surface.
5. Launch Surface from the operating system app entry.
6. Confirm the workbench shell appears and primary navigation/capture/search entry points are reachable.
7. Open a known valid Surface deep link in both browser-tab and installed-app contexts and confirm the same destination appears.

## Manual Degraded Shell Verification

1. Load Surface successfully at least once so app-shell assets are available.
2. Stop or block the live service path used by Surface.
3. Relaunch or reload the installed app.
4. Confirm the app shell appears instead of a blank page.
5. Confirm the degraded state explains the unavailable condition in text and offers retry or reload.
6. Restore the service path.
7. Use the recovery action and confirm Surface returns to normal use without reinstalling or clearing browser storage.

## Manual Update Verification

1. Load or install Surface from one build.
2. Deploy or serve a newer build through the normal static serving path.
3. Reopen or refresh the installed app.
4. Confirm the app reaches the new version through normal user action.
5. While editing text or interacting with an overlay, confirm update messaging does not steal focus or force an unexpected reload.

## Accessibility Evidence

Create or update `docs/accessibility/surface-pwa.md` with:

- Install/launch control labels and keyboard reachability.
- Degraded/offline/update text and non-color-only state evidence.
- Focus behavior for prompts and recovery actions.
- Narrow viewport and 200% zoom notes.
- Reduced-motion notes.
- Icon/theme/background contrast notes for launch surfaces.
- Bilingual delivery N/A rationale: Surface remains English-only and no translation resources are part of this milestone.

## Out Of Scope Checks

- Do not verify push notifications; they are out of scope.
- Do not verify background sync; it is out of scope.
- Do not verify full offline reading/search/editing of protected knowledge content; the planned cache is app-shell-only.

## Implementation Validation Results

- `cd surface && bun run build`: PASS. Static output wrote `build/`, included `manifest.webmanifest`, `pwa-icon.svg`, and generated `service-worker.js`.
- `cd surface && bun run check`: PASS. `svelte-check` reported 0 errors and 0 warnings.
- `cd surface && bun run test:unit -- --run`: PASS. 7 test files and 37 tests passed.
- `cd surface && bun run test:e2e`: PASS. 17 Playwright tests passed. Playwright reported missing optional host dependencies (`libxml2`, `libflite1`) while still completing with the fallback browser build.
- `just check`: PASS. Spine TypeScript validation and Surface check completed successfully.
- Dependency/security review: PASS. `surface/package.json` has no new runtime dependency, no Workbox/Vite PWA plugin, and no push notification or background sync package; source search found no Workbox, Vite PWA plugin, push, or background sync usage.
- Service worker contract review: PASS. `surface/src/service-worker.ts` uses a versioned app-shell cache, removes obsolete shell caches, ignores non-GET/cross-origin `/api/*` requests, avoids protected content caching, and uses network-first navigation fallback to the cached SPA shell.
