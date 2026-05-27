# Tasks: Config UI Watch Path File Picker

**Input**: Design documents from `/specs/009-desktop-companions/modifications/001-agents-config-ui/`

**Prerequisites**: plan.md, modification-spec.md, research.md, data-model.md, contracts/desktop-companions.md, quickstart.md

**Tests**: Included because modified FR-014 requires watch-path picker state coverage where feasible and the modification spec marks TDD unchecked.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the picker mechanism and keep dependency changes scoped to the existing GUI feature.

- [x] T001 Inspect the current `eframe`/egui dependency surface for an existing native directory picker before adding dependencies in `agent/Cargo.toml`
- [x] T002 Add an optional native directory picker dependency under the existing `gui` feature only if T001 confirms no built-in picker is available in `agent/Cargo.toml`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create testable seams for picker outcomes without changing config persistence semantics.

**CRITICAL**: No user story work can begin until this phase is complete.

- [x] T003 Introduce a minimal picker-result helper or method that applies selected/canceled/failed outcomes to watch rows in `agent/src/bin/lattice-config.rs`
- [x] T004 [P] Confirm `agent/src/config_edit.rs` remains the sole validation/save path for watch row strings and document any required test-only helper changes in `agent/src/config_edit.rs`

**Checkpoint**: Picker state can be exercised without bypassing existing config validation and save behavior.

---

## Phase 3: User Story 1 - Choose Watch Path Through Picker (Priority: P1) MVP

**Goal**: Users can activate a visible picker control on each watch path row, select a directory, and see the selected value in the existing path field.

**Independent Test**: With a loaded config row, simulate or manually perform a successful directory selection and verify the intended row path changes while save still writes the existing `[[agent.watch]] path = "..."` TOML shape.

### Tests for User Story 1

- [x] T005 [P] [US1] Add a config UI state test for successful picker selection updating only the targeted watch row in `agent/src/bin/lattice-config.rs`
- [x] T006 [P] [US1] Add or extend config round-trip coverage proving picker-selected path strings save through the existing TOML representation in `agent/src/config_edit.rs`

### Implementation for User Story 1

- [x] T007 [US1] Add a visible `Choose...` or `Browse...` picker button beside each watch path text field in `agent/src/bin/lattice-config.rs`
- [x] T008 [US1] Wire successful native directory selections into the same `WatchRow.path` string used by manual editing in `agent/src/bin/lattice-config.rs`
- [x] T009 [US1] Ensure saving after picker selection still calls `config_edit::validate`, `config_edit::apply`, and `config_edit::save` without picker-specific persistence in `agent/src/bin/lattice-config.rs`

**Checkpoint**: User Story 1 is fully functional and testable independently.

---

## Phase 4: User Story 2 - Cancel Or Failure Preserves Path (Priority: P2)

**Goal**: Opening the picker is safe: canceling or failing to open/select leaves the previous watch path unchanged and provides clear text feedback when user action is needed.

**Independent Test**: Start with a non-empty watch path, trigger cancel and failure paths through tests or manual smoke, and verify the path remains unchanged with no destructive side effects.

### Tests for User Story 2

- [x] T010 [P] [US2] Add a cancellation regression test that preserves the existing watch row path in `agent/src/bin/lattice-config.rs`
- [x] T011 [P] [US2] Add a picker failure regression test that preserves the existing watch row path and exposes actionable text when appropriate in `agent/src/bin/lattice-config.rs`

### Implementation for User Story 2

- [x] T012 [US2] Implement picker cancel handling as a no-op on `WatchRow.path` in `agent/src/bin/lattice-config.rs`
- [x] T013 [US2] Implement picker launch or selection failure handling with plain text modal/status feedback and no path mutation in `agent/src/bin/lattice-config.rs`
- [x] T014 [US2] Verify save, cancel, reindex, and restart controls remain usable after picker cancel or failure in `agent/src/bin/lattice-config.rs`

**Checkpoint**: User Stories 1 and 2 both work independently.

---

## Phase 5: User Story 3 - Manual Fallback And Evidence (Priority: P3)

**Goal**: Manual path editing remains available as the correction/accessibility fallback, and contracts plus accessibility evidence describe the new picker behavior.

**Independent Test**: Type a path manually, save it through the config editor, and verify docs/evidence record picker labels, keyboard/focus behavior where feasible, fallback behavior, and bilingual N/A.

### Tests for User Story 3

- [x] T015 [P] [US3] Add or extend regression coverage that manually typed paths still validate and save after picker support in `agent/src/bin/lattice-config.rs`
- [x] T016 [P] [US3] Add or extend config edit coverage for quoted paths, backslashes, tilde paths, blank patterns, and duplicate rows remaining unchanged by picker support in `agent/src/config_edit.rs`

### Implementation for User Story 3

- [x] T017 [US3] Preserve the editable watch path text field or document an equivalent accessible correction fallback in `agent/src/bin/lattice-config.rs`
- [x] T018 [P] [US3] Fold the picker behavior contract delta into the original config editor contract in `specs/009-desktop-companions/contracts/desktop-companions.md`
- [x] T019 [P] [US3] Record picker label, keyboard/focus behavior where feasible, non-icon/color-only state, fallback/failure text, and bilingual N/A in `docs/accessibility/desktop-companions.md`

**Checkpoint**: All modification user stories are independently functional and documented.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validate the full modification and align tracking docs.

- [x] T020 [P] Update the original Desktop Companions task references for this modification in `specs/009-desktop-companions/tasks.md`
- [x] T021 [P] Run local quickstart checks from `specs/009-desktop-companions/modifications/001-agents-config-ui/quickstart.md` with `cd agent && cargo test`
- [x] T022 Run GUI-feature validation from `specs/009-desktop-companions/modifications/001-agents-config-ui/quickstart.md` with `cd agent && cargo test --features gui`
- [x] T023 Run GUI binary build validation from `specs/009-desktop-companions/modifications/001-agents-config-ui/quickstart.md` with `cd agent && cargo build --features gui --bin lattice-config`
- [x] T024 Update completion status for this modification in `specs/009-desktop-companions/modifications/001-agents-config-ui/tasks.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - blocks all user stories
- **User Stories (Phase 3+)**: Depend on Foundational completion; implement in priority order P1 -> P2 -> P3
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - no dependency on other modification stories
- **User Story 2 (P2)**: Can start after Foundational - safest after US1 picker button/result path exists, but cancel/failure helper tests can be developed independently
- **User Story 3 (P3)**: Can start after Foundational - docs/evidence tasks can run in parallel once UI copy and behavior are known

### Within Each User Story

- Tests MUST be written and fail or document why they cannot fail before implementation
- Picker state helper before GUI button wiring
- GUI button/result handling before manual smoke validation
- Documentation and accessibility evidence before final completion status updates

### Parallel Opportunities

- T004 can run in parallel with T003 after dependency scope is known
- T005 and T006 can run in parallel for US1
- T010 and T011 can run in parallel for US2
- T015 and T016 can run in parallel for US3
- T018 and T019 can run in parallel after UI behavior is implemented
- T020 and T021 can run in parallel during polish before final GUI validation

---

## Parallel Example: User Story 1

```text
Task: "Add a config UI state test for successful picker selection updating only the targeted watch row in agent/src/bin/lattice-config.rs"
Task: "Add or extend config round-trip coverage proving picker-selected path strings save through the existing TOML representation in agent/src/config_edit.rs"
```

---

## Parallel Example: User Story 2

```text
Task: "Add a cancellation regression test that preserves the existing watch row path in agent/src/bin/lattice-config.rs"
Task: "Add a picker failure regression test that preserves the existing watch row path and exposes actionable text when appropriate in agent/src/bin/lattice-config.rs"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2 so picker dependency and state seams are settled.
2. Complete US1 tests and implementation for successful directory selection.
3. Validate that selected paths save through the unchanged TOML shape.
4. Stop and demo the picker selection path before adding cancel/failure polish.

### Incremental Delivery

1. Add successful picker selection while preserving manual path editing.
2. Add safe cancel/failure behavior and text feedback.
3. Confirm manual fallback, edge-case path handling, contracts, and accessibility evidence.
4. Finish with `cargo test`, `cargo test --features gui`, and `cargo build --features gui --bin lattice-config`.

### Parallel Team Strategy

With multiple developers:

1. One developer confirms/implements the optional GUI picker dependency in `agent/Cargo.toml`.
2. One developer writes UI-state tests in `agent/src/bin/lattice-config.rs`.
3. One developer updates contracts and accessibility evidence in `specs/009-desktop-companions/contracts/desktop-companions.md` and `docs/accessibility/desktop-companions.md` after UI labels are known.
