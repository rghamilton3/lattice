# Tasks: Windows Installer Release Asset Download Fix

**Input**: Design documents from `specs/bugfix-001-windows-installer-produces/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/windows-installer-assets.md`, `quickstart.md`

**Tests**: Required by `spec.md` FR-009 and `quickstart.md`; add regression checks before changing `install.ps1` behavior.

**Organization**: Tasks are grouped by user story so each behavior can be implemented and validated independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches a different file or has no dependency on incomplete tasks
- **[Story]**: Maps task to a user story (`US1`, `US2`, `US3`)
- Every task includes an exact file path

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the installer/release asset contract and a lightweight regression-test location before story work begins.

- [X] T001 Inspect current latest-release lookup and binary download flow in `install.ps1`
- [X] T002 [P] Verify expected Windows asset publication names in `.github/workflows/agent-release.yml`
- [X] T003 [P] Review the release asset contract in `specs/bugfix-001-windows-installer-produces/contracts/windows-installer-assets.md`
- [X] T004 Create PowerShell regression test scaffold in `tests/windows-installer-assets.ps1`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Make the installer asset-resolution behavior testable without performing live GitHub downloads.

**CRITICAL**: No user story implementation should begin until helper extraction and metadata fixtures are ready.

- [X] T005 Add representative latest-release metadata fixtures with `tag_name`, `assets[].name`, and `assets[].browser_download_url` in `tests/windows-installer-assets.ps1`
- [X] T006 Extract latest release metadata retrieval into `Get-LatestReleaseMetadata` in `install.ps1`
- [X] T007 Extract exact-name asset URL lookup into `Get-ReleaseAssetUrl` in `install.ps1`
- [X] T008 Add import-only guard so `tests/windows-installer-assets.ps1` can load helper functions from `install.ps1` without running the installer body
- [X] T009 Add a reusable assertion helper for PowerShell regression checks in `tests/windows-installer-assets.ps1`

**Checkpoint**: Test scaffold can exercise asset URL resolution without running a full installer or invoking live downloads.

---

## Phase 3: User Story 1 - Download Required Windows Assets From Release Metadata (Priority: P1) MVP

**Goal**: Required agent and capture assets resolve from GitHub release metadata and download via API-provided `browser_download_url` values.

**Independent Test**: Run `tests/windows-installer-assets.ps1` with metadata containing agent and capture assets and verify the resolved URLs match the fixture `browser_download_url` values.

### Tests for User Story 1

- [X] T010 [P] [US1] Add regression test for resolving `lattice-agent-x86_64-pc-windows-msvc.exe` to its `browser_download_url` in `tests/windows-installer-assets.ps1`
- [X] T011 [P] [US1] Add regression test for resolving `lattice-capture-x86_64-pc-windows-msvc.exe` to its `browser_download_url` in `tests/windows-installer-assets.ps1`
- [X] T012 [US1] Run `pwsh -NoProfile -File tests/windows-installer-assets.ps1` and confirm US1 tests fail before changing download callsites

### Implementation for User Story 1

- [X] T013 [US1] Replace manual tag-based agent download URL construction with release metadata URL resolution in `install.ps1`
- [X] T014 [US1] Replace manual tag-based capture download URL construction with release metadata URL resolution in `install.ps1`
- [X] T015 [US1] Update installer status output to report the selected release tag from metadata in `install.ps1`
- [X] T016 [US1] Run `pwsh -NoProfile -File tests/windows-installer-assets.ps1` and confirm US1 tests pass

**Checkpoint**: Agent and capture downloads use API-provided `browser_download_url` values and can be validated independently.

---

## Phase 4: User Story 2 - Fail Clearly Before Download When Required Assets Are Missing (Priority: P2)

**Goal**: Missing required assets produce clear plain-text failures before `Invoke-WebRequest` can write invalid HTML to binary destinations.

**Independent Test**: Run `tests/windows-installer-assets.ps1` with metadata missing each required asset and verify the resolver throws a message containing the missing asset name and release tag before any download call is made.

### Tests for User Story 2

- [X] T017 [P] [US2] Add regression test for missing `lattice-agent-x86_64-pc-windows-msvc.exe` failure in `tests/windows-installer-assets.ps1`
- [X] T018 [P] [US2] Add regression test for missing `lattice-capture-x86_64-pc-windows-msvc.exe` failure in `tests/windows-installer-assets.ps1`
- [X] T019 [US2] Run `pwsh -NoProfile -File tests/windows-installer-assets.ps1` and confirm US2 tests fail before implementing missing-asset errors

### Implementation for User Story 2

- [X] T020 [US2] Add required-asset missing error handling before each download invocation in `install.ps1`
- [X] T021 [US2] Ensure missing-asset errors include the exact asset name and latest release tag in `install.ps1`
- [X] T022 [US2] Ensure missing-asset failures occur before `Invoke-WebRequest` can create or overwrite destination binaries in `install.ps1`
- [X] T023 [US2] Run `pwsh -NoProfile -File tests/windows-installer-assets.ps1` and confirm US2 tests pass

**Checkpoint**: Missing required assets fail clearly before any binary destination can receive GitHub 404 HTML.

---

## Phase 5: User Story 3 - Preserve Optional Tray Behavior And Accessible CLI Output (Priority: P3)

**Goal**: `-SkipTray` behavior remains stable, optional tray downloads resolve through metadata when enabled, and installer output remains accessible plain text.

**Independent Test**: Run resolver checks with and without `-SkipTray`, then run PowerShell parser validation for `install.ps1` when `pwsh` is available.

### Tests for User Story 3

- [X] T024 [P] [US3] Add regression test that `-SkipTray` skips `lattice-tray-x86_64-pc-windows-msvc.exe` lookup in `tests/windows-installer-assets.ps1`
- [X] T025 [P] [US3] Add regression test that tray asset resolves through `browser_download_url` when tray is enabled in `tests/windows-installer-assets.ps1`
- [X] T026 [US3] Run `pwsh -NoProfile -File tests/windows-installer-assets.ps1` and confirm US3 tests fail before updating tray handling

### Implementation for User Story 3

- [X] T027 [US3] Replace manual tray download URL construction with release metadata URL resolution when `-SkipTray` is not set in `install.ps1`
- [X] T028 [US3] Preserve `-SkipTray` behavior so tray lookup and download are skipped in `install.ps1`
- [X] T029 [US3] Review changed installer output for plain-text, copyable, non-color-dependent messages in `install.ps1`
- [X] T030 [US3] Confirm user-facing installer output remains English-only and document bilingual delivery as out of scope in `specs/bugfix-001-windows-installer-produces/quickstart.md`
- [X] T031 [US3] Run `pwsh -NoProfile -File tests/windows-installer-assets.ps1` and confirm US3 tests pass

**Checkpoint**: Optional tray behavior and accessible CLI diagnostics are preserved with metadata-based URL resolution.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, documentation updates, and bug-report closure.

- [X] T032 Run PowerShell parser validation for `install.ps1` using the command from `specs/bugfix-001-windows-installer-produces/quickstart.md`
- [X] T033 Update regression test status and test description in `specs/bugfix-001-windows-installer-produces/bug-report.md`
- [X] T034 Update verification checklist in `specs/bugfix-001-windows-installer-produces/bug-report.md`
- [X] T035 [P] Document parser validation and targeted regression results in `specs/bugfix-001-windows-installer-produces/quickstart.md`
- [X] T036 Run `just lint` if files beyond `install.ps1`, `tests/windows-installer-assets.ps1`, and `specs/bugfix-001-windows-installer-produces/` changed
- [X] T037 Run `just check` if files beyond `install.ps1`, `tests/windows-installer-assets.ps1`, and `specs/bugfix-001-windows-installer-produces/` changed

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

- T002 and T003 can run in parallel because they inspect different contract sources.
- T010 and T011 can run in parallel because they add independent present-asset cases in `tests/windows-installer-assets.ps1`.
- T017 and T018 can run in parallel because they add independent missing-required-asset cases in `tests/windows-installer-assets.ps1`.
- T024 and T025 can run in parallel because they cover different tray option scenarios in `tests/windows-installer-assets.ps1`.
- T035 can run in parallel with bug-report updates after validation results are known.

---

## Parallel Example: User Story 1

```bash
Task: "Add regression test for resolving lattice-agent-x86_64-pc-windows-msvc.exe to its browser_download_url in tests/windows-installer-assets.ps1"
Task: "Add regression test for resolving lattice-capture-x86_64-pc-windows-msvc.exe to its browser_download_url in tests/windows-installer-assets.ps1"
```

## Parallel Example: User Story 2

```bash
Task: "Add regression test for missing lattice-agent-x86_64-pc-windows-msvc.exe failure in tests/windows-installer-assets.ps1"
Task: "Add regression test for missing lattice-capture-x86_64-pc-windows-msvc.exe failure in tests/windows-installer-assets.ps1"
```

## Parallel Example: User Story 3

```bash
Task: "Add regression test that -SkipTray skips lattice-tray-x86_64-pc-windows-msvc.exe lookup in tests/windows-installer-assets.ps1"
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

1. Run `pwsh -NoProfile -File tests/windows-installer-assets.ps1` after each user story.
2. Run the `install.ps1` parser validation from `quickstart.md` when `pwsh` is available.
3. Run `just lint` and `just check` only if broader repository files or CI expectations require it.

### Parallel Team Strategy

1. Complete Setup and Foundational tasks together first.
2. Once Foundational is complete, assign US1, US2, and US3 tests to different developers if capacity allows.
3. Coordinate final `install.ps1` callsite changes because all user stories touch the same installer file.
