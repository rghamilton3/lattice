# Contract: Surface PWA Runtime

This contract defines the expected user-visible and browser-facing behavior for Surface PWA runtime states.

## App Manifest Contract

Surface must expose browser-discoverable app identity metadata with these user-facing properties:

- Full app name identifies Surface/Lattice.
- Short app name is suitable for constrained launch surfaces.
- Description explains the app as the Lattice workbench.
- Start destination opens a safe workbench entry view.
- Scope keeps installed navigation inside Surface where supported.
- Display preference supports standalone installed use.
- Theme and background colors are intentional for launch/browser surfaces.
- Icons include installable launcher sizes and accessible contrast.

## Service Worker Cache Contract

The service worker may handle only safe app-shell caching:

- Cache generated app assets and static PWA files required to render the shell.
- Do not cache `/api/*` responses.
- Do not cache protected knowledge content intentionally.
- Use versioned cache names so old shell assets can be removed after activation.
- Ignore non-GET requests.
- Prefer current network responses for navigations where available.
- Fall back to cached app shell only when current shell resources are unavailable.

## Install State Contract

The Surface UI may present install state only as progressive enhancement:

- If install is available, show a clearly labeled install action.
- If install is unsupported or unavailable, normal browser use remains unchanged.
- If the user dismisses install messaging, do not repeatedly nag during the same persisted preference window.
- If already launched standalone, hide install prompts that no longer apply.

## Degraded State Contract

When Surface cannot retrieve live app content after a prior successful load:

- Render a usable shell rather than a blank page where cached shell assets exist.
- Show a text explanation of the degraded condition.
- Offer at least one recovery action such as retry or reload.
- Distinguish expired authorization from service unavailability where the app can identify the difference.
- Do not label cached or missing data as current live data without status.

## Update State Contract

When a newer app version is detected or ready:

- Prefer a visible, user-controlled reload/update action.
- Avoid stealing focus from active text entry or modal workflows.
- Recover from partial update failure with visible instructions rather than a permanent blank screen.
- Allow normal browser reload to reach the current version without manual cache clearing.

## Security Contract

- PWA installation must not bypass existing Authentik/spine authentication.
- Cached shell assets must not expose protected user content to unauthenticated users.
- Existing `/api/*` requests retain current credentials and authorization behavior.
- Service worker scope must not create a new public route for private data.
