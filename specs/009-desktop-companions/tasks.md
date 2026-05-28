# Tasks: Desktop Companions

**Input**: Design documents from `/specs/009-desktop-companions/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/desktop-companions.md, quickstart.md

**Tests**: Included because FR-014 requires automated coverage where feasible.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the existing desktop companion surface and platform files are in scope.

- [x] T001 Review desktop companion binaries and shared modules in `agent/src/bin/lattice-capture.rs`, `agent/src/bin/lattice-tray.rs`, `agent/src/bin/lattice-tray-windows.rs`, `agent/src/bin/lattice-config.rs`, `agent/src/ipc.rs`, `agent/src/ipc_client.rs`, `agent/src/platform.rs`, `agent/src/status.rs`, and `agent/src/icon.rs`
- [x] T002 Review installer/service integration in `install.sh`, `install.ps1`, `agent/lattice-tray.service`, and `agent/Cargo.toml`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared contracts and coverage that all desktop companion stories depend on.

**CRITICAL**: No user story work can begin until this phase is complete.

- [x] T003 [P] Verify ignore-file coverage for Rust, shell, PowerShell, local config, and build outputs in `.gitignore`
- [x] T004 [P] Confirm shared status/format/icon helper coverage in `agent/src/status.rs`, `agent/src/format.rs`, and `agent/src/icon.rs`
- [x] T005 Confirm local IPC command contract and error handling in `agent/src/ipc.rs` and `agent/src/ipc_client.rs`
- [x] T006 Confirm capture route contract compatibility with the desktop capture client in `spine/src/routes/agent.ts` and `spine/tests/routes/agent.test.ts`

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel.

---

## Phase 3: User Story 1 - Capture From The Desktop (Priority: P1) MVP

**Goal**: Users can capture text from arguments, standard input, and prompt flows, with retryable failures preserved locally.

**Independent Test**: Submit online and offline captures through supported input paths and verify confirmation, queue preservation, and later delivery behavior.

### Tests for User Story 1

- [x] T007 [P] [US1] Add or verify unit coverage for queued capture schema, ordered drain, retryable failure handling, and permanent rejection behavior in `agent/src/bin/lattice-capture.rs`
- [x] T008 [P] [US1] Add or verify route coverage for bearer-auth capture success and validation failures in `spine/tests/routes/agent.test.ts`

### Implementation for User Story 1

- [x] T009 [US1] Verify command-argument, stdin, and GUI prompt input handling in `agent/src/bin/lattice-capture.rs`
- [x] T010 [US1] Verify bearer-token POST payload, success feedback, and permanent/retryable error classification in `agent/src/bin/lattice-capture.rs`
- [x] T011 [US1] Verify offline queue creation, fallback diagnostics, and no-text-loss behavior in `agent/src/bin/lattice-capture.rs`

**Checkpoint**: User Story 1 should be fully functional and testable independently.

---

## Phase 4: User Story 2 - See And Control Agent Status (Priority: P2)

**Goal**: Users can see agent state from a tray/platform companion and run local control actions with text diagnostics.

**Independent Test**: Run the agent IPC server, open or exercise the tray companion, and verify status labels, service actions, and launch actions reflect local state.

### Tests for User Story 2

- [x] T012 [P] [US2] Add or verify unit coverage for IPC status and reindex protocol behavior in `agent/src/ipc.rs` and `agent/src/ipc_client.rs`
- [x] T013 [P] [US2] Add or verify status/menu label formatting coverage in `agent/src/status.rs`, `agent/src/format.rs`, and `agent/src/bin/lattice-tray.rs`

### Implementation for User Story 2

- [x] T014 [US2] Verify Linux tray status labels, start/stop/restart actions, and capture/config launch actions in `agent/src/bin/lattice-tray.rs`
- [x] T015 [US2] Verify Windows tray status/control behavior and failure diagnostics in `agent/src/bin/lattice-tray-windows.rs`
- [x] T016 [US2] Verify tray service startup and restart behavior in `agent/lattice-tray.service` and `install.sh`

**Checkpoint**: User Stories 1 and 2 should both work independently.

---

## Phase 5: User Story 3 - Edit Configuration Safely (Priority: P3)

**Goal**: Users can edit local spine/watch configuration safely, preserving comments where possible and prompting for restart or reindex.

**Independent Test**: Load missing and existing configs, save edits with comments and watch rows, reject invalid required values, and request reindex/restart.

### Tests for User Story 3

- [x] T017 [P] [US3] Add or verify config round-trip coverage for comments, quoted paths, blank patterns, duplicate watch rows, and defaults in `agent/src/config_edit.rs`
- [x] T018 [P] [US3] Add or verify config editor validation and action-state coverage in `agent/src/bin/lattice-config.rs`

### Implementation for User Story 3

- [x] T019 [US3] Verify configuration load, validation, atomic save, and comment preservation in `agent/src/config_edit.rs`
- [x] T020 [US3] Verify config editor labels, error text, save/cancel/restart/reindex prompts, and IPC failure messages in `agent/src/bin/lattice-config.rs`
- [x] T021 [US3] Verify Linux and Windows installer config creation/preservation behavior in `install.sh` and `install.ps1`

**Checkpoint**: All user stories should now be independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, accessibility evidence, installer checks, and final validation.

- [x] T022 [P] Update desktop companion setup and troubleshooting documentation in `README.md`
- [x] T023 [P] Add accessibility evidence for tray labels, notifications, config editor text, installer prompts, diagnostics, and bilingual N/A in `docs/accessibility/desktop-companions.md`
- [x] T024 Run Rust desktop companion tests with `cd agent && cargo test`
- [x] T025 Run GUI-feature Rust tests/build checks with `cd agent && cargo test --features gui`
- [x] T026 Run installer script syntax checks with `bash -n install.sh` and PowerShell parser validation for `install.ps1` where available
- [x] T027 Mark all completed desktop-companions tasks in `specs/009-desktop-companions/tasks.md`
- [x] T028 Track 009-mod-001 picker-assisted config watch paths in `specs/009-desktop-companions/modifications/001-agents-config-ui/tasks.md`, `agent/src/bin/lattice-config.rs`, `agent/src/config_edit.rs`, `agent/Cargo.toml`, `docs/accessibility/desktop-companions.md`, and `specs/009-desktop-companions/contracts/desktop-companions.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - blocks all user stories
- **User Stories (Phase 3+)**: Depend on Foundational completion; implement in priority order P1 -> P2 -> P3
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - no dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational - uses IPC/status foundation and can be tested independently
- **User Story 3 (P3)**: Can start after Foundational - uses config/IPС foundation and can be tested independently

### Within Each User Story

- Tests and coverage review before implementation confirmation
- Shared helpers before binary-specific behavior
- Core behavior before installer/service integration
- Story complete before moving to the next priority

### Parallel Opportunities

- T003, T004, T006 can run independently after setup review
- T007 and T008 can run in parallel for US1
- T012 and T013 can run in parallel for US2
- T017 and T018 can run in parallel for US3
- T022 and T023 can run in parallel during polish

---

## Parallel Example: User Story 1

```text
Task: "Add or verify unit coverage for queued capture schema, ordered drain, retryable failure handling, and permanent rejection behavior in agent/src/bin/lattice-capture.rs"
Task: "Add or verify route coverage for bearer-auth capture success and validation failures in spine/tests/routes/agent.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2 review.
2. Complete US1 capture coverage and behavior verification.
3. Validate online/offline capture behavior independently.

### Incremental Delivery

1. Complete capture first so desktop input is dependable.
2. Add tray/status controls without changing capture behavior.
3. Add safe config editing and installer validation.
4. Finish with documentation, accessibility evidence, and command verification.
