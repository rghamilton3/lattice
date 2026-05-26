# Tasks: Surface Workbench

**Input**: Design documents from `specs/010-surface-workbench/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/surface-workbench.md, quickstart.md

**Tests**: Automated coverage is required by FR-015 and SC-006. Add focused tests before or alongside implementation changes where current coverage is insufficient.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in each task description

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the existing Surface structure and commands before story work.

- [x] T001 Review current Surface shell, workbench state, routes, styles, and test commands in `surface/src/routes/+layout.svelte`, `surface/src/routes/+page.svelte`, `surface/src/lib/state/workbench.svelte.ts`, `surface/src/components/shell/AppShell.svelte`, `surface/src/components/workbench/WorkbenchShell.svelte`, and `surface/package.json`
- [x] T002 [P] Review current Surface API wrappers and document no-new-endpoint constraints in `surface/src/lib/api/client.ts`, `surface/src/lib/api/status.ts`, `surface/src/lib/api/search.ts`, `surface/src/lib/api/files.ts`, `surface/src/lib/api/working.ts`, and `surface/src/lib/api/captures.ts`
- [x] T003 [P] Verify ignore/config coverage for Surface build and test outputs in `.gitignore`, `surface/vite.config.ts`, and `surface/svelte.config.js`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared state, typing, accessibility, and test foundations that all stories rely on.

**Checkpoint**: No user story implementation starts until this phase is complete.

- [x] T004 Add or confirm WorkbenchStore tests for corrupted localStorage, invalid enum fallback, pane focus/split behavior, overlay exclusion, and preference persistence in `surface/src/lib/state/workbench.test.ts`
- [x] T005 [P] Add or confirm typed pane/deep-link coverage for document references and invalid refs in `surface/src/lib/types.ts`, `surface/src/lib/utils/deeplink.ts`, and related tests under `surface/src/lib/utils/`
- [x] T006 [P] Audit shell, pane, overlay, and reading controls for accessible names/roles and keyboard-safe targets in `surface/src/components/shell/`, `surface/src/components/workbench/`, `surface/src/components/overlays/`, and `surface/src/components/reading/`
- [x] T007 Confirm static SPA, dev proxy, and runes-mode config remain aligned with the plan in `surface/vite.config.ts` and `surface/svelte.config.js`

---

## Phase 3: User Story 1 - Work From A Stable Shell (Priority: P1)

**Goal**: The workbench loads safely, routes/deep-links predictably, persists valid preferences, and keeps primary navigation reachable.

**Independent Test**: Load Surface, navigate home/library/tasks/doc states, change and reload preferences, test valid/invalid deep links, and verify fallback behavior.

### Tests for User Story 1

- [x] T008 [P] [US1] Add or extend WorkbenchStore unit tests for corrupted persisted JSON and invalid persisted values in `surface/src/lib/state/workbench.test.ts`
- [x] T009 [P] [US1] Add or extend E2E coverage for home load, settings persistence, invalid deep link fallback, and narrow viewport primary controls in `surface/e2e/surface.e2e.ts`

### Implementation for User Story 1

- [x] T010 [US1] Harden deep-link initialization and fallback messaging in `surface/src/routes/+page.svelte`
- [x] T011 [US1] Harden preference rehydration and persistence boundaries in `surface/src/lib/state/workbench.svelte.ts`
- [x] T012 [US1] Ensure shell navigation, status text fallbacks, capture/settings/palette access, and focus mode labels remain reachable in `surface/src/components/shell/AppShell.svelte`
- [x] T013 [US1] Improve responsive shell and pane layout behavior without redesigning visual language in `surface/src/routes/layout.css` and `surface/src/lib/styles/components.css`

**Checkpoint**: User Story 1 is independently functional and testable.

---

## Phase 4: User Story 2 - Search, Read, And Compare Knowledge (Priority: P2)

**Goal**: Search/library results, reading panes, rich markdown/PDF display, split panes, and lateral actions are readable, predictable, and error-tolerant.

**Independent Test**: Open search/library results, view captures/files/PDFs/working docs, use Split/Similar/Mentions/Nearby, and verify loading/error/rich-render fallback states.

### Tests for User Story 2

- [x] T014 [P] [US2] Add or extend E2E coverage for opening search results, split pane preservation, and lateral result opening in `surface/e2e/surface.e2e.ts`
- [x] T015 [P] [US2] Add or extend renderer/pane tests for markdown fallback or pane routing behavior in `surface/src/components/reading/` or `surface/src/components/workbench/` test files if feasible

### Implementation for User Story 2

- [x] T016 [US2] Confirm and harden pane routing for home/library/results/doc/editor/tasks in `surface/src/components/workbench/PaneRouter.svelte` and `surface/src/components/workbench/PaneContainer.svelte`
- [x] T017 [US2] Harden reading pane loading, error, attachment upload, promote, split, and lateral action feedback in `surface/src/components/reading/ReadingPane.svelte`
- [x] T018 [US2] Harden markdown rendering against stale async renders and rich-content failures in `surface/src/components/reading/MarkdownRenderer.svelte`
- [x] T019 [US2] Confirm search/library result opening and local-file/working/capture document references in `surface/src/components/home/LibraryView.svelte`, `surface/src/components/search/ResultList.svelte`, and `surface/src/lib/types.ts`

**Checkpoint**: User Stories 1 and 2 both work independently.

---

## Phase 5: User Story 3 - Operate With Keyboard And Low-Friction Controls (Priority: P3)

**Goal**: Keyboard shortcuts, command palette, settings, capture/new-doc overlays, focus mode, and triage ownership are discoverable, non-conflicting, and accessible.

**Independent Test**: Use shortcuts from the shell and from text-entry contexts, navigate overlays by keyboard, close/cancel/confirm, and verify no accidental shortcut stealing.

### Tests for User Story 3

- [x] T020 [P] [US3] Add or extend E2E coverage for shortcut suppression inside text inputs/editors and overlay keyboard navigation in `surface/e2e/surface.e2e.ts`
- [x] T021 [P] [US3] Add or extend component/store coverage for overlay mutual exclusion and command palette/settings behavior in `surface/src/lib/state/workbench.test.ts` or browser component tests under `surface/src/components/overlays/`

### Implementation for User Story 3

- [x] T022 [US3] Harden global key handling, editable-target detection, Escape behavior, and shortcut labels in `surface/src/components/workbench/WorkbenchShell.svelte`
- [x] T023 [US3] Harden command palette focus, empty state, active row semantics, and keyboard navigation in `surface/src/components/overlays/CommandPalette.svelte`
- [x] T024 [US3] Harden settings labels, selected-state semantics, Escape/close behavior, and reduced-motion copy in `surface/src/components/overlays/Settings.svelte`
- [x] T025 [US3] Confirm quick capture, new doc, new task, file upload, and triage overlays do not conflict with global shortcuts in `surface/src/components/overlays/` and `surface/src/components/process/ProcessMode.svelte`

**Checkpoint**: All user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, accessibility evidence, validation commands, and task completion.

- [x] T026 [P] Update Surface workbench user/developer notes in `README.md` or `surface/CLAUDE.md` if commands, shortcuts, or diagnostics changed
- [x] T027 [P] Add `docs/accessibility/surface-workbench.md` with WCAG 2.2 AA evidence, keyboard coverage, text alternatives, reduced-motion notes, contrast/theme notes, and bilingual N/A rationale
- [x] T028 Run `cd surface && bun run check`
- [x] T029 Run `cd surface && bun run test:unit`
- [x] T030 Run `cd surface && bun run test:e2e` or document any environment blocker with the closest targeted Playwright/Vitest command executed
- [x] T031 Run `cd surface && bun run lint` or document any pre-existing formatting/lint blocker
- [x] T032 Mark all completed tasks `[x]` in `specs/010-surface-workbench/tasks.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on setup and blocks all user stories.
- **User Story 1 (Phase 3)**: Starts after foundational and is the MVP.
- **User Story 2 (Phase 4)**: Starts after foundational; may use shell behavior from US1 but remains testable independently.
- **User Story 3 (Phase 5)**: Starts after foundational; may use overlay state from US1/US2 but remains testable independently.
- **Polish (Phase 6)**: Depends on selected user stories being complete.

### User Story Dependencies

- **US1**: No story dependency; provides stable shell and persistence.
- **US2**: Depends on pane/state foundations; can be verified with mocked API data.
- **US3**: Depends on overlay/state foundations; can be verified with keyboard and overlay tests.

### Within Each User Story

- Write or extend tests before implementation when behavior is missing.
- Complete lower-numbered tasks in a story before moving to later implementation tasks that touch the same file.
- Run targeted checks after each story if the touched files are substantial.

### Parallel Opportunities

- T002 and T003 can run in parallel after T001.
- T005, T006, and T007 can run in parallel after T004 starts if no same-file edits conflict.
- T008 and T009 can run in parallel.
- T014 and T015 can run in parallel.
- T020 and T021 can run in parallel.
- T026 and T027 can run in parallel with final validation prep.

---

## Parallel Example: User Story 2

```text
Task: "T014 [US2] Extend E2E split/lateral coverage in surface/e2e/surface.e2e.ts"
Task: "T015 [US2] Add renderer/pane tests under surface/src/components/reading/ or workbench/"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete setup and foundational review.
2. Harden shell loading, preference persistence, deep-link fallback, and responsive reachability.
3. Run targeted unit/e2e checks for shell and preferences.

### Incremental Delivery

1. Add US1 stable shell and persistence.
2. Add US2 reading/search/split hardening.
3. Add US3 keyboard/overlay hardening.
4. Finish accessibility evidence and validation.

### Notes

- Do not add new spine APIs unless a task explicitly discovers an unavoidable contract gap; prefer existing `/api/*` wrappers.
- Do not replace the existing visual language; refine reachable controls, labels, and failure states.
- Use Svelte 5 runes patterns and run `svelte-autofixer` on changed `.svelte` files before finalizing Svelte edits.
