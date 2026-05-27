# Implementation Plan: Tracking Phase 1

**Branch**: `012-tracking-phase1` | **Date**: 2026-05-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/012-tracking-phase1/spec.md`

## Summary

Deliver the Phase 1 track, retrieve, and loop-close workflow on top of the Phase 0 tracking substrate. The implementation extends spine's existing tracking API with better keyword retrieval, query/open activity, derived loop-closure follow-ups, three follow-up outcomes, and advisory duplicate hints at tracking time. Surface work stays intentionally minimal: either a small tracking search/follow-up view using existing SvelteKit patterns or documented browser/curl/Signal flows sufficient to complete the workflow without a polished tracking board.

## Technical Context

**Language/Version**: TypeScript with Bun runtime for spine; TypeScript with Svelte 5/SvelteKit 2 for any persistent Surface retrieval or follow-up UI touched

**Primary Dependencies**: Existing spine stack (`bun:sqlite`, Elysia, TypeBox schemas via `elysia.t`), existing Phase 0 tracking routes/tables, existing Signal relay if Signal follow-up actions are chosen, existing Surface SvelteKit/TanStack Query stack and inbox `ActionRow` pattern if web UI is touched

**Storage**: Existing spine SQLite `tracks` and `track_queries` tables from `spine/migrations/011_tracks.sql`; Phase 1 should prefer no migration unless implementation needs additive indexes or metadata that cannot be represented by `loop_closed_at`, `loop_outcome`, `opened_track_id`, and `supersedes`

**Testing**: `just test`, targeted `bun test` for spine route/unit behavior, `just check`, and `cd surface && bun run check` plus Svelte/unit checks if Surface code changes; manual full-cycle smoke tests documented in quickstart

**Target Platform**: Existing self-hosted Lattice deployment: spine behind Caddy/Authentik, `/api/agent/*` bearer-token clients, browser Surface served as static SPA, optional Signal relay using existing notification posture

**Project Type**: Full-stack monorepo feature spanning `spine/` API/search behavior and optional minimal `surface/` workflow UI or Signal command handling

**Performance Goals**: Newly inserted tracks remain searchable within 10 seconds during normal single-user use; plain-language keyword search returns primary answer plus history without user-noticeable delay for Phase 1 data volume; follow-up eligibility queries are responsive enough to render a small pending list on page load or daily Signal generation

**Constraints**: No new runtime dependencies, no hosted service dependency added to Lattice, no ORM, no semantic/QMD retrieval, no photo OCR, no taxonomy/tag/zone parsing, no automatic edit/delete/merge/supersession, append-only tracking records, prompts are dismissible and non-accumulating, use existing auth boundaries

**Scale/Scope**: Single primary user, Phase 0 live tracking paths, lightweight keyword matching over personal item-location observations, pending follow-ups derived from searches in the last 14 days, duplicate hints limited to recent records from approximately the past 90 days

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate Question | Pass / Violation |
|-----------|---------------|------------------|
| I. Self-Hosting First | Does this feature add a mandatory external service (cloud DB, hosted API, SaaS auth)? | Pass - uses existing self-hosted spine, SQLite, Surface, and optional existing Signal relay only |
| II. Component Boundaries | Does this feature introduce cross-component coupling beyond REST API contracts? | Pass - Surface, Signal, and capture paths interact with spine through documented REST contracts |
| III. Local-First Data | Does this feature store user data outside user-controlled SQLite/local files? | Pass - tracks, query activity, and follow-up outcomes remain in spine SQLite |
| IV. Security by Design | Does this feature add a new route group without a declared auth model? | Pass - `/api/agent/track` remains bearer-token auth; `/api/tracks/*` remains Authentik/browser auth |
| V. Simplicity over Abstraction | Does this feature introduce an abstraction with fewer than 3 concrete callsites? | Pass - implement direct route/database logic following existing tracking route patterns |
| V. Simplicity over Abstraction | Does this feature introduce an ORM, feature flag, or backwards-compat shim without a shipped external dependency or persisted-data migration requiring it? | Pass - no ORM, flags, or compatibility shims planned |
| Tech Stack | Does this feature add a runtime dependency outside the approved technology stack? | Pass - existing Bun/Elysia/SvelteKit stack only |

## Project Structure

### Documentation (this feature)

```text
specs/012-tracking-phase1/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    ├── tracking-workflow-api.md
    └── follow-up-surfaces.md
```

### Source Code (repository root)

```text
spine/
├── migrations/
│   └── 012_*.sql                       # only if additive indexes/columns prove necessary
├── src/
│   ├── routes/
│   │   ├── agent.ts                    # duplicate hints in track response
│   │   └── tracks.ts                   # search/open/follow-up endpoints
│   ├── db/
│   │   └── rows.ts                     # shared response/row types
│   └── signal/ or signal-relay.ts       # only if Signal follow-up surface is chosen
└── src/**/*.test.ts                     # route and matching behavior coverage

surface/                                # only if persistent web workflow UI is added
├── src/lib/api/tracks.ts               # typed tracking API wrapper
├── src/lib/types.ts                    # tracking/follow-up UI types
└── src/components/...                  # minimal search/follow-up surface using existing patterns

docs/accessibility/                     # only if persistent Surface UI materially changes
└── tracking-phase1.md
```

**Structure Decision**: Keep Phase 1 spine-owned. Derive follow-ups from `track_queries` rather than introducing a new prompt service. Add only minimal Surface or Signal affordances needed to complete the workflow; defer polished tracking view, board view, semantic retrieval, OCR, and v2 prompts.

## Complexity Tracking

No constitution violations.

## Phase 0: Research

See [research.md](./research.md). Decisions resolve loop-closure storage, trigger timing, duplicate hints, retrieval ranking, surface choice, and accessibility/language governance.

## Phase 1: Design & Contracts

See [data-model.md](./data-model.md), [contracts/tracking-workflow-api.md](./contracts/tracking-workflow-api.md), [contracts/follow-up-surfaces.md](./contracts/follow-up-surfaces.md), and [quickstart.md](./quickstart.md).

## Post-Design Constitution Check

| Principle | Result |
|-----------|--------|
| Self-Hosting First | Pass - no new mandatory hosted service or cloud account is introduced |
| Component Boundaries | Pass - all cross-component interaction is through REST contracts or existing Signal relay boundaries |
| Local-First Data | Pass - Phase 1 uses spine SQLite and existing local files only |
| Security by Design | Pass - route auth is declared and matches existing route groups |
| Simplicity over Abstraction | Pass - derived follow-ups avoid a new prompt store; duplicate hints are direct advisory response data |
| Approved Stack | Pass - existing Bun/Elysia/SvelteKit stack only |

## A11Y / Language Plan

- Review any persistent Surface retrieval, result-open, duplicate-hint, or follow-up UI against WCAG 2.2 AA basics: keyboard operation, visible focus, meaningful labels, readable empty/error states, and non-color-only displaced or pending state.
- If Phase 1 uses command, curl, or Signal flows for part of the workflow, include CLI/message accessibility checks for plain text, clear action labels, no color-only meaning, and no backlog/debt wording.
- If persistent Surface UI changes, add or update `docs/accessibility/tracking-phase1.md` with keyboard, focus, label, and non-color-only state evidence.
- Bilingual content work is N/A for Phase 1 because existing Lattice product copy and this tracking workflow are English-only and no translation resource is part of this milestone.
