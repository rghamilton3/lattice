# Implementation Plan: Back Button Navigation

**Branch**: `014-back-button-navigation` | **Date**: 2026-05-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/014-back-button-navigation/spec.md`

## Summary

Fix the user-facing `<- back` control in Surface so it returns to the immediately previous usable in-app workbench state instead of a fixed destination. The implementation should stay inside the existing SvelteKit SPA/workbench state model, integrate with browser history semantics where appropriate, fall back to a safe in-app destination for direct entry or external history, and preserve keyboard/screen-reader usability.

## Technical Context

**Language/Version**: TypeScript 6.0.2, Svelte 5.55.2, SvelteKit 2.57.0

**Primary Dependencies**: SvelteKit `$app/navigation` / `$app/state`, Svelte 5 runes, existing `WorkbenchStore`, Playwright/Vitest for validation; no new runtime dependencies planned

**Storage**: No new persisted storage. Existing local `lattice.session` workbench preferences remain unchanged.

**Testing**: Surface unit tests with Vitest where navigation state can be isolated; Playwright e2e for real user flows, keyboard activation, and direct-entry fallback; `bun run check`, `bun run lint`, and relevant `bun run test:*` from `surface/`; root `just check`/`just lint` before merge when feasible

**Target Platform**: Browser-based Surface SPA built with SvelteKit static adapter and served by spine from `/`

**Project Type**: Monorepo web application; this feature is a frontend-only Surface navigation fix

**Performance Goals**: Back activation should feel instant to users and should not introduce additional network requests beyond those already caused by the resulting view/page

**Constraints**: Preserve no-SSR static SPA behavior; keep component boundaries (`surface/` only, no direct spine imports); avoid new abstractions unless reused at 3+ callsites; do not add runtime dependencies; avoid external navigation exits from the app; retain WCAG 2.2 AA keyboard and accessible-name behavior

**Scale/Scope**: All user-facing `<- back` controls in Surface workbench/navigation UI, including page-to-page, deep-link/direct-entry, and repeated back activations

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate Question | Pass / Violation |
|-----------|--------------|-----------------|
| I. Self-Hosting First | Does this feature add a mandatory external service (cloud DB, hosted API, SaaS auth)? | Pass - frontend navigation behavior only; no external services |
| II. Component Boundaries | Does this feature introduce cross-component coupling beyond REST API contracts? | Pass - change is contained to `surface/` and uses existing public browser/SvelteKit navigation semantics |
| III. Local-First Data | Does this feature store user data outside user-controlled SQLite/local files? | Pass - no data persistence changes |
| IV. Security by Design | Does this feature add a new route group without a declared auth model? | Pass - no route groups or auth changes |
| V. Simplicity over Abstraction | Does this feature introduce an abstraction with fewer than 3 concrete callsites? | Pass - plan favors small direct workbench/history handling in the existing shell/store unless implementation reveals at least 3 concrete callsites |
| V. Simplicity over Abstraction | Does this feature introduce an ORM, feature flag, or backwards-compat shim without a shipped external dependency or persisted-data migration requiring it? | Pass - none planned |
| Tech Stack | Does this feature add a runtime dependency outside the approved technology stack? | Pass - uses existing SvelteKit/Svelte stack |

## Project Structure

### Documentation (this feature)

```text
specs/014-back-button-navigation/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/
│   └── requirements.md
└── contracts/
    └── back-button-navigation.md
```

### Source Code (repository root)

```text
surface/
├── src/
│   ├── components/
│   │   ├── shell/
│   │   │   └── AppShell.svelte          # user-facing nav/back control wiring if control lives in shell
│   │   └── workbench/
│   │       └── WorkbenchShell.svelte    # workbench navigation/back behavior entry point
│   ├── lib/
│   │   └── state/
│   │       ├── workbench.svelte.ts      # existing workbench state, view transitions, safe fallback behavior
│   │       └── workbench.test.ts        # unit coverage for navigation history/state decisions if extracted into store logic
│   └── routes/
│       └── +page.svelte                 # existing deep-link entry behavior, direct-entry fallback context
└── e2e/
    └── surface.e2e.ts                   # browser-level back button flow and accessibility coverage
```

**Structure Decision**: Keep implementation in Surface's existing shell/workbench state path. Do not touch spine, agent, database migrations, release scripts, or monorepo infrastructure.

## Complexity Tracking

No constitution violations.

## Phase 0: Research

See [research.md](./research.md). Decisions cover SvelteKit history/navigation APIs, direct-entry fallback behavior, workbench state scope, context preservation, accessibility, and test strategy.

## Phase 1: Design & Contracts

See [data-model.md](./data-model.md), [contracts/back-button-navigation.md](./contracts/back-button-navigation.md), and [quickstart.md](./quickstart.md).

## Post-Design Constitution Check

| Principle | Result |
|-----------|--------|
| Self-Hosting First | Pass - no hosted service or external infrastructure |
| Component Boundaries | Pass - Surface-only behavior; no spine/agent coupling |
| Local-First Data | Pass - no storage changes |
| Security by Design | Pass - no routes, auth, tokens, or privileges changed |
| Simplicity over Abstraction | Pass - direct use of existing workbench/shell navigation path; no feature flag or compatibility shim |
| Approved Stack | Pass - no dependency additions |

## A11Y / Language Plan

- Verify every `<- back` control remains a semantic button or equivalent accessible control with an understandable accessible name.
- Verify keyboard focus can reach the control and `Enter`/`Space` activation matches pointer activation.
- Verify SvelteKit route announcements and focus behavior remain acceptable after back navigation; avoid `keepFocus` unless the focused element remains valid after navigation.
- Run `bun run check` so Svelte compile-time accessibility checks execute.
- Add Playwright assertions by role/name for the back control and keyboard activation.
- Bilingual content work is N/A for this feature because the scoped UI copy is existing English product copy and no multilingual requirement or translation resource exists.
- CLI accessibility checks are N/A because this feature does not change user-facing terminal output.
