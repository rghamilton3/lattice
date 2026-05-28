---

description: "Task list for Product Updates implementation"
---

# Tasks: Product Updates

**Input**: Design documents from `/specs/012-product-updates/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/update-cli.md`, `contracts/release-artifacts.md`, `quickstart.md`

**Tests**: Required by FR-015 and quickstart coverage. Test tasks are included before implementation tasks for each user story.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files or does not depend on incomplete tasks
- **[Story]**: Maps to user stories from `spec.md`
- Every task includes an exact file path

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare source files, release metadata contract fixtures, and accessibility evidence locations shared by all stories.

- [X] T001 Add update module declaration to `agent/src/main.rs`
- [X] T002 Create updater module skeleton and public command entry points in `agent/src/update.rs`
- [X] T003 [P] Create release metadata fixture directory in `agent/tests/fixtures/update/README.md`
- [X] T004 [P] Create product updates accessibility evidence file in `docs/accessibility/product-updates.md`
- [X] T005 [P] Add product update quickstart notes to `agent/README.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core updater primitives that must exist before any user story can be implemented.

**CRITICAL**: No user story work can begin until this phase is complete.

- [X] T006 Implement product, artifact, available update, user state, and update attempt structs in `agent/src/update.rs`
- [X] T007 Implement version parsing and comparison for stable, unknown, malformed, and dev-build versions in `agent/src/update.rs`
- [X] T008 Implement platform install-path and data-path discovery helpers for updater use in `agent/src/platform.rs`
- [X] T009 Implement local staging directory and history path helpers under the platform data directory in `agent/src/update.rs`
- [X] T010 Implement plain-text status and next-action message helpers in `agent/src/update.rs`
- [X] T011 [P] Add unit tests for version parsing and update status transitions in `agent/src/update.rs`
- [X] T012 [P] Add unit tests for platform path discovery and staging path constraints in `agent/src/platform.rs`
- [X] T013 Create release metadata fixtures for current, newer, missing-checksum, platform-mismatch, and corrupted-artifact cases in `agent/tests/fixtures/update/releases.json`
- [X] T014 Implement release metadata parsing and artifact matching from `agent/tests/fixtures/update/releases.json` contract shape in `agent/src/update.rs`
- [X] T015 Implement checksum or manifest verification helper that refuses missing or mismatched verification data in `agent/src/update.rs`

**Checkpoint**: Foundation ready. User story implementation can now begin in priority order or in parallel where tasks do not touch the same files.

---

## Phase 3: User Story 1 - Update Local Agents Reliably (Priority: P1) MVP

**Goal**: A Lattice operator can check for, understand, and apply local agent updates without losing configuration, service state, queued work, or indexing progress.

**Independent Test**: Install or simulate an older configured agent, run check and apply flows, and verify the agent version changes while config, service behavior, queues, and cache files remain intact.

### Tests for User Story 1

- [X] T016 [P] [US1] Add check-only contract tests for `lattice-agent update check` in `agent/src/update.rs`
- [X] T017 [P] [US1] Add successful agent apply test with preserved config, cache, queue, and history files in `agent/src/update.rs`
- [X] T018 [P] [US1] Add failed verification test proving installed agent binary remains unchanged in `agent/src/update.rs`
- [X] T019 [P] [US1] Add declined-confirmation test for exit code 4 behavior in `agent/src/update.rs`

### Implementation for User Story 1

- [X] T020 [US1] Add CLI argument routing for `update check`, `update apply lattice-agent`, and `update apply --all-supported` in `agent/src/main.rs`
- [X] T021 [US1] Implement installed `lattice-agent` discovery with product id, path, version, eligibility, and status in `agent/src/update.rs`
- [X] T022 [US1] Implement check-only output that lists product, installed version, latest version, status, and next action without modifying files in `agent/src/update.rs`
- [X] T023 [US1] Implement explicit operator confirmation before replacing the agent binary in `agent/src/update.rs`
- [X] T024 [US1] Implement staged download/copy, verification, and atomic replacement for the agent executable in `agent/src/update.rs`
- [X] T025 [US1] Implement config, queue, cache, history, and service-definition preservation checks before replacement in `agent/src/update.rs`
- [X] T026 [US1] Implement platform-native agent restart or restart-instruction output for Linux systemd user services and Windows Task Scheduler in `agent/src/update.rs`
- [X] T027 [US1] Record check, success, already-current, failed-verification, failed-installation, declined-confirmation, and offline attempts in local history from `agent/src/update.rs`
- [X] T028 [US1] Document local agent update commands and failure recovery in `agent/README.md`

**Checkpoint**: User Story 1 is fully functional and independently testable as the MVP.

---

## Phase 4: User Story 2 - Keep Desktop Capture Current (Priority: P2)

**Goal**: Desktop capture companions update with the local agent while preserving capture text and keeping tray/config/capture diagnostics consistent.

**Independent Test**: Install or simulate older desktop companion binaries, apply companion updates, and verify quick capture, tray launch, status display, and config launch still work afterward.

### Tests for User Story 2

- [X] T029 [P] [US2] Add desktop companion discovery tests for `lattice-capture`, `lattice-tray`, and `lattice-config` in `agent/src/update.rs`
- [X] T030 [P] [US2] Add companion apply test verifying capture queue text survives update interruption in `agent/src/update.rs`
- [X] T031 [P] [US2] Add post-update quick capture smoke-test script in `agent/tests/fixtures/update/desktop-smoke.sh`

### Implementation for User Story 2

- [X] T032 [US2] Implement installed desktop companion discovery and platform-specific artifact matching in `agent/src/update.rs`
- [X] T033 [US2] Implement `lattice-agent update apply desktop-companions` selection behavior in `agent/src/update.rs`
- [X] T034 [US2] Extend `--all-supported` apply to include installed desktop companions with the agent unless explicitly excluded in `agent/src/update.rs`
- [X] T035 [US2] Preserve queued capture text and companion state during companion replacement in `agent/src/update.rs`
- [X] T036 [US2] Emit plain-language desktop companion interruption and unsupported-environment diagnostics in `agent/src/update.rs`
- [X] T037 [US2] Document desktop capture companion update behavior and smoke verification in `agent/README.md`

**Checkpoint**: User Stories 1 and 2 work independently and together.

---

## Phase 5: User Story 3 - Discover Updates Across Products (Priority: P3)

**Goal**: Operators can see update capability, installed/latest versions, and manual guidance for all recognized Lattice products.

**Independent Test**: Run update discovery against a mixed installation and verify automatic products, unsupported products, unknown versions, offline metadata, and dev builds are reported clearly without applying changes.

### Tests for User Story 3

- [X] T038 [P] [US3] Add mixed-product discovery tests for agent, companions, spine, surface, installer assets, unknown products, and dev builds in `agent/src/update.rs`
- [X] T039 [P] [US3] Add offline metadata test that preserves installed versions and reports unavailable latest versions in `agent/src/update.rs`
- [X] T040 [P] [US3] Add manual guidance output fixture for spine, surface, Docker deployment files, customized service units, and installer scripts in `agent/tests/fixtures/update/manual-guidance.txt`

### Implementation for User Story 3

- [X] T041 [US3] Implement manual-guidance product records for spine, surface, Docker deployment files, installer scripts, customized service units, and unknown products in `agent/src/update.rs`
- [X] T042 [US3] Implement unsupported, manual-update-required, offline, current, update-available, unknown, and dev-build status classification in `agent/src/update.rs`
- [X] T043 [US3] Ensure check-only discovery never replaces files, restarts services, edits config, or mutates queues and caches in `agent/src/update.rs`
- [X] T044 [US3] Add update discovery and manual guidance notes to `README.md`

**Checkpoint**: User Stories 1, 2, and 3 are independently functional.

---

## Phase 6: User Story 4 - Audit Update Outcomes (Priority: P4)

**Goal**: Operators can review recent update attempts with products, versions, outcomes, times, and next actions.

**Independent Test**: Run successful, skipped, offline, failed-verification, interrupted, and manual-action attempts, then verify `lattice-agent update history` prints them in reverse chronological order with readable recovery guidance.

### Tests for User Story 4

- [X] T045 [P] [US4] Add update history read/write tests for all required outcomes in `agent/src/update.rs`
- [X] T046 [P] [US4] Add history output accessibility test for product, outcome, timestamp, and next-action text in `agent/src/update.rs`

### Implementation for User Story 4

- [X] T047 [US4] Implement durable local update attempt history storage in `agent/src/update.rs`
- [X] T048 [US4] Implement `lattice-agent update history` CLI routing in `agent/src/main.rs`
- [X] T049 [US4] Implement reverse-chronological plain-text history rendering in `agent/src/update.rs`
- [X] T050 [US4] Document update history output and troubleshooting use in `agent/README.md`

**Checkpoint**: All user stories are independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Validation, installer integration, release contract alignment, accessibility evidence, and final quality checks across all stories.

- [X] T051 [P] Add Linux installer update command guidance and status text to `install.sh`
- [X] T052 [P] Add Windows installer update command guidance and status text to `install.ps1`
- [X] T053 [P] Update agent release workflow to publish checksum or manifest metadata for updater verification in `.github/workflows/agent-release.yml`
- [X] T054 [P] Add CLI accessibility evidence for check-only, success, failed verification, offline, interrupted, manual guidance, and history output in `docs/accessibility/product-updates.md`
- [X] T055 [P] Document bilingual delivery as N/A with rationale in `docs/accessibility/product-updates.md`
- [X] T056 Review all updater terminal, installer, service-log, history, and notification copy for plain-language product, outcome, and next-action text in `agent/src/update.rs`
- [X] T057 Run Rust updater tests with `cargo test --manifest-path agent/Cargo.toml`
- [X] T058 Run Linux installer syntax check with `bash -n install.sh`
- [X] T059 Run PowerShell parser validation for `install.ps1` where PowerShell is available
- [X] T060 Run repository quality checks with `just lint` and `just check`
- [X] T061 Execute the product update verification flow from `specs/012-product-updates/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion; blocks all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational; recommended MVP
- **User Story 2 (Phase 4)**: Depends on Foundational and uses US1 apply flow, but remains independently testable with companion-only fixtures
- **User Story 3 (Phase 5)**: Depends on Foundational; can run after US1 discovery primitives exist
- **User Story 4 (Phase 6)**: Depends on Foundational; integrates history records from prior stories
- **Polish (Phase 7)**: Depends on all desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: Can start after Phase 2; no dependency on other user stories
- **US2 (P2)**: Can start after Phase 2; benefits from US1 staging/apply helpers
- **US3 (P3)**: Can start after Phase 2; discovery is independently testable without apply
- **US4 (P4)**: Can start after Phase 2; history rendering is independently testable with fixture attempts

### Within Each User Story

- Write tests before implementation tasks in that story
- Implement discovery before check/apply behavior
- Implement staging and verification before replacement behavior
- Implement preservation checks before restart behavior
- Complete each story checkpoint before relying on it in later story work

---

## Parallel Opportunities

- T003, T004, and T005 can run in parallel during setup
- T011 and T012 can run in parallel once foundational structs and helpers exist
- US1 test tasks T016 through T019 can be drafted in parallel
- US2 test tasks T029 through T031 can be drafted in parallel
- US3 test tasks T038 through T040 can be drafted in parallel
- US4 test tasks T045 and T046 can be drafted in parallel
- Polish tasks T051 through T055 can run in parallel after updater output behavior stabilizes

## Parallel Example: User Story 1

```bash
Task: "Add check-only contract tests for `lattice-agent update check` in agent/src/update.rs"
Task: "Add successful agent apply test with preserved config, cache, queue, and history files in agent/src/update.rs"
Task: "Add failed verification test proving installed agent binary remains unchanged in agent/src/update.rs"
Task: "Add declined-confirmation test for exit code 4 behavior in agent/src/update.rs"
```

## Parallel Example: User Story 2

```bash
Task: "Add desktop companion discovery tests for lattice-capture, lattice-tray, and lattice-config in agent/src/update.rs"
Task: "Add companion apply test verifying capture queue text survives update interruption in agent/src/update.rs"
Task: "Add post-update quick capture smoke-test script in agent/tests/fixtures/update/desktop-smoke.sh"
```

## Parallel Example: User Story 3

```bash
Task: "Add mixed-product discovery tests for agent, companions, spine, surface, installer assets, unknown products, and dev builds in agent/src/update.rs"
Task: "Add offline metadata test that preserves installed versions and reports unavailable latest versions in agent/src/update.rs"
Task: "Add manual guidance output fixture in agent/tests/fixtures/update/manual-guidance.txt"
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. Stop and validate `lattice-agent update check`, `lattice-agent update apply lattice-agent`, state preservation, failed verification, and local history records
5. Demo or merge MVP if the agent update path is safe and documented

### Incremental Delivery

1. Add US1 for safe local agent updates
2. Add US2 for desktop companion updates
3. Add US3 for all-product discovery and manual guidance
4. Add US4 for readable audit history
5. Complete Phase 7 validation and evidence before merge

### Notes

- Keep automatic updates scoped to `lattice-agent`, `lattice-capture`, `lattice-tray`, and `lattice-config` for this slice
- Do not add new hosted services, accounts, telemetry, or private-content transmission
- Do not overwrite config, queues, caches, customized service definitions, or user data without explicit documented confirmation
- Keep status durable and readable in terminals, installers, service logs, history output, and notifications without color/icon-only signals
