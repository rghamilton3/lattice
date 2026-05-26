# Implementation Plan: Retrieval Search

**Branch**: `feature/time-machine-retrieval-search` | **Date**: 2026-05-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-retrieval-search/spec.md`

## Summary

Deliver the local retrieval workflow across spine and surface: authenticated users can search indexed captures, working material, local files, and attachment metadata; browse indexed files with safe raw-file access; and move laterally through similar and nearby items. Use the existing spine REST routes, SQLite `file_index` schema, local markdown index files, and QMD store; no new runtime dependencies or external services.

## Technical Context

**Language/Version**: TypeScript on Bun for spine; TypeScript/Svelte 5 for surface

**Primary Dependencies**: Elysia, SQLite via `bun:sqlite`, `@tobilu/qmd`, SvelteKit static SPA, TanStack Query

**Storage**: User-controlled SQLite (`file_index`, captures, attachments) plus local markdown index directories and QMD vector store beside the spine database

**Testing**: `bun test tests/routes/search.test.ts tests/routes/lateral.test.ts tests/routes/files.test.ts` in `spine`; `bun run check` in `surface`

**Target Platform**: Self-hosted Lattice deployment on Linux/VPS; local development via Bun/Vite

**Project Type**: Full-stack web app with spine REST API and surface SPA UI

**Performance Goals**: Keep result sets bounded (search 20, similar 10, file list cap 500) and avoid unbounded scans from user input

**Constraints**: Authentik fail-closed for user routes; bearer auth remains agent-only; no external search service; no ORM; no new runtime dependencies; preserve component boundaries through REST contracts; raw file serving must enforce canonical-path safety

**Scale/Scope**: Single-user local-first index covering captures, working docs, file index rows, and attachment metadata; saved searches and clustering remain out of scope unless preserving existing placeholders

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate Question | Pass / Violation |
|-----------|--------------|-----------------|
| I. Self-Hosting First | Does this feature add a mandatory external service (cloud DB, hosted API, SaaS auth)? | Pass - uses existing local SQLite/files/QMD only |
| II. Component Boundaries | Does this feature introduce cross-component coupling beyond REST API contracts? | Pass - surface talks to spine through `/api/search`, `/api/files`, `/api/similar`, `/api/nearby` only |
| III. Local-First Data | Does this feature store user data outside user-controlled SQLite/local files? | Pass - no external storage |
| IV. Security by Design | Does this feature add a new route group without a declared auth model? | Pass - existing routes remain inside Authentik-protected `/api/*` guard |
| V. Simplicity over Abstraction | Does this feature introduce an abstraction with fewer than 3 concrete callsites? | Pass - direct route/search helpers are already present |
| V. Simplicity over Abstraction | Does this feature introduce an ORM, feature flag, or backwards-compat shim without a shipped external dependency or persisted-data migration requiring it? | Pass - no ORM or speculative shim |
| Tech Stack | Does this feature add a runtime dependency outside the approved technology stack? | Pass - no new dependencies |

## Project Structure

### Documentation (this feature)

```text
specs/003-retrieval-search/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── retrieval.md
├── checklists/
│   └── requirements.md
└── tasks.md

docs/accessibility/
└── retrieval-search.md
```

### Source Code (repository root)

```text
spine/
├── src/
│   ├── search.ts
│   └── routes/
│       ├── search.ts
│       ├── lateral.ts
│       └── files.ts
├── migrations/
│   └── 002_file_index.sql
└── tests/routes/
    ├── search.test.ts
    ├── lateral.test.ts
    └── files.test.ts

surface/
└── src/
    ├── lib/api/
    │   ├── search.ts
    │   └── files.ts
    └── components/search/
        ├── Facets.svelte
        ├── ResultList.svelte
        ├── ResultRow.svelte
        └── search.css
```

**Structure Decision**: Use existing spine route modules and surface search components. Retrieval state crosses component boundaries only as documented JSON over `/api/*`; QMD remains encapsulated in `spine/src/search.ts`.

## Complexity Tracking

No constitution violations.

## Phase 0 Research

See [research.md](./research.md). Decisions: keep local QMD-backed retrieval, preserve SQLite file index schema, enforce safe raw-file serving, keep similar/nearby bounded, and update accessibility evidence for search result interactions.

## Phase 1 Design

See [data-model.md](./data-model.md), [contracts/retrieval.md](./contracts/retrieval.md), and [quickstart.md](./quickstart.md).

## Post-Design Constitution Check

Re-check passes. The design adds no external services, dependencies, route groups, ORMs, or cross-component imports; all user data remains in local SQLite/files and QMD-managed local storage.
