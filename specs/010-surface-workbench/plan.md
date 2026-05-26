# Implementation Plan: Surface Workbench

**Branch**: `feature/time-machine-surface-workbench` | **Date**: 2026-05-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/010-surface-workbench/spec.md`

## Summary

Deliver and harden the SvelteKit Surface workbench: a static SPA shell for home, library/search, reading panes, settings, command palette, deep links, themes, focus mode, and keyboard-first knowledge work. The implementation should preserve the existing Lattice visual language and app architecture while filling gaps in workbench routing, preference resilience, pane behavior, rich reading states, accessibility evidence, and automated coverage.

## Technical Context

**Language/Version**: TypeScript with Svelte 5 runes, SvelteKit 2, Bun tooling

**Primary Dependencies**: SvelteKit static adapter, TanStack Svelte Query, Tailwind CSS v4, CodeMirror 6, marked, marked-katex-extension, mermaid, DOMPurify, pdfjs-dist, Playwright/Vitest tooling already present in `surface/package.json`

**Storage**: Browser `localStorage` for non-sensitive workbench preferences only; all user data remains in spine SQLite/vector store accessed through `/api/*`

**Testing**: `bun run check`, `bun run test:unit`, targeted Playwright/Vitest browser tests, and `bun run test:e2e` where feasible

**Target Platform**: Static browser SPA served by spine from `/`, developed through Vite dev server proxying `/api` to spine

**Project Type**: Frontend SPA in existing monorepo component `surface/`

**Performance Goals**: Workbench shell renders without blocking on optional data; command palette and pane state updates remain immediate for normal single-user data sizes; rich markdown rendering degrades without freezing the shell

**Constraints**: No new infrastructure, no direct database access from Surface, no new runtime dependencies unless justified, no hosted service dependency, no auth model changes, preserve existing ADHD-aware calm UI language, keep primary actions keyboard-accessible and readable at narrow viewports

**Scale/Scope**: Single-user personal knowledge workspace with one browser session, one or two active panes, recent captures/working docs/tasks/search results, and existing spine APIs

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate Question | Pass / Violation |
|-----------|---------------|------------------|
| I. Self-Hosting First | Does this feature add a mandatory external service (cloud DB, hosted API, SaaS auth)? | Pass - no new service |
| II. Component Boundaries | Does this feature introduce cross-component coupling beyond REST API contracts? | Pass - Surface uses `/api/*` only |
| III. Local-First Data | Does this feature store user data outside user-controlled SQLite/local files? | Pass - only UI preferences in browser storage |
| IV. Security by Design | Does this feature add a new route group without a declared auth model? | Pass - no new route group |
| V. Simplicity over Abstraction | Does this feature introduce an abstraction with fewer than 3 concrete callsites? | Pass - prefer existing store/components |
| V. Simplicity over Abstraction | Does this feature introduce an ORM, feature flag, or backwards-compat shim without a shipped external dependency or persisted-data migration requiring it? | Pass - no ORM or speculative shim |
| Tech Stack | Does this feature add a runtime dependency outside the approved technology stack? | Pass - use existing stack |

## Project Structure

### Documentation (this feature)

```text
specs/010-surface-workbench/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── surface-workbench.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
surface/
├── src/routes/
│   ├── +layout.svelte
│   ├── +page.svelte
│   └── layout.css
├── src/lib/
│   ├── api/client.ts
│   ├── api/{captures,files,search,status,tasks,working,attachments}.ts
│   ├── state/workbench.svelte.ts
│   ├── state/workbench.test.ts
│   ├── styles/components.css
│   ├── types.ts
│   └── utils/{deeplink,logError,relTime,selection}.ts
├── src/components/
│   ├── shell/
│   ├── workbench/
│   ├── home/
│   ├── search/
│   ├── reading/
│   ├── editor/
│   ├── overlays/
│   ├── process/
│   ├── tasks/
│   └── ui/
├── e2e/surface.e2e.ts
├── svelte.config.js
├── vite.config.ts
└── package.json

docs/accessibility/
└── surface-workbench.md
```

**Structure Decision**: Continue using the existing single `surface/` SvelteKit SPA with route-level shell composition and runes-based UI state in `src/lib/state/workbench.svelte.ts`. No new package, route group, backend component, or shared monorepo library is planned.

## Complexity Tracking

No constitution violations.

## Phase 0: Research

See [research.md](./research.md). Decisions focus on preserving the static SPA model, keeping workbench state local and typed, using TanStack Query for server data, retaining the current calm Lattice visual language, and validating Svelte 5 rune patterns plus accessibility constraints.

## Phase 1: Design & Contracts

See [data-model.md](./data-model.md), [contracts/surface-workbench.md](./contracts/surface-workbench.md), and [quickstart.md](./quickstart.md).

## Post-Design Constitution Check

| Principle | Result |
|-----------|--------|
| Self-Hosting First | Pass - no external services or hosted APIs added |
| Component Boundaries | Pass - Surface continues to communicate with spine via `/api/*` only |
| Local-First Data | Pass - browser preference storage only; user data remains spine-owned |
| Security by Design | Pass - no auth changes; Vite dev proxy behavior remains dev-only |
| Simplicity over Abstraction | Pass - use existing workbench store, components, and tests |
| Approved Stack | Pass - no new runtime dependency planned |

## A11Y / Language Plan

- Review shell, panes, command palette, settings, reading actions, and status feedback for accessible names, role usage, keyboard reachability, reduced-motion behavior, and text alternatives.
- Add or update `docs/accessibility/surface-workbench.md` with evidence, residual risks, and bilingual N/A rationale.
- Include automated checks where feasible through existing Surface unit/e2e tests and `bun run check`.
- Bilingual content work is N/A for this feature because Surface currently has English-only product copy and no translation resources.
