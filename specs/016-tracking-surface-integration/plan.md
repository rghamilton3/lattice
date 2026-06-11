# Implementation Plan: Tracking Surface Integration

**Branch**: `016-tracking-surface-integration` | **Date**: 2026-06-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/016-tracking-surface-integration/spec.md`

## Summary

Make tracking first-class in Surface by adding a browser tracking workspace with search, record reading, surface-created track records, a board of item cards grouped by free-text bins, and loop-closure follow-ups. The implementation reuses the existing append-only Spine tracking tables and `/api/tracks` workflow where possible, adds only focused local-first API/storage pieces for browser-created records, durable manual bins, board summaries, and photo serving, and keeps item cards derived from tracking history instead of introducing a canonical item registry.

## Technical Context

**Language/Version**: TypeScript with Bun runtime for Spine; TypeScript 6.0.2 with Svelte 5.55.2 and SvelteKit 2.57.0 for Surface

**Primary Dependencies**: Existing Spine stack (`bun:sqlite`, Elysia, existing auth middleware), existing `/api/tracks` Phase 0/1 route helpers and `tracks`/`track_queries` tables, Surface SvelteKit static SPA, Svelte 5 runes, TanStack Svelte Query, existing workbench pane/navigation patterns, existing attachment file-serving safety patterns

**Storage**: Existing Spine SQLite `tracks` and `track_queries`; additive SQLite migration for durable manual `track_bins`; local image files for browser-uploaded tracking photos referenced by `tracks.photo_ref`; no QMD/vector-store migration and no cloud storage

**Testing**: Targeted Spine `bun test` coverage for track creation/search/detail/board/follow-up routes and migration behavior; Surface `bun run check`, focused Vitest/browser component tests for tracking API wrappers and UI state, Playwright e2e for search/create/board/follow-up keyboard flows; root `just check`, `just lint`, and `just test` before merge when feasible

**Target Platform**: Existing self-hosted Lattice deployment: Spine behind Caddy/Authentik, Surface static browser SPA served by Spine, desktop and narrow responsive browser viewports

**Project Type**: Full-stack monorepo web application feature spanning `spine/` API/storage and `surface/` browser UI only

**Performance Goals**: Surface searches and board refreshes feel responsive for single-user personal tracking data; newest records appear in search and board views immediately after successful save; primary search flow meets the spec's under-30-second user outcome and board move flow meets the under-60-second outcome

**Constraints**: Append-only tracking records; newest useful record wins; no automatic item merge; no drag-to-merge; no multi-bin current item; no hosted services; no ORM; no new runtime dependency unless implementation proves existing stack cannot satisfy photo upload or drag/keyboard accessibility; new browser routes use existing Authentik `/api/*` auth; `/api/agent/track` remains bearer-token auth; WCAG 2.2 AA for search, form, board, filters, status, and follow-up rows; English-only delivery for this milestone

**Scale/Scope**: Single primary user, personal item-location memory, existing Phase 0/1 tracking records and follow-ups, free-text bins, derived item cards, stable tracking-detail navigation, optional photo upload and previews, and accessibility evidence updates

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Answer each question. Any "Yes" requires a Complexity Tracking entry with justification
before implementation may proceed.

| Principle | Gate Question | Pass / Violation |
|-----------|--------------|-----------------|
| I. Self-Hosting First | Does this feature add a mandatory external service (cloud DB, hosted API, SaaS auth)? | Pass - all state remains in Spine SQLite and local files |
| II. Component Boundaries | Does this feature introduce cross-component coupling beyond REST API contracts? | Pass - Surface uses documented `/api/tracks/*` contracts only; no direct Spine imports |
| III. Local-First Data | Does this feature store user data outside user-controlled SQLite/local files? | Pass - tracks, bins, queries, and photos remain on user-controlled storage |
| IV. Security by Design | Does this feature add a new route group without a declared auth model? | Pass - new `/api/tracks/*` browser routes use existing Authentik route group; `/api/agent/*` remains unchanged |
| V. Simplicity over Abstraction | Does this feature introduce an abstraction with fewer than 3 concrete callsites? | Pass - plan favors direct route/component additions and derived board helpers over generalized inventory abstractions |
| V. Simplicity over Abstraction | Does this feature introduce an ORM, feature flag, or backwards-compat shim without a shipped external dependency or persisted-data migration requiring it? | Pass - no ORM, feature flag, compatibility shim, or destructive migration |
| Tech Stack | Does this feature add a runtime dependency outside the approved technology stack? | Pass - no new dependency planned |

## Project Structure

### Documentation (this feature)

```text
specs/016-tracking-surface-integration/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/
│   └── requirements.md
└── contracts/
    ├── tracking-surface-api.md
    └── tracking-surface-ui.md
```

### Source Code (repository root)

```text
spine/
├── migrations/
│   └── 013_track_bins.sql              # additive manual-bin persistence if not already present
├── src/
│   ├── routes/
│   │   └── tracks.ts                   # browser create/detail/board/photo endpoints and existing search/follow-up routes
│   ├── db/
│   │   └── rows.ts                     # shared row/response types for bins, photos, board cards
│   └── routes/*.test.ts                # focused route and board derivation coverage

surface/
├── src/lib/api/
│   └── tracks.ts                       # typed wrappers and TanStack Query keys
├── src/lib/types.ts                    # tracking result, detail, board, bin, and follow-up types
├── src/lib/state/
│   └── workbench.svelte.ts             # add tracking pane content/navigation only if needed
├── src/components/tracking/
│   ├── TrackingView.svelte             # search/form/board/follow-up container
│   ├── TrackingSearch.svelte           # search input/results/top answer/history
│   ├── TrackingRecordView.svelte       # stable record reading view
│   ├── TrackingForm.svelte             # text and optional photo upload
│   ├── TrackingBoard.svelte            # bins, cards, displaced filter, move controls
│   └── TrackingFollowUps.svelte        # action rows using existing no-backlog copy
├── src/components/workbench/
│   └── PaneRouter.svelte               # route tracking pane content
└── e2e/
    └── surface.e2e.ts                  # representative keyboard/pointer flows if practical

docs/accessibility/
└── tracking-surface.md                 # WCAG 2.2 AA evidence for the new browser UI
```

**Structure Decision**: Implement as a focused full-stack Lattice feature. Spine remains the source of truth for append-only records, manual bins, and local photos; Surface owns all browser interaction and talks to Spine only through `/api/tracks/*`. Do not add a canonical item table or board framework; derive item cards from track history and keep board UI scoped under `surface/src/components/tracking/`.

## Complexity Tracking

No constitution violations.

## Phase 0: Research

See [research.md](./research.md). Decisions resolve board storage, card derivation, browser-created records, photo upload/serving, stable record navigation, follow-up presentation, board move semantics, and accessibility/language governance.

## Phase 1: Design & Contracts

See [data-model.md](./data-model.md), [contracts/tracking-surface-api.md](./contracts/tracking-surface-api.md), [contracts/tracking-surface-ui.md](./contracts/tracking-surface-ui.md), and [quickstart.md](./quickstart.md).

## Post-Design Constitution Check

| Principle | Result |
|-----------|--------|
| Self-Hosting First | Pass - no hosted service, cloud database, cloud object storage, or SaaS account is introduced |
| Component Boundaries | Pass - Surface/Spine interaction is through documented `/api/tracks/*` REST contracts |
| Local-First Data | Pass - tracking records, queries, bins, and photos remain in user-controlled SQLite/local files |
| Security by Design | Pass - new browser endpoints use the existing Authentik-protected `/api/*` model and photo serving follows existing path safety patterns |
| Simplicity over Abstraction | Pass - direct route/component work, no ORM, no item registry, no general board framework, no feature flag |
| Approved Stack | Pass - no new runtime dependency planned |

## A11Y / Language Plan

- Update `docs/accessibility/tracking-surface.md` with manual and automated evidence for search, record reading, text/photo form, board bins/cards, move controls, displaced filter, and follow-up actions.
- Verify WCAG 2.2 AA expectations: keyboard operation, visible focus, status/error messaging, non-color-only displaced state, readable contrast, accessible names, drag alternatives, and responsive reflow without page-level horizontal scrolling.
- Provide keyboard-accessible alternatives for board card movement; pointer drag may be additive but cannot be the only move path.
- Keep all tracking copy plain English and avoid debt/backlog language for follow-ups.
- Bilingual content is N/A for this milestone because current Surface product copy and the supplied tracking plan are English-only and no translation workflow or bilingual requirement was supplied.
