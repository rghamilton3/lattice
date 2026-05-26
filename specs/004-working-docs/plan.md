# Implementation Plan: Working Docs

**Branch**: `feature/time-machine-working-docs` | **Date**: 2026-05-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-working-docs/spec.md`

## Summary

Deliver the markdown working-document lifecycle inside Lattice: authenticated users can create, list, read, edit, and delete local-first markdown documents from the workbench. Build on the existing working-doc file store, spine REST routes, TanStack Query API wrapper, CodeMirror editor pane, and workbench routing. The feature remains focused on source markdown editing; rich text and collaboration stay out of scope.

## Technical Context

**Language/Version**: TypeScript on Bun for spine; TypeScript/Svelte 5 for surface

**Primary Dependencies**: Elysia, local filesystem APIs, SvelteKit static SPA, TanStack Query, CodeMirror 6

**Storage**: Markdown files under the working directory beside the configured spine database

**Testing**: `bun test tests/unit/working.test.ts tests/routes/working-route.test.ts` in `spine`; `bun run check` in `surface`

**Target Platform**: Self-hosted Lattice deployment on Linux/VPS; local development via Bun/Vite

**Project Type**: Full-stack web app with spine REST API and surface SPA UI

**Performance Goals**: Keep list/read/write operations bounded by local working-doc files; support browsing at least 50 working documents without degraded workbench usability

**Constraints**: Authentik fail-closed for user routes; no external document service; no ORM; no new runtime dependencies; preserve REST component boundaries; document paths must remain slug-confined

**Scale/Scope**: Single-user local-first working documents; collaborative editing, rich-text editing, and document version history are out of scope

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate Question | Pass / Violation |
|-----------|--------------|-----------------|
| I. Self-Hosting First | Does this feature add a mandatory external service (cloud DB, hosted API, SaaS auth)? | Pass - uses local markdown files and existing self-hosted spine only |
| II. Component Boundaries | Does this feature introduce cross-component coupling beyond REST API contracts? | Pass - surface communicates through `/api/working` only |
| III. Local-First Data | Does this feature store user data outside user-controlled SQLite/local files? | Pass - documents are local markdown files beside the configured database |
| IV. Security by Design | Does this feature add a new route group without a declared auth model? | Pass - existing user-facing `/api/working` routes stay under Authentik guard |
| V. Simplicity over Abstraction | Does this feature introduce an abstraction with fewer than 3 concrete callsites? | Pass - direct helpers and route handlers are sufficient |
| V. Simplicity over Abstraction | Does this feature introduce an ORM, feature flag, or backwards-compat shim without a shipped external dependency or persisted-data migration requiring it? | Pass - no ORM, feature flag, or speculative compatibility layer |
| Tech Stack | Does this feature add a runtime dependency outside the approved technology stack? | Pass - no new dependencies |

## Project Structure

### Documentation (this feature)

```text
specs/004-working-docs/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── working.md
├── checklists/
│   └── requirements.md
└── tasks.md

docs/accessibility/
└── working-docs.md
```

### Source Code (repository root)

```text
spine/
├── src/
│   ├── working.ts
│   └── routes/
│       └── working.ts
└── tests/
    ├── unit/
    │   └── working.test.ts
    └── routes/
        └── working-route.test.ts

surface/
└── src/
    ├── lib/api/working.ts
    └── components/
        ├── editor/
        │   ├── EditorPane.svelte
        │   └── VimToggle.svelte
        └── workbench/
            └── PaneRouter.svelte
```

**Structure Decision**: Use existing working-doc route modules and editor components. Surface state crosses boundaries only as documented JSON over `/api/working`; filesystem details remain encapsulated in `spine/src/working.ts`.

## Complexity Tracking

No constitution violations.

## Phase 0 Research

See [research.md](./research.md). Decisions: keep markdown file storage, use slug-confined document identifiers, preserve source markdown exactly, keep editor autosave with explicit status, and update accessibility evidence for working-doc controls.

## Phase 1 Design

See [data-model.md](./data-model.md), [contracts/working.md](./contracts/working.md), and [quickstart.md](./quickstart.md).

## Post-Design Constitution Check

Re-check passes. The design adds no external services, dependencies, route groups, ORMs, or cross-component imports; all user data remains in local files controlled by the user.
