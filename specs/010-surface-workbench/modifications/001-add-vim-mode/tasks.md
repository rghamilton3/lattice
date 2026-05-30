# Tasks: Add Vim Mode Indicator To Editor

**Input**: Design documents from `specs/010-surface-workbench/modifications/001-add-vim-mode/`

**Prerequisites**: `plan.md`, `modification-spec.md` (used as the story source for this modification workflow), `research.md`, `data-model.md`, `contracts/editor-vim-mode-indicator.md`, `quickstart.md`

**Tests**: Required by the modification spec. Add failing Playwright coverage before implementation, then run Surface checks.

**Organization**: Tasks are grouped by user story so each increment can be implemented and tested independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files and has no dependency on incomplete tasks
- **[Story]**: User story label for story-phase tasks only
- Every task includes exact file paths

## Phase 1: Setup (Shared Context)

**Purpose**: Confirm the existing Surface editor, state, and test seams before changing behavior.

- [X] T001 Review existing editor Vim state and toolbar rendering in `surface/src/components/editor/EditorPane.svelte` and `surface/src/components/editor/VimToggle.svelte`
- [X] T002 [P] Review the persisted `vimMode` preference and `toggleVim` API in `surface/src/lib/state/workbench.svelte.ts` without changing the preference shape
- [X] T003 [P] Review current Playwright API stubbing and workbench navigation patterns in `surface/e2e/surface.e2e.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add reusable e2e setup needed by every story without changing user-facing behavior.

**CRITICAL**: User story implementation should not begin until editor route stubbing is ready.

- [X] T004 Add or reuse working-document API route stubs for editor-pane e2e tests in `surface/e2e/surface.e2e.ts`

**Checkpoint**: Surface e2e tests can open a working document editor with deterministic content.

---

## Phase 3: User Story 1 - Confirm Editor Vim Mode State (Priority: P1) MVP

**Goal**: A user editing a working document can see and accessibly determine whether Vim mode is on or off from the editor controls.

**Independent Test**: Open a stubbed working document editor, verify the editor-local indicator exposes the off state, click the editor Vim control, and verify it exposes the on state without relying on color alone.

### Tests for User Story 1

- [X] T005 [US1] Add a failing Playwright assertion for the editor-local default Vim off state in `surface/e2e/surface.e2e.ts`
- [X] T006 [US1] Add a failing Playwright assertion that clicking the editor Vim control changes the editor-local state to Vim on in `surface/e2e/surface.e2e.ts`

### Implementation for User Story 1

- [X] T007 [US1] Update visible copy and accessible state in `surface/src/components/editor/VimToggle.svelte` so the editor control communicates `Vim mode: off` and `Vim mode: on`
- [X] T008 [US1] Verify the indicator remains in the editor toolbar whenever editor controls are rendered in `surface/src/components/editor/EditorPane.svelte`

**Checkpoint**: User Story 1 is independently complete when the editor shows accessible `Vim mode: off/on` state and the US1 Playwright assertions pass.

---

## Phase 4: User Story 2 - Synchronize Existing Toggle Paths (Priority: P2)

**Goal**: The editor indicator stays synchronized when Vim mode changes through existing settings, command palette, or keyboard shortcut paths.

**Independent Test**: With the editor open, toggle Vim mode from a non-editor path and confirm the editor indicator reflects the same `vimMode` state.

### Tests for User Story 2

- [X] T009 [US2] Add a failing Playwright assertion that the Settings Vim mode control updates the editor indicator in `surface/e2e/surface.e2e.ts`
- [X] T010 [US2] Add a failing Playwright assertion that the command palette action or `Ctrl+Alt+V` shortcut updates the editor indicator in `surface/e2e/surface.e2e.ts`

### Implementation for User Story 2

- [X] T011 [US2] Verify and minimally adjust existing Vim toggle wiring so settings, command palette, keyboard shortcut, and editor control continue using the same workbench state in `surface/src/components/overlays/Settings.svelte`, `surface/src/components/overlays/CommandPalette.svelte`, `surface/src/components/workbench/WorkbenchShell.svelte`, and `surface/src/lib/state/workbench.svelte.ts`

**Checkpoint**: User Story 2 is independently complete when non-editor toggle paths update the editor indicator through the existing shared `vimMode` source.

---

## Phase 5: User Story 3 - Preserve Editor Keyboard Behavior (Priority: P3)

**Goal**: Adding the indicator does not regress CodeMirror ownership, global shortcut suppression, or existing Vim ex commands.

**Independent Test**: Focus remains owned by CodeMirror while editing, global workbench shortcuts do not steal editor keystrokes, and existing Vim save/quit ex command definitions remain present.

### Tests for User Story 3

- [X] T012 [US3] Add or update Playwright coverage that global workbench shortcuts remain suppressed while focus is in the CodeMirror editor in `surface/e2e/surface.e2e.ts`

### Implementation for User Story 3

- [X] T013 [US3] Confirm no indicator change removes or renames existing `:w`, `:wq`, or `:q` Vim ex command wiring in `surface/src/components/editor/EditorPane.svelte`

**Checkpoint**: User Story 3 is complete when keyboard ownership and Vim ex command behavior remain unchanged after the indicator is added.

---

## Final Phase: Polish & Cross-Cutting Concerns

**Purpose**: Accessibility evidence, validation, and cleanup across all stories.

- [X] T014 Update editor Vim mode indicator accessibility evidence, color-not-alone status, keyboard behavior, and unchanged bilingual N/A rationale in `docs/accessibility/surface-workbench.md`
- [X] T015 Run `cd surface && bun run check` using `surface/package.json` and fix any Svelte or TypeScript issues reported for files under `surface/`
- [X] T016 Run `cd surface && bun run test:e2e` and fix any failing Surface e2e coverage in `surface/e2e/surface.e2e.ts`
- [X] T017 Run `cd surface && bun run test:unit` and fix any related unit regressions under `surface/src/`
- [X] T018 Run `just lint` and `just check` from the repository root using `justfile` and fix any final validation issues in the affected files

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; T002 and T003 can run in parallel with T001
- **Foundational (Phase 2)**: Depends on Setup completion; blocks user story test authoring
- **User Story 1 (Phase 3)**: Depends on Foundational completion; MVP scope
- **User Story 2 (Phase 4)**: Depends on Foundational completion and can start after US1 test seams exist, but should validate against the US1 indicator behavior
- **User Story 3 (Phase 5)**: Depends on Foundational completion and can be validated after indicator implementation
- **Polish**: Depends on desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: No dependency on other stories after Foundational; delivers MVP visible and accessible editor indicator
- **US2 (P2)**: Depends on the US1 indicator existing so synchronization can be observed
- **US3 (P3)**: Depends on the indicator implementation being present so regression checks validate the final editor behavior

### Within Each User Story

- Write Playwright assertions first and confirm they fail before implementation
- Implement the smallest Svelte UI/state wiring change needed to satisfy the story
- Run the story-specific Playwright checks before moving to the next story
- Preserve `workbench.svelte.ts` as the only Vim preference authority unless a minimal existing-state fix is required

### Parallel Opportunities

- T002 and T003 can run in parallel because they inspect different files
- After T004, US1 tests and accessibility evidence planning can be prepared while implementation work is scoped
- T014 documentation can be drafted after US1 behavior is defined, then finalized after US2 and US3 validation
- Final validation commands T015, T016, and T017 can be run independently once implementation is complete

---

## Parallel Example: Setup

```bash
Task: "Review the persisted vimMode preference and toggleVim API in surface/src/lib/state/workbench.svelte.ts"
Task: "Review current Playwright API stubbing and workbench navigation patterns in surface/e2e/surface.e2e.ts"
```

## Parallel Example: Final Validation

```bash
Task: "Run cd surface && bun run check and fix issues under surface/"
Task: "Run cd surface && bun run test:unit and fix related unit regressions under surface/src/"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 setup review.
2. Complete Phase 2 editor e2e stubbing.
3. Add failing US1 Playwright assertions in `surface/e2e/surface.e2e.ts`.
4. Update `surface/src/components/editor/VimToggle.svelte` and verify `EditorPane.svelte` placement.
5. Validate US1 independently before implementing synchronization coverage.

### Incremental Delivery

1. Deliver US1 so the editor always communicates Vim mode state locally.
2. Deliver US2 so all existing toggle paths keep the editor indicator synchronized.
3. Deliver US3 so keyboard ownership and Vim ex command behavior are explicitly protected.
4. Finish accessibility evidence and project validation.

### Scope Guardrails

- Do not add runtime dependencies.
- Do not add spine API endpoints, database migrations, or new persisted preference fields.
- Do not add a feature flag or compatibility shim.
- Do not duplicate `vimMode` state outside the existing workbench context.
