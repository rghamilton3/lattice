---

description: "Task list for Back Button Navigation implementation"
---

# Tasks: Back Button Navigation

**Input**: Design documents from `specs/014-back-button-navigation/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/back-button-navigation.md, quickstart.md

**Tests**: Required by the feature plan/spec for browser navigation flows, direct-entry fallback, keyboard activation, accessible names, Svelte checks, and relevant unit coverage where navigation state is isolated.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files and does not depend on incomplete tasks
- **[Story]**: Maps the task to User Story 1, 2, or 3 from `specs/014-back-button-navigation/spec.md`
- Every task includes an exact repository path

## Path Conventions

- Surface app paths are under `surface/`
- Feature design and generated task paths are under `specs/014-back-button-navigation/`
- Accessibility evidence paths are under `docs/accessibility/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm scope and current behavior before changing navigation code.

- [X] T001 Inspect the existing user-facing back controls in `surface/src/components/editor/EditorPane.svelte` and `surface/src/components/reading/ReadingPane.svelte`
- [X] T002 [P] Inspect existing workbench pane mutation methods and tests in `surface/src/lib/state/workbench.svelte.ts` and `surface/src/lib/state/workbench.test.ts`
- [X] T003 [P] Inspect existing Surface e2e stubs and navigation assertions in `surface/e2e/surface.e2e.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add the shared navigation primitives that all user stories use.

**CRITICAL**: No user story implementation should begin until this phase is complete.

- [X] T004 Define a transient per-pane back history model and safe fallback rules in `surface/src/lib/state/workbench.svelte.ts`
- [X] T005 Implement `WorkbenchStore` history recording for `openInPane` transitions without persisting history to `lattice.session` in `surface/src/lib/state/workbench.svelte.ts`
- [X] T006 Implement a `WorkbenchStore` back action that returns to the previous usable in-app pane state or a safe fallback without creating repeated-back loops in `surface/src/lib/state/workbench.svelte.ts`
- [X] T007 [P] Add unit tests for history recording, fallback selection, split-pane preservation, and non-persistence in `surface/src/lib/state/workbench.test.ts`
- [X] T008 Update deep-link initialization to preserve direct-entry fallback context without adding persisted storage in `surface/src/routes/+page.svelte`

**Checkpoint**: The workbench store can decide previous in-app navigation versus fallback, and story work can use that shared behavior.

---

## Phase 3: User Story 1 - Return To Previous Page (Priority: P1) MVP

**Goal**: Activating `<- back` after in-app navigation returns to the immediately previous usable page or workbench state instead of a fixed Library destination.

**Independent Test**: Navigate from one in-app view to a document/editor view, activate Back, and confirm the immediately previous view and normal preserved context are restored.

### Tests for User Story 1

- [X] T009 [P] [US1] Add e2e coverage for Home to document/editor back returning to Home in `surface/e2e/surface.e2e.ts`
- [X] T010 [P] [US1] Add e2e coverage for Library search context returning after document back in `surface/e2e/surface.e2e.ts`
- [X] T011 [P] [US1] Add e2e coverage for a three-state flow returning one step rather than a fixed destination in `surface/e2e/surface.e2e.ts`

### Implementation for User Story 1

- [X] T012 [US1] Replace the fixed Library back action in the main editor toolbar with the shared workbench back action in `surface/src/components/editor/EditorPane.svelte`
- [X] T013 [US1] Replace the fixed Library back action in editor delete success and Vim quit paths with the shared workbench back action in `surface/src/components/editor/EditorPane.svelte`
- [X] T014 [US1] Replace the fixed Library back action in the main reading toolbar with the shared workbench back action in `surface/src/components/reading/ReadingPane.svelte`
- [X] T015 [US1] Ensure document promotion and edit transitions record history so Back from the promoted/editor view returns to the prior document view in `surface/src/components/reading/ReadingPane.svelte`
- [X] T016 [US1] Ensure pane transitions from command/navigation flows continue to record prior states correctly in `surface/src/components/workbench/WorkbenchShell.svelte`

**Checkpoint**: User Story 1 works independently and is testable as the MVP.

---

## Phase 4: User Story 2 - Safe Fallback Without Prior Page (Priority: P2)

**Goal**: Direct-entry, external-history, missing-history, and unavailable-history cases keep the user inside Surface at a documented safe destination.

**Independent Test**: Open a deep link or bookmarked URL directly, activate Back, and confirm Surface navigates to the safe fallback without leaving the app, failing, or looping.

### Tests for User Story 2

- [X] T017 [P] [US2] Add e2e coverage for direct document deep-link Back landing on the safe fallback in `surface/e2e/surface.e2e.ts`
- [X] T018 [P] [US2] Add e2e coverage for repeated Back activation traversing usable states or falling back without a loop in `surface/e2e/surface.e2e.ts`
- [X] T019 [P] [US2] Add unit tests for missing, unusable, or same-destination history entries falling back safely in `surface/src/lib/state/workbench.test.ts`

### Implementation for User Story 2

- [X] T020 [US2] Add direct-entry fallback metadata for `?view=doc&ref=...`, `?view=library`, `?view=search`, and `?view=tasks` initialization in `surface/src/routes/+page.svelte`
- [X] T021 [US2] Guard the shared workbench back action from external browser history exits by using only recorded in-app pane states and safe fallbacks in `surface/src/lib/state/workbench.svelte.ts`
- [X] T022 [US2] Document the page-specific safe fallback choices used by tests in `specs/014-back-button-navigation/quickstart.md`

**Checkpoint**: User Story 2 works independently for direct-entry and unsafe-history flows.

---

## Phase 5: User Story 3 - Accessible Back Control (Priority: P3)

**Goal**: The corrected Back controls remain keyboard reachable, keyboard operable, and discoverable by role/name with understandable labels.

**Independent Test**: Tab to each Back control, activate it with `Enter` or `Space`, and confirm the result matches pointer activation while role/name queries can find the control.

### Tests for User Story 3

- [X] T023 [P] [US3] Add e2e coverage for role/name discovery of document and editor Back controls in `surface/e2e/surface.e2e.ts`
- [X] T024 [P] [US3] Add e2e coverage for keyboard activation with `Enter` and `Space` matching pointer Back behavior in `surface/e2e/surface.e2e.ts`
- [X] T025 [P] [US3] Add e2e coverage that focus is not stranded on a removed Back control after navigation in `surface/e2e/surface.e2e.ts`

### Implementation for User Story 3

- [X] T026 [US3] Ensure the editor Back controls use semantic `<button>` elements with understandable `aria-label` or visible text after behavior changes in `surface/src/components/editor/EditorPane.svelte`
- [X] T027 [US3] Ensure the reading Back control uses a semantic `<button>` with an understandable accessible name after behavior changes in `surface/src/components/reading/ReadingPane.svelte`
- [X] T028 [US3] Avoid `keepFocus` or custom focus retention unless the destination keeps the focused element valid in `surface/src/components/editor/EditorPane.svelte` and `surface/src/components/reading/ReadingPane.svelte`
- [X] T029 [US3] Record the completed keyboard, accessible-name, and focus checks in `docs/accessibility/surface-workbench.md`

**Checkpoint**: User Story 3 works independently for keyboard and assistive technology users.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validate the full Surface feature, update documentation, and confirm no unrelated scope was introduced.

- [X] T030 [P] Verify no new runtime dependencies, spine imports, database changes, or persistence fields were added by reviewing `surface/package.json`, `surface/src/lib/state/workbench.svelte.ts`, and `surface/src/routes/+page.svelte`
- [X] T031 [P] Verify bilingual delivery remains N/A because no new multilingual user-facing copy was introduced in `surface/src/components/editor/EditorPane.svelte` and `surface/src/components/reading/ReadingPane.svelte`
- [X] T032 Run `bun run check` from `surface/` and fix any Svelte, TypeScript, or accessibility diagnostics in `surface/src/components/editor/EditorPane.svelte`, `surface/src/components/reading/ReadingPane.svelte`, `surface/src/lib/state/workbench.svelte.ts`, or `surface/src/routes/+page.svelte`
- [X] T033 Run `bun run lint` from `surface/` and fix lint/format issues in `surface/src/components/editor/EditorPane.svelte`, `surface/src/components/reading/ReadingPane.svelte`, `surface/src/lib/state/workbench.svelte.ts`, `surface/src/lib/state/workbench.test.ts`, `surface/src/routes/+page.svelte`, or `surface/e2e/surface.e2e.ts`
- [X] T034 Run `bun run test:unit -- --run` from `surface/` and fix failing unit tests in `surface/src/lib/state/workbench.test.ts`
- [X] T035 Run `bun run test:e2e` from `surface/` and fix failing navigation or accessibility e2e coverage in `surface/e2e/surface.e2e.ts`
- [X] T036 Run the manual validation checklist from `specs/014-back-button-navigation/quickstart.md` and update any inaccurate validation notes in `specs/014-back-button-navigation/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion; blocks all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational completion; MVP scope.
- **User Story 2 (Phase 4)**: Depends on Foundational completion; can be developed after or alongside User Story 1 if shared store behavior is stable.
- **User Story 3 (Phase 5)**: Depends on User Story 1 or User Story 2 controls being wired; accessibility tests should validate the final controls.
- **Polish (Phase 6)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational phase; no dependency on User Story 2 or User Story 3.
- **User Story 2 (P2)**: Can start after Foundational phase; independent fallback behavior, but should not regress User Story 1 true-back behavior.
- **User Story 3 (P3)**: Can start after Back controls are wired by User Story 1 and User Story 2; verifies accessibility contract across both behavior paths.

### Within Each User Story

- Tests should be written first and should fail before the corresponding implementation task.
- Shared store behavior should be complete before component wiring.
- Component wiring should be complete before accessibility evidence updates.
- Each story should be validated independently before moving to the next priority.

### Parallel Opportunities

- T002 and T003 can run in parallel with T001.
- T007 can run in parallel with component reconnaissance after T004-T006 are designed.
- T009, T010, and T011 can be drafted in parallel before User Story 1 implementation.
- T017, T018, and T019 can be drafted in parallel before User Story 2 implementation.
- T023, T024, and T025 can be drafted in parallel before User Story 3 implementation.
- T030 and T031 can run in parallel during polish before final validation commands.

---

## Parallel Example: User Story 1

```bash
Task: "T009 [P] [US1] Add e2e coverage for Home to document/editor back returning to Home in surface/e2e/surface.e2e.ts"
Task: "T010 [P] [US1] Add e2e coverage for Library search context returning after document back in surface/e2e/surface.e2e.ts"
Task: "T011 [P] [US1] Add e2e coverage for a three-state flow returning one step rather than a fixed destination in surface/e2e/surface.e2e.ts"
```

## Parallel Example: User Story 2

```bash
Task: "T017 [P] [US2] Add e2e coverage for direct document deep-link Back landing on the safe fallback in surface/e2e/surface.e2e.ts"
Task: "T018 [P] [US2] Add e2e coverage for repeated Back activation traversing usable states or falling back without a loop in surface/e2e/surface.e2e.ts"
Task: "T019 [P] [US2] Add unit tests for missing, unusable, or same-destination history entries falling back safely in surface/src/lib/state/workbench.test.ts"
```

## Parallel Example: User Story 3

```bash
Task: "T023 [P] [US3] Add e2e coverage for role/name discovery of document and editor Back controls in surface/e2e/surface.e2e.ts"
Task: "T024 [P] [US3] Add e2e coverage for keyboard activation with Enter and Space matching pointer Back behavior in surface/e2e/surface.e2e.ts"
Task: "T025 [P] [US3] Add e2e coverage that focus is not stranded on a removed Back control after navigation in surface/e2e/surface.e2e.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 setup and Phase 2 shared workbench history/fallback primitives.
2. Complete Phase 3 tests T009-T011 and confirm they fail against the fixed-destination behavior.
3. Complete Phase 3 implementation T012-T016.
4. Validate User Story 1 independently with targeted e2e coverage and `bun run check` from `surface/`.
5. Stop and demo the MVP if true previous-page Back behavior is ready.

### Incremental Delivery

1. Add User Story 1 to deliver true previous in-app Back behavior.
2. Add User Story 2 to harden direct-entry and unsafe-history fallback behavior.
3. Add User Story 3 to prove keyboard, assistive technology, and focus behavior.
4. Complete polish tasks and run the full validation commands from `surface/`.

### Parallel Team Strategy

1. One implementer owns shared workbench store changes in `surface/src/lib/state/workbench.svelte.ts` and `surface/src/lib/state/workbench.test.ts`.
2. One implementer owns component wiring in `surface/src/components/editor/EditorPane.svelte` and `surface/src/components/reading/ReadingPane.svelte` after shared methods exist.
3. One implementer owns e2e and accessibility evidence in `surface/e2e/surface.e2e.ts` and `docs/accessibility/surface-workbench.md`.

---

## Notes

- Safe fallback destinations must remain inside Surface and should use existing product navigation patterns.
- Do not add runtime dependencies, persistent navigation storage, spine imports, database migrations, or feature flags for this fix.
- Preserve the same visible context users get from normal back navigation; document any context that the app did not previously preserve.
- WCAG 2.2 AA keyboard operation, accessible names, and focus behavior are explicit delivery tasks, not implicit review items.
- Bilingual delivery is explicitly N/A for this feature unless new multilingual user-facing copy is introduced later.
