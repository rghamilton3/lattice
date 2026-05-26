# Implementation Plan: Tasks And Triage

**Branch**: `feature/time-machine-tasks-triage` | **Date**: 2026-05-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-tasks-triage/spec.md`

## Summary

Deliver the capture triage and task-management workflow across spine and surface: authenticated users can process inbox captures into keep/archive/promote/task/skip outcomes, create tasks directly or via capture routing, edit task metadata, complete/restore tasks, and receive accessible process/task UI feedback. Use existing capture rows, additive task/triage columns, direct SQLite route updates, TanStack Query cache invalidation, and Svelte 5 components; no new runtime dependencies or external services.

## Technical Context

**Language/Version**: TypeScript on Bun for spine; TypeScript/Svelte 5 for surface

**Primary Dependencies**: Elysia, SQLite via `bun:sqlite`, SvelteKit static SPA, TanStack Query, Svelte 5 runes

**Storage**: User-controlled SQLite `captures` rows with `triaged_at`, `triage_action`, `task_due_date`, `task_priority`, `task_notes`, and `task_completed_at` columns; existing capture markdown files remain the content index source

**Testing**: `bun test tests/unit/commands.test.ts tests/routes/captures.test.ts tests/routes/tasks.test.ts` in `spine`; `bun run check` in `surface`

**Target Platform**: Self-hosted Lattice deployment on Linux/VPS; local development via Bun/Vite

**Project Type**: Full-stack web app with spine REST API and surface SPA UI

**Performance Goals**: Keep task list queries bounded to task rows; sort active tasks deterministically in-process after retrieving the active set; batch process-mode network calls only at session exit to reduce per-card latency

**Constraints**: Authentik fail-closed for browser routes; bearer auth remains agent-only; no ORM; no new runtime dependencies; migrations remain additive; UI controls must remain keyboard accessible and documented against WCAG 2.2 AA

**Scale/Scope**: Single-user local-first inbox triage and task management; recurring tasks, reminders, notifications, multi-user assignment, and full promotion-to-working-doc creation are out of scope

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate Question | Pass / Violation |
|-----------|--------------|-----------------|
| I. Self-Hosting First | Does this feature add a mandatory external service? | Pass - uses existing local SQLite and browser UI only |
| II. Component Boundaries | Does this feature introduce cross-component coupling beyond REST API contracts? | Pass - surface uses documented `/api/captures/*` and `/api/tasks/*` endpoints only |
| III. Local-First Data | Does this feature store user data outside user-controlled SQLite/local files? | Pass - triage/task state remains in SQLite capture rows |
| IV. Security by Design | Does this feature add a new route group without a declared auth model? | Pass - task and triage routes remain Authentik-protected user routes |
| V. Simplicity over Abstraction | Does this feature introduce an abstraction with fewer than 3 concrete callsites? | Pass - keep direct route/component changes |
| V. Simplicity over Abstraction | Does this feature introduce an ORM, feature flag, or backwards-compat shim without concrete need? | Pass - no ORM, no new feature flags, no shims |
| Tech Stack | Does this feature add a runtime dependency outside the approved stack? | Pass - no new dependencies |

## Project Structure

### Documentation (this feature)

```text
specs/006-tasks-triage/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── tasks-triage.md
├── checklists/
│   └── requirements.md
└── tasks.md

docs/accessibility/
└── tasks-triage.md
```

### Source Code (repository root)

```text
spine/
├── src/
│   ├── commands.ts
│   └── routes/
│       ├── captures.ts
│       └── tasks.ts
├── migrations/
│   ├── 004_capture_triage.sql
│   ├── 005_tasks.sql
│   └── 006_task_completed_at.sql
└── tests/
    ├── unit/commands.test.ts
    └── routes/
        ├── captures.test.ts
        └── tasks.test.ts

surface/
└── src/
    ├── lib/
    │   ├── api/tasks.ts
    │   └── state/useCompleteTask.svelte.ts
    └── components/
        ├── home/HomeView.svelte
        ├── process/ProcessMode.svelte
        ├── tasks/TasksView.svelte
        └── overlays/NewTask.svelte
```

**Structure Decision**: Use existing capture rows as task records and preserve the established component boundaries. Spine owns validation, persistence, and route semantics; surface owns process/task interaction state and communicates only through `/api/*` JSON contracts.

## Complexity Tracking

No constitution violations.

## Phase 0 Research

See [research.md](./research.md). Decisions: continue using capture rows for task data, keep slash-command parsing strict and leading-only, sort active tasks by due date/priority with deterministic tie-breaks, submit process-mode decisions at exit, and document accessibility evidence for process/task UI.

## Phase 1 Design

See [data-model.md](./data-model.md), [contracts/tasks-triage.md](./contracts/tasks-triage.md), and [quickstart.md](./quickstart.md).

## Post-Design Constitution Check

Re-check passes. The design adds no external services, dependencies, ORMs, or cross-component imports; all task and triage data remains in local SQLite capture rows. Accessibility review work is planned in `docs/accessibility/tasks-triage.md`; bilingual content work is explicitly N/A because no user-facing non-English surface exists in this project phase. CLI accessibility checks are N/A because no user-facing terminal output changes.
