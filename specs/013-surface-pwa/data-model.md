# Data Model: Surface PWA

## Installed Surface App

Represents the user's operating-system-visible Surface installation.

**Fields**:

- `name`: Full user-visible app name.
- `short_name`: Short launcher/home-screen label.
- `start_url`: Entry destination for installed launches.
- `scope`: Navigation scope controlled by the app.
- `display`: Preferred installed display mode.
- `theme_color`: Browser/OS UI color treatment.
- `background_color`: Launch/splash background treatment.
- `icons`: Install and launch icon set.

**Validation rules**:

- Names must clearly identify Surface/Lattice.
- Start destination must open a usable workbench entry point.
- Icons must include installable sizes appropriate for supported browsers.
- Colors and icons must satisfy accessibility evidence requirements for contrast and recognizability.

## App Shell Cache

Represents cached static resources needed to relaunch the Surface shell.

**Fields**:

- `cache_name`: Versioned cache identifier.
- `asset_urls`: Static app-shell resources included in the cache.
- `created_at`: Browser-managed cache creation timing, if observable.
- `version`: App build/version identifier used to remove obsolete caches.

**Validation rules**:

- Must not include `/api/*` responses.
- Must not intentionally include protected user content.
- Must remove obsolete versions after activation when safe.
- Must fail gracefully if browser storage is unavailable or quota-limited.

## PWA Runtime State

Represents user-facing app status surfaced in the workbench.

**Fields**:

- `install_available`: Whether the browser exposes an install opportunity.
- `install_dismissed`: Whether the user dismissed the in-app install affordance.
- `display_mode`: Browser tab, standalone, or unknown mode where observable.
- `network_state`: Online, offline, degraded, or unknown.
- `service_state`: Live service reachable, unavailable, authorization-required, or unknown.
- `update_state`: Current, update available, update pending, update failed, or unknown.

**Validation rules**:

- Unsupported install state must not block normal browser use.
- Degraded state must include text explanation and recovery action.
- Update state must avoid interrupting text entry, modal interactions, or critical user actions.
- Any persisted dismissals or preferences must tolerate corrupted storage.

## Degraded Surface Notice

Represents user-facing unavailable/recovery messaging.

**Fields**:

- `kind`: Offline, service unavailable, authorization required, stale app, missing resource, or generic degraded.
- `title`: Short visible heading.
- `message`: Plain-language explanation.
- `actions`: Retry, reload, return home, reauthenticate, or dismiss options as applicable.
- `last_checked_at`: Optional timestamp for the most recent availability check.

**Validation rules**:

- Must not imply user data was deleted unless that is known.
- Must not rely on color or icon-only meaning.
- Primary action must be keyboard reachable and visibly labeled.

## State Transitions

- `Not installable` -> `Install available` when browser exposes an install opportunity.
- `Install available` -> `Installed` when the user completes browser installation.
- `Install available` -> `Install dismissed` when the user dismisses the affordance.
- `Current` -> `Update available` when a newer app version is detected.
- `Update available` -> `Update pending` when update assets are ready but user action is needed.
- `Update pending` -> `Current` after reload or safe activation.
- `Online/live` -> `Degraded` when shell is available but live services, auth, or resources are unavailable.
- `Degraded` -> `Online/live` when retry or reload confirms recovery.
