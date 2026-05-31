# Implementation Plan: Command Palette Question Mark Focus Fix

**Branch**: `bugfix/002-the-keyboard-shortcut` | **Date**: 2026-05-29 | **Spec**: [spec.md](./spec.md)

**Input**: Bug report and feature specification from `specs/bugfix-002-the-keyboard-shortcut/`

## Summary

Fix the `?` keyboard shortcut flow so opening the command palette also focuses its search textbox. Keep the existing global shortcut conditions in `WorkbenchShell.svelte`, replace unreliable input `autofocus` in `CommandPalette.svelte` with explicit Svelte mount-time focus, and add a Playwright e2e regression test that asserts the focused textbox after pressing `?`.

## Technical Context

**Language/Version**: TypeScript, Svelte 5.55, SvelteKit 2.57

**Primary Dependencies**: Existing SvelteKit app, Playwright e2e test suite, TanStack Svelte Query already used by the palette

**Storage**: N/A; no persistence changes

**Testing**: `bun run check`; targeted Playwright e2e test `command palette: ? opens palette and focuses the search input` when browser installation is available

**Target Platform**: Browser UI served by the SvelteKit static surface app

**Project Type**: Monorepo frontend bugfix in `surface/`

**Performance Goals**: Focus should occur during palette mount without additional async work or user-visible delay

**Constraints**: No new runtime dependency; preserve existing shortcut suppression for editable targets; preserve command palette navigation and close behavior

**Scale/Scope**: Single overlay component plus one e2e regression test

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate Question | Pass / Violation |
|-----------|--------------|-----------------|
| I. Self-Hosting First | Does this feature add a mandatory external service (cloud DB, hosted API, SaaS auth)? | Pass - no service changes |
| II. Component Boundaries | Does this feature introduce cross-component coupling beyond REST API contracts? | Pass - change stays within existing surface UI boundaries |
| III. Local-First Data | Does this feature store user data outside user-controlled SQLite/local files? | Pass - no data storage changes |
| IV. Security by Design | Does this feature add a new route group without a declared auth model? | Pass - no routes or auth changes |
| V. Simplicity over Abstraction | Does this feature introduce an abstraction with fewer than 3 concrete callsites? | Pass - one local mount-focus attachment, no shared abstraction |
| V. Simplicity over Abstraction | Does this feature introduce an ORM, feature flag, or backwards-compat shim without a shipped external dependency or persisted-data migration requiring it? | Pass - no ORM, flag, shim, or migration |
| Tech Stack | Does this feature add a runtime dependency outside the approved technology stack? | Pass - no dependency changes |

## Project Structure

### Documentation (this feature)

```text
specs/bugfix-002-the-keyboard-shortcut/
├── bug-report.md
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── tasks.md
└── contracts/
    └── command-palette-focus.md
```

### Source Code (repository root)

```text
surface/src/components/workbench/WorkbenchShell.svelte  # existing shortcut trigger behavior
surface/src/components/overlays/CommandPalette.svelte   # explicit search input focus on mount
surface/e2e/surface.e2e.ts                              # Playwright regression coverage
```

**Structure Decision**: Keep the fix local to the command palette rather than adding a global focus service or shortcut registry.

## Complexity Tracking

No constitution violations.

## Phase 0: Research

See [research.md](./research.md). Decisions cover focus management, Svelte attachment usage, and regression test strategy.

## Phase 1: Design & Contracts

See [data-model.md](./data-model.md), [contracts/command-palette-focus.md](./contracts/command-palette-focus.md), and [quickstart.md](./quickstart.md).

## Post-Design Constitution Check

| Principle | Result |
|-----------|--------|
| Self-Hosting First | Pass - no service changes |
| Component Boundaries | Pass - existing surface component boundary is preserved |
| Local-First Data | Pass - no data changes |
| Security by Design | Pass - no route or auth changes |
| Simplicity over Abstraction | Pass - minimal local focus attachment only |
| Approved Stack | Pass - no new dependencies |

## A11Y / Language Plan

- Explicitly move focus into the command palette textbox when the palette opens by keyboard shortcut.
- Preserve the dialog label and textbox accessible name used by Playwright and assistive technologies.
- Avoid relying on `autofocus`, which can have inconsistent timing and accessibility implications in dynamic overlays.
