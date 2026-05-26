# Implementation Plan: Capture Inbox

**Branch**: `feature/time-machine-capture-inbox` | **Date**: 2026-05-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-capture-inbox/spec.md`

## Summary

Deliver the first capture workflow across spine and surface: authenticated users can create plain-text quick captures, browse the recent inbox, and receive same-instance live updates. The implementation stays inside existing spine REST/SSE boundaries and surface API/components, tightening validation around empty and over-limit captures while preserving later-feature boundaries for triage, attachments, search, and tasks.

## Technical Context

**Language/Version**: TypeScript on Bun 1.x for spine runtime; Svelte 5/SvelteKit 2 for surface

**Primary Dependencies**: Existing Elysia server, `bun:sqlite`, TanStack Svelte Query, SvelteKit static SPA; no new runtime dependencies planned

**Storage**: SQLite via `bun:sqlite`; additive capture table migration in `spine/migrations/001_captures.sql`; no external storage

**Testing**: `bun test` in `spine/`; `bun run check` in `surface/`; targeted route and UI-facing API validation where feasible

**Target Platform**: Self-hosted local development or VPS deployment with spine behind Caddy + Authentik and surface served as static assets

**Project Type**: Web service plus static browser UI within the existing monorepo (`spine/` and `surface/` only)

**Performance Goals**: Save and show a valid capture in under 5 seconds during normal local operation; recent inbox reads return the newest 50 captures quickly enough for interactive use

**Constraints**: Fail closed for capture routes; local-first SQLite persistence; no ORM; no new runtime dependencies; no cross-component imports; capture text max 10,000 characters; capture inbox must not own triage/search/tasks/attachments behavior

**Scale/Scope**: Single-user/self-hosted personal knowledge inbox; recent browse scope is at least 50 captures, with server cap no higher than 200 per request

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Answer each question. Any "Yes" requires a Complexity Tracking entry with justification before implementation may proceed.

| Principle | Gate Question | Pass / Violation |
|-----------|--------------|-----------------|
| I. Self-Hosting First | Does this feature add a mandatory external service (cloud DB, hosted API, SaaS auth)? | Pass - no external service added |
| II. Component Boundaries | Does this feature introduce cross-component coupling beyond REST API contracts? | Pass - surface uses spine `/api/*` contracts only |
| III. Local-First Data | Does this feature store user data outside user-controlled SQLite/local files? | Pass - captures persist to SQLite under spine storage |
| IV. Security by Design | Does this feature add a new route group without a declared auth model? | Pass - `/api/captures*` uses Authentik header guard |
| V. Simplicity over Abstraction | Does this feature introduce an abstraction with fewer than 3 concrete callsites? | Pass - direct route/component code is preferred |
| V. Simplicity over Abstraction | Does this feature introduce an ORM, feature flag, or backwards-compat shim without a shipped external dependency or persisted-data migration requiring it? | Pass - none planned |
| Tech Stack | Does this feature add a runtime dependency outside the approved technology stack? | Pass - no dependency additions planned |

## Project Structure

### Documentation (this feature)

```text
specs/002-capture-inbox/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── captures.md
└── tasks.md
```

### Source Code (repository root)

```text
spine/
├── src/
│   ├── app.ts
│   ├── captureEvents.ts
│   └── routes/
│       └── captures.ts
├── migrations/
│   └── 001_captures.sql
└── tests/
    └── routes/
        └── captures.test.ts

surface/
└── src/
    ├── lib/
    │   ├── api/
    │   │   └── captures.ts
    │   └── types.ts
    └── components/
        ├── home/
        │   ├── HomeView.svelte
        │   └── InboxList.svelte
        └── overlays/
            └── QuickCapture.svelte

docs/accessibility/
└── capture-inbox.md
```

**Structure Decision**: Keep persistence, validation, REST/SSE capture contracts, and route tests in `spine/`. Keep browser API wrappers and UI state in `surface/`. Do not introduce shared in-process types across components; document the wire contract instead.

## Phase 0: Research

Research output is captured in [research.md](./research.md). Decisions: use existing Authentik-protected capture routes, retain SQLite and migration-based schema ownership, use process-local SSE for same-instance updates, enforce a 10,000-character capture limit, and document accessibility evidence because this feature affects interactive UI.

## Phase 1: Design And Contracts

Design output is captured in [data-model.md](./data-model.md), [contracts/captures.md](./contracts/captures.md), and [quickstart.md](./quickstart.md).

## A11Y Governance

The feature changes interactive browser UI for quick capture and inbox review. Apply WCAG 2.2 AA to keyboard access, focus handling, dialog semantics, visible labels, button names, non-color-only save/error/empty/loading states, and readable text. Bilingual delivery is explicitly out of scope because the feature has no multilingual requirement. Update `docs/accessibility/capture-inbox.md` with verification notes for quick capture and inbox states. No user-facing terminal output changes are planned, so CLI accessibility checks are not required.

## Post-Design Constitution Check

| Principle | Gate Question | Pass / Violation |
|-----------|--------------|-----------------|
| I. Self-Hosting First | Does this feature add a mandatory external service (cloud DB, hosted API, SaaS auth)? | Pass |
| II. Component Boundaries | Does this feature introduce cross-component coupling beyond REST API contracts? | Pass |
| III. Local-First Data | Does this feature store user data outside user-controlled SQLite/local files? | Pass |
| IV. Security by Design | Does this feature add a new route group without a declared auth model? | Pass |
| V. Simplicity over Abstraction | Does this feature introduce an abstraction with fewer than 3 concrete callsites? | Pass |
| V. Simplicity over Abstraction | Does this feature introduce an ORM, feature flag, or backwards-compat shim without a shipped external dependency or persisted-data migration requiring it? | Pass |
| Tech Stack | Does this feature add a runtime dependency outside the approved technology stack? | Pass |

## Complexity Tracking

No constitution violations.
