# Tasks: Windows Installer Release Asset Download Fix

**Input**: Design documents from `specs/bugfix-001-windows-installer-produces/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/windows-installer-assets.md`, `quickstart.md`

**Tests**: Required by `spec.md` FR-009 and `quickstart.md`; write regression checks before modifying `install.ps1`.

**Organization**: Tasks are grouped by user story so each behavior can be implemented and validated independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches a different file or has no dependency on incomplete tasks
- **[Story]**: Maps task to a user story (`US1`, `US2`, `US3`)
- Every task includes an exact file path

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the current installer/release contract and a lightweight test location before story work begins.

- [ ] T001 Inspect current release asset download flow in `install.ps1`
- [ ] T002 [P] Verify expected Windows asset names in `.github/workflows/agent-release.yml`
- [ ] T003 Create PowerShell regression test scaffold in `tests/windows-installer-assets.ps1`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Make `install.ps1` testable without performing live GitHub downloads, while preserving current installer entry behavior.

**CRITICAL**: No user story implementation should begin until the helper extraction and test fixture structure are ready.

- [ ] T004 Add representative latest-release metadata fixtures in `tests/windows-installer-assets.ps1`
- [ ] T005 Extract release metadata retrieval into a focused helper in `install.ps1`
- [ ] T006 Extract exact-name asset URL resolution into a focused helper in `install.ps1`
- [ ] T007 Update `tests/windows-installer-assets.ps1` to dot-source or load only the helper behavior from `install.ps1`

**Checkpoint**: Test scaffold can exercise asset URL resolution without running a full installer or invoking live downloads.

---

## Phase 3: User Story 1 - Download Required Windows Assets From Release Metadata (Priority: P1) MVP

**Goal**: Required agent and capture assets resolve from GitHub release metadata and download via `browser_download_url`.

**Independent Test**: Run `tests/windows-installer-assets.ps1` with metadata containing agent and capture assets and verify the resolved URLs match the fixture `browser_download_url` values.

### Tests for User Story 1

- [ ] T008 [P] [US1] Add regression test for resolving agent asset `browser_download_url` in `tests/windows-installer-assets.ps1`
- [ ] T009 [P] [US1] Add regression test for resolving capture asset `browser_download_url` in `tests/windows-installer-assets.ps1`
- [ ] T010 [US1] Run `tests/windows-installer-assets.ps1` and confirm the new US1 tests fail before changing download callsites

### Implementation for User Story 1

- [ ] T011 [US1] Replace manual tag-based agent download URL construction with release metadata URL resolution in `install.ps1`
- [ ] T012 [US1] Replace manual tag-based capture download URL construction with release metadata URL resolution in `install.ps1`
- [ ] T013 [US1] Update installer status output to report the selected release tag from metadata in `install.ps1`
- [ ] T014 [US1] Run `tests/windows-installer-assets.ps1` and confirm US1 tests pass

**Checkpoint**: Agent and capture downloads use API-provided `browser_download_url` values and can be validated independently.

---

## Phase 4: User Story 2 - Fail Clearly Before Download When Required Assets Are Missing (Priority: P2)

**Goal**: Missing required assets produce clear plain-text failures before `Invoke-WebRequest` can write invalid HTML to binary destinations.

**Independent Test**: Run `tests/windows-installer-assets.ps1` with metadata missing the agent asset and verify the resolver throws a message containing the missing asset name and release tag before any download call is made.

### Tests for User Story 2

- [ ] T015 [P] [US2] Add regression test for missing agent asset failure in `tests/windows-installer-assets.ps1`
- [ ] T016 [P] [US2] Add regression test for missing capture asset failure in `tests/windows-installer-assets.ps1`
- [ ] T017 [US2] Run `tests/windows-installer-assets.ps1` and confirm the new US2 tests fail before implementing missing-asset errors

### Implementation for User Story 2

- [ ] T018 [US2] Add required-asset missing error handling before download invocation in `install.ps1`
- [ ] T019 [US2] Ensure missing-asset errors include the asset name and release tag in `install.ps1`
- [ ] T020 [US2] Ensure missing-asset failures cannot create or overwrite destination binaries in `install.ps1`
- [ ] T021 [US2] Run `tests/windows-installer-assets.ps1` and confirm US2 tests pass

**Checkpoint**: Missing required assets fail clearly before any binary destination can receive GitHub 404 HTML.

---

## Phase 5: User Story 3 - Preserve Optional Tray Behavior And Accessible CLI Output (Priority: P3)

**Goal**: `-SkipTray` behavior remains stable, optional tray downloads resolve through metadata when enabled, and installer output remains accessible plain text.

**Independent Test**: Run `tests/windows-installer-assets.ps1` with `-SkipTray` semantics and parser validation for `install.ps1` when `pwsh` is available.

### Tests for User Story 3

- [ ] T022 [P] [US3] Add regression test that `-SkipTray` skips tray asset lookup in `tests/windows-installer-assets.ps1`
- [ ] T023 [P] [US3] Add regression test that tray asset resolves through `browser_download_url` when tray is enabled in `tests/windows-installer-assets.ps1`
- [ ] T024 [US3] Run `tests/windows-installer-assets.ps1` and confirm the new US3 tests fail before updating tray handling

### Implementation for User Story 3

- [ ] T025 [US3] Replace manual tray download URL construction with release metadata URL resolution when `-SkipTray` is not set in `install.ps1`
- [ ] T026 [US3] Preserve `-SkipTray` behavior so tray lookup and download are skipped in `install.ps1`
- [ ] T027 [US3] Review changed installer output for plain-text, copyable, non-color-dependent messages in `install.ps1`
- [ ] T028 [US3] Confirm English-only output remains consistent with existing installer scope in `install.ps1`
- [ ] T029 [US3] Run `tests/windows-installer-assets.ps1` and confirm US3 tests pass

**Checkpoint**: Optional tray behavior and accessible CLI diagnostics are preserved with metadata-based URL resolution.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, documentation updates, and bug-report closure.

- [ ] T030 Run PowerShell parser validation for `install.ps1` using the command from `specs/bugfix-001-windows-installer-produces/quickstart.md`
- [ ] T031 Update regression test status and test description in `specs/bugfix-001-windows-installer-produces/bug-report.md`
- [ ] T032 Update verification checklist in `specs/bugfix-001-windows-installer-produces/bug-report.md`
- [ ] T033 [P] Document parser validation and targeted regression results in `specs/bugfix-001-windows-installer-produces/quickstart.md`
- [ ] T034 Run `just lint` and `just check` if files beyond `install.ps1`, `tests/windows-installer-assets.ps1`, and `specs/bugfix-001-windows-installer-produces/` changed

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion; blocks all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational completion; this is the MVP.
- **User Story 2 (Phase 4)**: Depends on Foundational completion; can be implemented after or alongside US1 once helper shape is stable.
- **User Story 3 (Phase 5)**: Depends on Foundational completion; tray callsite changes are safest after US1 establishes required asset downloads.
- **Polish (Phase 6)**: Depends on desired user stories being complete.

### User Story Dependencies

- **US1 (P1)**: No dependency on other user stories after Foundational; delivers the core fix.
- **US2 (P2)**: Uses the same resolver as US1 but is independently testable with missing metadata fixtures.
- **US3 (P3)**: Uses the same resolver as US1 but is independently testable with tray-enabled and tray-skipped fixtures.

### Within Each User Story

- Write the story's regression tests first and confirm they fail before implementation.
- Implement only the `install.ps1` behavior needed for that story.
- Run the targeted PowerShell regression script before moving to the next story.

### Parallel Opportunities

- T002 can run in parallel with T001 because it inspects `.github/workflows/agent-release.yml` while T001 inspects `install.ps1`.
- T008 and T009 can run in parallel because they add independent present-asset cases in `tests/windows-installer-assets.ps1`.
- T015 and T016 can run in parallel because they add independent missing-required-asset cases in `tests/windows-installer-assets.ps1`.
- T022 and T023 can run in parallel because they cover different tray option scenarios in `tests/windows-installer-assets.ps1`.
- T033 can run in parallel with bug-report updates after validation results are known.

---

## Parallel Example: User Story 1

```bash
Task: "Add regression test for resolving agent asset browser_download_url in tests/windows-installer-assets.ps1"
Task: "Add regression test for resolving capture asset browser_download_url in tests/windows-installer-assets.ps1"
```

## Parallel Example: User Story 2

```bash
Task: "Add regression test for missing agent asset failure in tests/windows-installer-assets.ps1"
Task: "Add regression test for missing capture asset failure in tests/windows-installer-assets.ps1"
```

## Parallel Example: User Story 3

```bash
Task: "Add regression test that -SkipTray skips tray asset lookup in tests/windows-installer-assets.ps1"
Task: "Add regression test that tray asset resolves through browser_download_url when tray is enabled in tests/windows-installer-assets.ps1"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2.
2. Add US1 regression tests in `tests/windows-installer-assets.ps1` and confirm they fail.
3. Update agent and capture download callsites in `install.ps1` to use `browser_download_url` from release metadata.
4. Run US1 regression checks and stop to validate the minimum fix.

### Incremental Delivery

1. Deliver US1 to restore required Windows binary downloads.
2. Add US2 to make missing release assets fail clearly before download.
3. Add US3 to preserve optional tray behavior and review CLI output accessibility.
4. Complete parser validation and update `bug-report.md` with test and verification results.

### Validation Strategy

1. Run `tests/windows-installer-assets.ps1` after each user story.
2. Run the `install.ps1` parser validation from `quickstart.md` when `pwsh` is available.
3. Run `just lint` and `just check` only if broader repository files or CI expectations require it.
