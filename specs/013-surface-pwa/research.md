# Research: Surface PWA

## Decision: Use SvelteKit's Native Service Worker Entry

**Decision**: Implement PWA caching through SvelteKit's `src/service-worker.ts` entry and `$service-worker` build metadata, letting SvelteKit bundle and register the worker.

**Rationale**: Surface is already a SvelteKit static SPA. SvelteKit documents first-class service worker support and exposes generated build/static asset lists plus a version string for cache names. This satisfies app-shell resilience without adding a dependency or another build plugin.

**Alternatives considered**: Workbox or Vite PWA plugin were rejected because the feature only needs conservative app-shell caching and update cleanup. Manual service worker registration was rejected unless implementation needs custom update UX beyond SvelteKit's automatic registration.

## Decision: Cache App Shell Assets Only

**Decision**: Cache generated app assets and static PWA files needed to relaunch the shell; do not cache `/api/*` responses or protected knowledge content for offline use.

**Rationale**: The spec requires a readable degraded shell, not full offline data access. Avoiding API/data caching prevents stale private content from being presented as current and preserves existing Authentik/spine boundaries.

**Alternatives considered**: Full offline search/read cache was rejected as out of scope, security-sensitive, and likely to require new data-retention and invalidation rules. Network-first API response caching was rejected because stale knowledge data is worse than explicit unavailability for this milestone.

## Decision: Treat Install UX As Progressive Enhancement

**Decision**: Provide manifest metadata and an in-app install affordance only when the browser exposes install capability; otherwise keep normal browser use fully functional with a plain unsupported/dismissed fallback.

**Rationale**: PWA install APIs vary by browser and operating system. The reliable contract is that supported browsers recognize the app as installable while unsupported environments remain usable.

**Alternatives considered**: Forcing a custom install flow was rejected because browsers own installation. Hiding all install messaging was rejected because users need a discoverable path when support exists.

## Decision: Use Explicit Update/Reload Messaging

**Decision**: Detect service worker/controller or version-update conditions where feasible and present a non-interruptive reload/update message that avoids stealing focus during active text entry or modal work.

**Rationale**: Installed web apps can stay open across deployments. A visible update path prevents stale broken versions while preserving user control.

**Alternatives considered**: Immediate forced reload was rejected because it can destroy context or input. Silent background updates only were rejected because users may keep seeing stale assets without understanding recovery.

## Decision: PWA Identity Assets Live With Surface Static Assets

**Decision**: Place manifest-linked icons and metadata in Surface's static asset path and reference them from the app document.

**Rationale**: Surface is built to static files and served by spine. Keeping PWA identity assets in Surface makes the feature self-contained and avoids new spine endpoints.

**Alternatives considered**: Generating assets at runtime from spine was rejected because it adds server coupling and no user value for a single product identity.

## Decision: Verify With Layered Manual And Automated Checks

**Decision**: Combine static checks, unit tests for any state helpers, Playwright smoke tests where browser automation can validate behavior, and manual install/offline/update verification documented in quickstart.

**Rationale**: Browser installability and OS-level launch cannot be fully validated in all CI contexts. Manual evidence is acceptable for install flows while automated checks protect regressions in metadata, degraded messaging, and shell behavior.

**Alternatives considered**: Relying only on manual testing was rejected because regressions in shell state and service worker logic are easy to miss. Requiring full cross-browser installation automation was rejected as too heavy for the single-user milestone.

## Decision: Accessibility Evidence Is Required

**Decision**: Add `docs/accessibility/surface-pwa.md` covering install/update/degraded states, keyboard access, focus behavior, non-color-only messaging, contrast, reduced motion, zoom, and bilingual N/A rationale.

**Rationale**: PWA behavior adds user-facing states outside the normal workbench flow. The A11Y governance preset requires WCAG 2.2 AA planning and evidence for affected artefacts.

**Alternatives considered**: Treating PWA metadata as non-UI was rejected because install prompts, app launch surfaces, icons, update notices, and degraded states directly affect the user experience.
