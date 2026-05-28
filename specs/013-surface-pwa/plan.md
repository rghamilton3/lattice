# Implementation Plan: Surface PWA

**Branch**: `013-surface-pwa` | **Date**: 2026-05-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/013-surface-pwa/spec.md`

## Summary

Make Surface installable and resilient as a progressive web app while preserving the current static SvelteKit SPA served by spine. The implementation adds PWA identity assets, a conservative app-shell-only service worker, visible install/update/degraded states inside the existing workbench shell, verification coverage, and accessibility evidence. Protected knowledge content remains online/auth-gated; offline behavior is limited to relaunching the shell and explaining recovery paths.

## Technical Context

**Language/Version**: TypeScript with Svelte 5/SvelteKit 2 for Surface; Bun runtime for repository commands

**Primary Dependencies**: Existing Surface stack (`@sveltejs/adapter-static`, SvelteKit automatic service worker registration, TanStack Query for server state, Tailwind CSS v4); no Workbox, Vite PWA plugin, push service, or new runtime package planned

**Storage**: Browser Cache Storage for static app shell assets only; existing browser storage for Surface preferences remains unchanged; no spine database migration

**Testing**: `cd surface && bun run check`, targeted `cd surface && bun run test:unit -- --run`, Playwright installability/offline/update smoke where feasible, `just check`, and manual PWA verification in quickstart

**Target Platform**: Existing self-hosted Lattice deployment: Surface static SPA served by spine behind Caddy/Authentik over HTTPS; supported Chromium-class desktop/mobile browsers for installability verification

**Project Type**: Frontend SPA feature within the existing full-stack monorepo

**Performance Goals**: Installed launch reaches the workbench shell in under 5 seconds on the target self-hosted environment under normal local-network conditions; degraded relaunch renders a readable shell instead of blank failure after a prior successful load

**Constraints**: No new hosted service, no new runtime dependency, no push notifications, no background sync, no offline protected-content cache, no direct database access from Surface, no auth bypass through cached assets, preserve browser-tab use and deep links

**Scale/Scope**: Single primary self-hosted user, one static Surface app, app-shell cache only, manual verification across at least one supported installable browser plus normal-browser fallback

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate Question | Pass / Violation |
|-----------|--------------|-----------------|
| I. Self-Hosting First | Does this feature add a mandatory external service (cloud DB, hosted API, SaaS auth)? | Pass - uses existing self-hosted Surface/spine deployment and browser PWA capabilities only |
| II. Component Boundaries | Does this feature introduce cross-component coupling beyond REST API contracts? | Pass - Surface remains browser UI served by spine; no direct spine imports or database access |
| III. Local-First Data | Does this feature store user data outside user-controlled SQLite/local files? | Pass - only static app-shell assets are cached in the browser; protected user data is not newly cached offline |
| IV. Security by Design | Does this feature add a new route group without a declared auth model? | Pass - no new route group planned; static assets and existing authenticated `/api/*` boundaries remain unchanged |
| V. Simplicity over Abstraction | Does this feature introduce an abstraction with fewer than 3 concrete callsites? | Pass - direct manifest, service worker, and shell state additions are preferred over new abstraction layers |
| V. Simplicity over Abstraction | Does this feature introduce an ORM, feature flag, or backwards-compat shim without a shipped external dependency or persisted-data migration requiring it? | Pass - no ORM, feature flags, or compatibility shims planned |
| Tech Stack | Does this feature add a runtime dependency outside the approved technology stack? | Pass - uses existing SvelteKit/static adapter/browser APIs |

## Project Structure

### Documentation (this feature)

```text
specs/013-surface-pwa/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    ├── pwa-runtime-contract.md
    └── pwa-verification-contract.md
```

### Source Code (repository root)

```text
surface/
├── static/                         # manifest-linked icons and any static PWA metadata files
├── src/
│   ├── app.html                    # app metadata and manifest discovery link if needed
│   ├── service-worker.ts           # app-shell asset cache and version cleanup
│   ├── routes/
│   │   ├── +layout.svelte          # install/update/degraded state integration if shell-wide
│   │   └── +page.svelte            # fallback shell state integration if route-owned
│   ├── lib/
│   │   ├── pwa/                    # only if shared by 3+ callsites; otherwise keep logic at callsite
│   │   └── state/                  # minimal UI state if needed for install/update prompts
│   └── components/
│       └── shell/                  # accessible install/update/degraded notices in existing shell patterns
├── e2e/                            # Playwright smoke coverage for installability/degraded shell where practical
└── src/**/*.test.ts                # unit coverage for PWA state helpers if introduced

docs/accessibility/
└── surface-pwa.md                  # WCAG 2.2 AA evidence and bilingual N/A rationale
```

**Structure Decision**: Keep the feature Surface-owned. Use SvelteKit's `src/service-worker.ts` support and existing static adapter output rather than adding Workbox or a Vite PWA plugin. Add spine changes only if implementation finds existing static serving prevents manifest/service-worker delivery; any such change must preserve current Authentik boundaries.

## Complexity Tracking

No constitution violations.

## Phase 0: Research

See [research.md](./research.md). Decisions resolve service-worker strategy, protected-data caching, install UX, update UX, app identity assets, testing strategy, and accessibility/language governance.

## Phase 1: Design & Contracts

See [data-model.md](./data-model.md), [contracts/pwa-runtime-contract.md](./contracts/pwa-runtime-contract.md), [contracts/pwa-verification-contract.md](./contracts/pwa-verification-contract.md), and [quickstart.md](./quickstart.md).

## Post-Design Constitution Check

| Principle | Result |
|-----------|--------|
| Self-Hosting First | Pass - no hosted dependency or cloud account is introduced |
| Component Boundaries | Pass - Surface owns PWA behavior; spine remains static/API host with existing contracts |
| Local-First Data | Pass - only non-sensitive app-shell assets are cached; protected knowledge data remains governed by existing local storage and auth |
| Security by Design | Pass - no new unauthenticated protected content path; service worker scope must not cache `/api/*` responses |
| Simplicity over Abstraction | Pass - direct browser/SvelteKit primitives are planned; no speculative wrapper or runtime dependency |
| Approved Stack | Pass - existing SvelteKit static SPA, browser APIs, Bun/Just commands |

## A11Y / Language Plan

- Review install, update, reload, retry, degraded, and unsupported-browser states against WCAG 2.2 AA basics: keyboard reachability, visible focus, accessible names, text alternatives, status messaging, contrast, zoom, and reduced motion.
- Include CLI accessibility checks only for any changed user-facing command output; current plan does not require CLI output changes, so CLI accessibility is N/A unless implementation expands scope.
- Add `docs/accessibility/surface-pwa.md` with evidence for install/launch controls, degraded-state text, update/reload focus behavior, icon/launch contrast considerations, narrow viewport checks, 200% zoom, reduced motion, and non-color-only messaging.
- Bilingual delivery is N/A because Surface product copy is English-only and no translation resources are included in this milestone; record this rationale in accessibility evidence.
