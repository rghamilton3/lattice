# Tasks: Installer Uninstall Option

**Input**: Design documents from `specs/015-installer-uninstall/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/uninstall-cli.md, quickstart.md

**Tests**: Included because `plan.md` and `quickstart.md` call for script-level regression coverage and regression-first uninstall validation.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each uninstall increment.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches a different file and has no dependency on an incomplete task.
- **[Story]**: Which user story this task belongs to (US1, US2, US3).
- Every task includes an exact file path.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare focused installer regression coverage without changing install behavior.

- [ ] T001 Create Bash installer regression test harness skeleton in `tests/linux-installer-uninstall.sh` with temporary HOME/XDG paths, assertion helpers, and no live network calls
- [ ] T002 [P] Add uninstall-focused helper assertions to `tests/windows-installer-assets.ps1` while preserving existing asset and scheduled-task tests
- [ ] T003 [P] Add a task-local implementation notes section to `specs/015-installer-uninstall/quickstart.md` for recording platform smoke-test limitations and parser validation results

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add shared uninstall parsing and reporting primitives that all user stories depend on.

**CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T004 Add early argument parsing for `--uninstall` and `--purge-config` in `install.sh` before curl/jq preflight or release metadata access
- [ ] T005 Add `-Uninstall` and `-PurgeConfig` switches to `install.ps1` and make `-SpineUrl` and `-AgentToken` required only for install mode
- [ ] T006 Add reusable uninstall result collection helpers for removed, preserved, skipped, failed, and next-action entries in `install.sh`
- [ ] T007 Add reusable uninstall result collection helpers for removed, preserved, skipped, failed, and next-action entries in `install.ps1`

**Checkpoint**: Both installers can identify uninstall mode before install-only requirements or network operations, and both scripts have a common result model for story implementation.

---

## Phase 3: User Story 1 - Remove an Existing Installation (Priority: P1) MVP

**Goal**: Users can run an explicit uninstall option that stops/removes installer-managed launch registrations and binaries, including optional components, without manual cleanup.

**Independent Test**: Create fake current-user installer artifacts under temporary paths, run the uninstall path or helper checks, and verify launch registrations and binaries are removed or skipped without network access.

### Tests for User Story 1

- [ ] T008 [P] [US1] Add Bash regression cases in `tests/linux-installer-uninstall.sh` for `./install.sh --uninstall` removing fake `lattice-agent`, `lattice-capture`, `lattice-tray`, `lattice-config`, `lattice-agent.service`, and `lattice-tray.service`
- [ ] T009 [P] [US1] Add PowerShell regression cases in `tests/windows-installer-assets.ps1` for uninstall mode not requiring `-SpineUrl` or `-AgentToken` and for scheduled-task unregister command construction

### Implementation for User Story 1

- [ ] T010 [US1] Implement Linux uninstall cleanup in `install.sh` to stop/disable/remove `lattice-agent.service` and `lattice-tray.service` when present before removing binaries
- [ ] T011 [US1] Implement Linux binary removal in `install.sh` for `${HOME}/.local/bin/lattice-agent`, `lattice-capture`, `lattice-tray`, and `lattice-config` with missing optional artifacts recorded as skipped
- [ ] T012 [US1] Implement Windows scheduled-task cleanup helpers in `install.ps1` for `LatticeAgent` and `LatticeTray`, including stop-before-delete behavior and missing tasks recorded as skipped
- [ ] T013 [US1] Implement Windows binary removal in `install.ps1` for `%LOCALAPPDATA%\lattice\lattice-agent.exe`, `lattice-capture.exe`, and `lattice-tray.exe` with missing optional artifacts recorded as skipped
- [ ] T014 [US1] Ensure uninstall mode in `install.sh` exits before `release_url`, curl downloads, interactive install prompts, config writes, or install service creation run
- [ ] T015 [US1] Ensure uninstall mode in `install.ps1` exits before `Get-LatestReleaseMetadata`, `Download-Asset`, config writes, or install task registration run

**Checkpoint**: User Story 1 is independently functional for default uninstall of installed launch registrations and executable artifacts.

---

## Phase 4: User Story 2 - Preserve User Configuration by Default (Priority: P2)

**Goal**: Default uninstall preserves user configuration, and complete removal deletes installer-created configuration only when explicitly requested.

**Independent Test**: Create temporary config directories/files, run default uninstall and purge uninstall checks, and verify config remains by default and is removed only with the explicit purge option.

### Tests for User Story 2

- [ ] T016 [P] [US2] Add Bash regression cases in `tests/linux-installer-uninstall.sh` for preserving `${XDG_CONFIG_HOME:-$HOME/.config}/lattice/config.toml` by default and removing it only with `--purge-config`
- [ ] T017 [P] [US2] Add PowerShell regression cases in `tests/windows-installer-assets.ps1` for preserving `%APPDATA%\lattice\config.toml` by default and removing it only with `-PurgeConfig`

### Implementation for User Story 2

- [ ] T018 [US2] Implement default configuration preservation and explicit `--purge-config` removal for `${XDG_CONFIG_HOME:-$HOME/.config}/lattice` in `install.sh`
- [ ] T019 [US2] Implement default configuration preservation and explicit `-PurgeConfig` removal for `%APPDATA%\lattice` in `install.ps1`
- [ ] T020 [US2] Add plain-text preserved and purged configuration messages to `install.sh` that include the affected config path
- [ ] T021 [US2] Add plain-text preserved and purged configuration messages to `install.ps1` that include the affected config path

**Checkpoint**: User Story 2 is independently functional for safe default uninstall and explicit complete-removal behavior.

---

## Phase 5: User Story 3 - Report Clear Uninstall Results (Priority: P3)

**Goal**: Uninstall output clearly reports removed, preserved, skipped, failed, and next actions in copyable plain text without color or glyph-only meaning.

**Independent Test**: Run targeted tests for complete, partial, already-removed, and failure-shaped uninstall outcomes and verify summary categories and failure next actions are present.

### Tests for User Story 3

- [ ] T022 [P] [US3] Add Bash regression cases in `tests/linux-installer-uninstall.sh` for final summary categories `Removed`, `Preserved`, `Skipped`, `Failed`, and `Next actions`
- [ ] T023 [P] [US3] Add PowerShell regression cases in `tests/windows-installer-assets.ps1` for final summary categories `Removed`, `Preserved`, `Skipped`, `Failed`, and `Next actions`

### Implementation for User Story 3

- [ ] T024 [US3] Implement final uninstall summary output in `install.sh` with removed, preserved, skipped, failed, and next-action sections in plain text
- [ ] T025 [US3] Implement final uninstall summary output in `install.ps1` with removed, preserved, skipped, failed, and next-action sections in plain text
- [ ] T026 [US3] Add actionable failure messages in `install.sh` that include component name, path or service identifier, platform error when available, and a next action
- [ ] T027 [US3] Add actionable failure messages in `install.ps1` that include component name, path or scheduled-task identifier, platform error when available, and a next action
- [ ] T028 [US3] Review all new uninstall output in `install.sh` and `install.ps1` for plain-text, copyable, non-color-dependent wording and keep bilingual delivery out of scope as documented

**Checkpoint**: User Story 3 is independently functional for diagnosable and accessible terminal output.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validate the complete feature, preserve install-only behavior, and record any platform-specific limitations.

- [ ] T029 Run Bash syntax validation with `bash -n install.sh` and record the result in `specs/015-installer-uninstall/quickstart.md`
- [ ] T030 Run Bash uninstall regression tests with `bash tests/linux-installer-uninstall.sh` and record the result in `specs/015-installer-uninstall/quickstart.md`
- [ ] T031 Run PowerShell parser validation for `install.ps1` with the command from `specs/015-installer-uninstall/quickstart.md`, or record pending Windows/CI validation there if `pwsh` is unavailable
- [ ] T032 Run PowerShell installer regression tests with `pwsh -NoProfile -File tests/windows-installer-assets.ps1`, or record pending Windows/CI validation in `specs/015-installer-uninstall/quickstart.md` if `pwsh` is unavailable
- [ ] T033 Verify default install contracts remain unchanged for `./install.sh` and `.\install.ps1 -SpineUrl https://lattice.example.com -AgentToken "<token>"` in `specs/015-installer-uninstall/contracts/uninstall-cli.md`
- [ ] T034 If broader project files were touched beyond `install.sh`, `install.ps1`, `tests/linux-installer-uninstall.sh`, `tests/windows-installer-assets.ps1`, and `specs/015-installer-uninstall/quickstart.md`, run `just lint` and `just check` and record results in `specs/015-installer-uninstall/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion; blocks all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational completion; this is the MVP.
- **User Story 2 (Phase 4)**: Depends on Foundational completion and can be developed after or alongside US1 once cleanup entry points exist.
- **User Story 3 (Phase 5)**: Depends on Foundational completion and is easiest after US1/US2 define removed, preserved, skipped, and failed outcomes.
- **Polish (Phase 6)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **US1 (P1)**: Starts after Phase 2; no dependency on US2 or US3.
- **US2 (P2)**: Starts after Phase 2; no dependency on US1 beyond using the same uninstall entry point and result helpers.
- **US3 (P3)**: Starts after Phase 2; integrates naturally with US1/US2 result data but remains testable through synthetic removed/preserved/skipped/failed outcomes.

### Within Each User Story

- Write or update story-specific tests before implementation tasks.
- Complete script parsing and helper prerequisites before calling story behavior from uninstall mode.
- Stop or unregister launch registrations before removing binaries.
- Preserve or purge configuration only after executable and launch-registration cleanup decisions are handled.
- Complete final summary output before accessibility and language review.

### Parallel Opportunities

- T001, T002, and T003 can run in parallel after setup begins because they touch different files.
- T008 and T009 can run in parallel for US1 because they cover different platforms/files.
- T016 and T017 can run in parallel for US2 because they cover different platforms/files.
- T022 and T023 can run in parallel for US3 because they cover different platforms/files.
- Linux script tasks and Windows script tasks can proceed in parallel after T004-T007 are complete, with coordination before final validation.

---

## Parallel Example: User Story 1

```bash
Task: "Add Bash regression cases in tests/linux-installer-uninstall.sh for Linux uninstall artifact removal"
Task: "Add PowerShell regression cases in tests/windows-installer-assets.ps1 for Windows uninstall argument and scheduled-task cleanup behavior"
```

## Parallel Example: User Story 2

```bash
Task: "Add Bash regression cases in tests/linux-installer-uninstall.sh for default config preservation and --purge-config removal"
Task: "Add PowerShell regression cases in tests/windows-installer-assets.ps1 for default config preservation and -PurgeConfig removal"
```

## Parallel Example: User Story 3

```bash
Task: "Add Bash regression cases in tests/linux-installer-uninstall.sh for plain-text uninstall summaries"
Task: "Add PowerShell regression cases in tests/windows-installer-assets.ps1 for plain-text uninstall summaries"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 setup tasks.
2. Complete Phase 2 foundational parsing and result-helper tasks.
3. Complete Phase 3 US1 tests and implementation.
4. Validate `./install.sh --uninstall` and `.\install.ps1 -Uninstall` remove launch registrations and binaries without network access.
5. Stop and review before adding purge behavior or summary refinements.

### Incremental Delivery

1. Add uninstall entry points and result helpers.
2. Deliver US1 default uninstall cleanup and validate independently.
3. Add US2 configuration preservation and explicit purge behavior without changing US1 cleanup.
4. Add US3 summary and failure reporting without changing removal scope.
5. Run polish validation and record parser/smoke-test limitations.

### Parallel Team Strategy

1. One developer owns Linux tasks in `install.sh` and `tests/linux-installer-uninstall.sh`.
2. One developer owns Windows tasks in `install.ps1` and `tests/windows-installer-assets.ps1`.
3. Coordinate on result category names and summary wording before US3 validation.

## Notes

- Keep uninstall local-only; do not call release metadata, curl downloads, Invoke-RestMethod, or Invoke-WebRequest in uninstall mode.
- Preserve install-only behavior for users who do not choose uninstall.
- Treat missing artifacts as skipped or already removed, not fatal failures.
- Use only plain-text output; do not use colors, icons, glyph-only markers, or terminal-specific formatting for meaning.
- Bilingual delivery remains intentionally out of scope for this English-only installer feature.
