# Implementation Plan: Tracking Phase 0

**Branch**: `011-tracking-phase0` | **Date**: 2026-05-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/011-tracking-phase0/spec.md`

## Summary

Deliver the Phase 0 tracking substrate from `docs/tracking-development-plan.md`: append-only tracking records in spine SQLite, bearer-token agent ingestion, authenticated search/open-result APIs, and setup contracts for HA Voice, Tasker phone voice, and Signal commands. Phase 0 proves every configured capture path can create searchable records without introducing inventory taxonomy, semantic retrieval, loop-closure prompts, or a polished tracking surface.

## Technical Context

**Language/Version**: TypeScript with Bun runtime for spine; TypeScript with Svelte 5/SvelteKit 2 for any minimal Surface verification touchpoints

**Primary Dependencies**: Existing spine stack (`bun:sqlite`, Elysia, TypeBox schemas via `elysia.t`), existing Signal relay code, existing Surface SvelteKit/TanStack Query stack if a minimal search/open UI is touched

**Storage**: Spine-owned SQLite database via forward-only migration `spine/migrations/011_tracks.sql`; optional photo references are stored as paths/identifiers only, not OCRed or semantically indexed in Phase 0

**Testing**: `just test`, targeted `bun test` spine route/unit tests, `just check`, and `cd surface && bun run check` if Surface code changes; manual curl/device smoke tests documented in quickstart

**Target Platform**: Existing self-hosted Lattice deployment: spine behind Caddy/Authentik, `/api/agent/*` bearer-token clients, browser Surface served as static SPA

**Project Type**: Full-stack monorepo feature spanning `spine/`, Signal relay routing, and optional minimal `surface/` verification UI

**Performance Goals**: Track insertion returns quickly enough for voice/Signal clients to complete without retry churn; newly inserted records are searchable within 5 seconds for HA Voice and within 10 seconds for portable/Signal paths under normal connectivity; keyword search remains responsive for single-user Phase 0 data volume

**Constraints**: No new runtime dependencies, no hosted service dependency added to Lattice, no ORM, no direct Surface database access, no category/tag/zone/item-location parsing, append-only records only, preserve existing `/capture` and Signal command behavior, use existing auth boundaries

**Scale/Scope**: Single primary user, one printing-room HA Voice device, phone Tasker voice, Signal text/photo fallback, and a Phase 0 data volume of personal item-location observations plus query logs

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate Question | Pass / Violation |
|-----------|---------------|------------------|
| I. Self-Hosting First | Does this feature add a mandatory external service (cloud DB, hosted API, SaaS auth)? | Pass - uses existing self-hosted spine and existing externally configured device channels only; no new mandatory Lattice service |
| II. Component Boundaries | Does this feature introduce cross-component coupling beyond REST API contracts? | Pass - clients and Surface interact with spine through documented REST contracts only |
| III. Local-First Data | Does this feature store user data outside user-controlled SQLite/local files? | Pass - tracking records and query logs live in spine SQLite; photo fields are references only |
| IV. Security by Design | Does this feature add a new route group without a declared auth model? | Pass - `/api/agent/track` uses existing bearer-token agent auth; `/api/tracks/*` uses existing Authentik browser auth |
| V. Simplicity over Abstraction | Does this feature introduce an abstraction with fewer than 3 concrete callsites? | Pass - implement direct route/database logic matching existing spine route patterns |
| V. Simplicity over Abstraction | Does this feature introduce an ORM, feature flag, or backwards-compat shim without a shipped external dependency or persisted-data migration requiring it? | Pass - no ORM, flags, or compatibility shims planned |
| Tech Stack | Does this feature add a runtime dependency outside the approved technology stack? | Pass - no new runtime dependency planned |

## Project Structure

### Documentation (this feature)

```text
specs/011-tracking-phase0/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    ├── tracking-api.md
    └── capture-paths.md
```

### Source Code (repository root)

```text
spine/
├── migrations/
│   └── 011_tracks.sql
├── src/
│   ├── routes/
│   │   ├── agent.ts
│   │   └── tracks.ts
│   ├── signal-relay.ts
│   └── signal/
│       └── messages.ts
└── tests or colocated *.test.ts files for route/search behavior

surface/
├── src/lib/api/tracks.ts              # only if a minimal browser verification path is added
└── src/components/...                 # only if persistent tracking search/open UI is added

docs/accessibility/
└── tracking-phase0.md                 # only if Phase 0 materially changes persistent Surface UI
```

**Structure Decision**: Add tracking as a new spine-owned content category with direct SQLite access inside spine routes. Keep external entry points as REST clients of spine. Surface work is optional/minimal for Phase 0 verification and must not become a polished tracking view, which is explicitly deferred.

## Complexity Tracking

No constitution violations.

## Phase 0: Research

See [research.md](./research.md). Decisions resolve Phase 0 storage, search, auth, Signal routing, displaced-state handling, and accessibility/language governance.

## Phase 1: Design & Contracts

See [data-model.md](./data-model.md), [contracts/tracking-api.md](./contracts/tracking-api.md), [contracts/capture-paths.md](./contracts/capture-paths.md), and [quickstart.md](./quickstart.md).

## Post-Design Constitution Check

| Principle | Result |
|-----------|--------|
| Self-Hosting First | Pass - no new mandatory hosted service or cloud account is introduced by Lattice; Phase 0 uses existing external device paths as clients |
| Component Boundaries | Pass - all cross-component interaction is through REST contracts |
| Local-First Data | Pass - structured tracking data is stored in spine SQLite through a forward-only migration |
| Security by Design | Pass - new route auth is declared and matches existing route groups |
| Simplicity over Abstraction | Pass - no new shared abstraction, ORM, feature flag, or speculative compatibility layer |
| Approved Stack | Pass - existing Bun/Elysia/SvelteKit stack only |

## A11Y / Language Plan

- Review any persistent Surface search/open-result UI added for Phase 0 against WCAG 2.2 AA basics: keyboard access, visible focus, meaningful labels, readable status text, and non-color-only displaced indicators.
- If Phase 0 only adds APIs, Signal routing, curl smoke tests, and external device setup, record accessibility evidence as N/A because no durable web surface changed.
- If user-facing terminal or CLI smoke-test output is introduced, include an accessibility check for readable plain-text errors and non-color-only state.
- Bilingual content work is N/A for Phase 0 because existing Lattice product/setup copy is English-only and no translation resource is part of this milestone.
