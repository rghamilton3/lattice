# Surface PWA Accessibility Evidence

## Scope

Reviewed Surface PWA installability, standalone launch metadata, app-shell degraded states, update/reload messaging, narrow viewport behavior, keyboard reachability, focus behavior, service worker cache boundaries, and PWA-specific user-facing copy.

## WCAG 2.2 AA Checks

- Keyboard operation: install, dismiss, retry, reauthenticate, home, and reload actions use native buttons and remain reachable from the app shell without custom pointer-only handlers.
- Names, roles, values: PWA notices use `role="status"`, visible titles, explicit action labels, and a dismiss button with an accessible label tied to the notice title.
- Status and errors: install, degraded, expired-auth, missing-resource, offline/service-unavailable, and update states are communicated with text; unavailable service wording does not imply user data was deleted.
- Color not alone: notice state uses visible title/message text and action labels in addition to tone styling.
- Focus behavior: notices are passive status regions and do not autofocus; update notices are suppressed during command-palette modal work and while active text entry is detected.
- Motion and responsiveness: the notice layout uses existing reduced-motion-safe styling and stacks on narrow viewports; primary navigation, capture, search, and settings controls remain reachable without page-level horizontal scrolling.
- Zoom: the notice uses wrapping text and stacked actions on small widths, supporting 200% zoom and mobile-like viewport checks.
- Contrast: manifest theme/background colors and the SVG launcher icon use dark launch surfaces with high-contrast light foreground geometry and blue node accents.

## Manual Install And Launch Evidence

- Browser discovers `/manifest.webmanifest` with name `Lattice Surface`, short name `Surface`, standalone display, root start URL/scope, theme/background colors, and the SVG icon.
- Install UI is progressive enhancement only: the install notice appears after the browser `beforeinstallprompt` signal, can be dismissed, and does not affect normal browser-tab use.
- Standalone detection hides install prompts after installed launch.
- Browser and installed contexts preserve Surface deep-link behavior; invalid deep links continue to show the existing visible status feedback.
- Unsupported browsers continue to use the normal Surface shell without a required install path.
- Narrow viewport verification covers Home, command palette/search, Capture, Settings, and passive PWA notice reachability.

## Manual Degraded/Offline Evidence

- After a successful load, simulated service unavailability renders the app shell and a recovery notice instead of a blank page.
- Offline/service failure copy states that the shell is available and live services are temporarily unreachable; it explicitly says user data has not been deleted.
- Expired-auth responses show sign-in attention wording and a reauthenticate action.
- Missing-resource responses use return-home/retry recovery without presenting cached or missing protected content as current live data.
- Service worker review confirms `/api/*`, non-GET requests, cross-origin requests, and protected knowledge content are not intentionally cached.
- Keyboard, zoom, and reduced-motion expectations use native controls, wrapping layout, and no forced animation.

## Manual Update Evidence

- Service worker controller/update state shows a passive update notice with a user-controlled Reload action.
- Failed-update state uses recovery wording that directs the user to reload without cache clearing or reinstalling.
- Active text entry suppresses update notice visibility until input focus is no longer active.
- Command palette/modal focus is preserved while an update becomes available; no reload is forced and typed text remains intact.
- Multi-window behavior remains user-controlled: each client can continue until the user chooses normal reload.

## Automated Evidence

- `surface/e2e/pwa-install.e2e.ts` covers manifest discovery, shell rendering, progressive install notice behavior, deep-link preservation, and narrow viewport reachability.
- `surface/e2e/pwa-offline.e2e.ts` covers degraded shell messaging, retry affordance, and authorization-specific recovery text.
- `surface/e2e/pwa-update.e2e.ts` covers reload affordance visibility and command-palette non-interruption.
- `surface/src/lib/pwa/pwaState.test.ts` covers install preference persistence, storage failure tolerance, display-mode detection, network detection, and text-entry detection.
- `surface/src/lib/pwa/pwaInstall.test.ts`, `pwaDegraded.test.ts`, and `pwaUpdate.test.ts` cover runtime install, degraded, and update state transitions.

## Bilingual Delivery

N/A. Surface remains English-only for this phase and no translation resources, locale negotiation, or bilingual UI contract exists. New PWA copy is English-only app-shell status text.

## Residual Risks

- Browser install prompt availability varies by browser and origin, so manual install verification must be repeated on the production-like HTTPS deployment target.
- Assistive technology announcement timing for passive `role="status"` regions can vary; notices remain visible and actionable if an announcement is missed.
- Service worker behavior depends on browser cache and update heuristics; update recovery is intentionally based on normal user reload rather than manual cache clearing.
