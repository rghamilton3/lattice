# Implementation Plan: Add Vim Mode Indicator To Editor

**Branch**: `010-mod-001-add-vim-mode` | **Date**: 2026-05-30 | **Spec**: [modification-spec.md](./modification-spec.md)

**Input**: Modification specification from `specs/010-surface-workbench/modifications/001-add-vim-mode/modification-spec.md`

## Summary

Add a visible, accessible Vim mode state indicator in the Surface working document editor. The implementation should reuse the existing workbench `vimMode` preference and CodeMirror Vim integration, clarify the editor-local state next to existing editor controls, and avoid changing spine APIs, persisted preference shape, database storage, or dependencies.

## Technical Context

**Language/Version**: TypeScript with Svelte 5.55.2 and SvelteKit 2.57.0 in the static Surface SPA

**Primary Dependencies**: Existing CodeMirror 6 editor stack, `@replit/codemirror-vim`, TanStack Svelte Query for working document fetch/save state, Svelte 5 runes-based workbench state

**Storage**: Existing browser-local workbench preference persistence only; no database or API storage changes

**Testing**: `cd surface && bun run check`; targeted Surface unit/browser tests or Playwright e2e for editor indicator state; `cd surface && bun run test:unit` and/or `cd surface && bun run test:e2e`; update accessibility evidence under `docs/accessibility/`

**Target Platform**: Browser-based SvelteKit static SPA served by spine, including desktop and narrow viewport layouts

**Project Type**: Monorepo web application UI modification scoped to `surface/`

**Performance Goals**: Indicator updates synchronously with `wb.vimMode` without remounting CodeMirror or adding measurable editor interaction latency

**Constraints**: No new runtime dependencies, no new spine `/api/*` endpoints, no direct database access, no feature flag, preserve existing Vim toggle paths and shortcut ownership rules, do not rely on color alone for state

**Scale/Scope**: One editor pane component area plus tests/evidence; supports one or two panes using the existing shared workbench Vim preference

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate Question | Pass / Violation |
|-----------|--------------|-----------------|
| I. Self-Hosting First | Does this feature add a mandatory external service (cloud DB, hosted API, SaaS auth)? | Pass - client-only UI indicator over existing local state |
| II. Component Boundaries | Does this feature introduce cross-component coupling beyond REST API contracts? | Pass - Surface UI only; spine API contract unchanged |
| III. Local-First Data | Does this feature store user data outside user-controlled SQLite/local files? | Pass - no new data store; existing browser preference remains local |
| IV. Security by Design | Does this feature add a new route group without a declared auth model? | Pass - no routes or auth behavior added |
| V. Simplicity over Abstraction | Does this feature introduce an abstraction with fewer than 3 concrete callsites? | Pass - planned as direct editor UI reuse/update, not a new abstraction |
| V. Simplicity over Abstraction | Does this feature introduce an ORM, feature flag, or backwards-compat shim without a shipped external dependency or persisted-data migration requiring it? | Pass - no ORM, feature flag, or shim |
| Tech Stack | Does this feature add a runtime dependency outside the approved technology stack? | Pass - uses existing Svelte, CodeMirror, and Vim binding stack |

## Project Structure

### Documentation (this modification)

```text
specs/010-surface-workbench/modifications/001-add-vim-mode/
├── modification-spec.md
├── impact-analysis.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    └── editor-vim-mode-indicator.md
```

### Source Code (repository root)

```text
surface/
├── src/components/editor/
│   ├── EditorPane.svelte      # editor toolbar/chrome and CodeMirror mount
│   └── VimToggle.svelte       # existing Vim toggle/state control, likely reuse point
├── src/lib/state/
│   └── workbench.svelte.ts    # existing persisted vimMode state authority; no shape change expected
└── e2e/
    └── surface.e2e.ts         # likely regression coverage location

docs/accessibility/
└── surface-workbench.md       # evidence update for visible text, keyboard, and color-not-alone behavior
```

**Structure Decision**: Keep the modification inside the existing Surface editor component boundary. Do not add a new package, new state store, new API route, or new persistence model.

## Complexity Tracking

No constitution violations.

## Phase 0: Research

See [research.md](./research.md). Decisions resolve state ownership, UI placement, accessibility requirements, testing strategy, and dependency scope.

## Phase 1: Design & Contracts

See [data-model.md](./data-model.md), [contracts/editor-vim-mode-indicator.md](./contracts/editor-vim-mode-indicator.md), and [quickstart.md](./quickstart.md).

## Post-Design Constitution Check

| Principle | Result |
|-----------|--------|
| Self-Hosting First | Pass - no mandatory external service or hosted dependency |
| Component Boundaries | Pass - Surface-only UI contract; spine REST contract unchanged |
| Local-First Data | Pass - existing local preference state only; no migrations |
| Security by Design | Pass - no route group, auth model, or privilege behavior changes |
| Simplicity over Abstraction | Pass - minimal component-level UI update over existing state |
| Approved Stack | Pass - no new runtime dependency |

## A11Y / Language Plan

- Add or update accessibility evidence in `docs/accessibility/surface-workbench.md` documenting the editor Vim mode indicator.
- Verify the indicator has visible text or an accessible name/value and does not communicate state by color alone.
- Verify keyboard operation remains unchanged: editor-owned keystrokes must not trigger global shortcuts unexpectedly, and existing Vim toggle paths remain reachable.
- Bilingual content remains N/A because Surface currently ships English-only local product copy and has no translation resources; document this unchanged rationale in accessibility evidence if copy is touched.
- CLI accessibility checks are N/A because this modification does not change user-facing terminal output.
