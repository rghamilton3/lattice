# Tasks: Spine Platform

**Input**: Design documents from `/specs/001-spine-platform/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/status.md, quickstart.md

**Tests**: Test tasks are included because the specification requires independently testable user stories and measurable readiness/security outcomes.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm existing spine foundation files and test targets for this platform hardening work.

- [x] T001 Review current startup, config, DB, app, guard, and status code paths in `spine/src/index.ts`, `spine/src/config.ts`, `spine/src/db.ts`, `spine/src/app.ts`, `spine/src/guards.ts`, and `spine/src/routes/status.ts`
- [x] T002 [P] Review existing platform tests in `spine/tests/unit/config.test.ts`, `spine/tests/unit/db.test.ts`, `spine/tests/routes/guards.test.ts`, `spine/tests/routes/ping.test.ts`, and `spine/tests/routes/status.test.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add the minimal shared readiness data needed before any story-specific behavior can be delivered.

**CRITICAL**: No user story work can begin until this phase is complete.

- [x] T003 Add a platform readiness model and evaluator in `spine/src/status.ts`
- [x] T004 Wire platform readiness options through `spine/src/app.ts` without changing route ownership boundaries
- [x] T005 [P] Add test helper support for platform readiness options in `spine/tests/helpers/app.ts`

**Checkpoint**: Foundation ready - user story implementation can now begin.

---

## Phase 3: User Story 1 - Start A Self-Hosted Lattice Spine (Priority: P1) MVP

**Goal**: The spine starts from local configuration, initializes storage, serves configured static assets, and can report that the platform foundation is ready.

**Independent Test**: Start from a clean test environment and confirm storage initialization, static asset readiness, and status readiness behavior.

### Tests for User Story 1

- [x] T006 [P] [US1] Add DB initialization readiness tests in `spine/tests/unit/db.test.ts`
- [x] T007 [P] [US1] Add static asset readiness response tests in `spine/tests/routes/status.test.ts`

### Implementation for User Story 1

- [x] T008 [US1] Return migration readiness details from `spine/src/db.ts`
- [x] T009 [US1] Pass DB and static asset readiness into app construction in `spine/src/index.ts`
- [x] T010 [US1] Include storage and static asset checks in `/api/status` from `spine/src/routes/status.ts`

**Checkpoint**: User Story 1 should be independently testable with `cd spine && bun test tests/unit/db.test.ts tests/routes/status.test.ts`.

---

## Phase 4: User Story 2 - Enforce Protected Access (Priority: P2)

**Goal**: Protected browser and agent access fail closed and readiness reflects whether the configured access boundary can be enforced.

**Independent Test**: Exercise protected routes with missing, invalid, and valid access evidence and confirm private data is not exposed.

### Tests for User Story 2

- [x] T011 [P] [US2] Add access-boundary readiness tests in `spine/tests/routes/status.test.ts`
- [x] T012 [P] [US2] Extend guard tests for malformed forwarded protocol and token edge cases in `spine/tests/routes/guards.test.ts`

### Implementation for User Story 2

- [x] T013 [US2] Add configuration/access-boundary readiness checks in `spine/src/status.ts`
- [x] T014 [US2] Feed agent token, HTTP, and development-user configuration into status readiness from `spine/src/app.ts` and `spine/src/index.ts`
- [x] T015 [US2] Keep guard failures plain-language and fail-closed in `spine/src/guards.ts`

**Checkpoint**: User Stories 1 and 2 should both work independently.

---

## Phase 5: User Story 3 - Monitor Platform Health (Priority: P3)

**Goal**: Operators can inspect a clear authenticated status response with `ready`, `state`, named checks, and existing agent status details.

**Independent Test**: Request `/api/status` under healthy and intentionally unhealthy platform conditions and verify the response identifies readiness in under 10 seconds.

### Tests for User Story 3

- [x] T016 [P] [US3] Add status contract shape tests for `ready`, `state`, and `checks` in `spine/tests/routes/status.test.ts`
- [x] T017 [P] [US3] Add quickstart-oriented fail-closed status test coverage in `spine/tests/routes/status.test.ts`

### Implementation for User Story 3

- [x] T018 [US3] Update `/api/status` response shape to match `specs/001-spine-platform/contracts/status.md` in `spine/src/routes/status.ts`
- [x] T019 [US3] Preserve existing `agents` and `active_agent_count` status fields in `spine/src/routes/status.ts`
- [x] T020 [US3] Ensure operator-facing status messages use plain text and no color-only distinctions in `spine/src/status.ts`

**Checkpoint**: All user stories should now be independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validate the feature, documentation, accessibility governance, and branch state.

- [x] T021 [P] Update operator quickstart or README references if implementation changes commands in `README.md` or `Justfile`
- [x] T022 [P] Confirm A11Y/language decisions remain accurate in `specs/001-spine-platform/plan.md` and no `docs/accessibility/` evidence is needed
- [x] T023 Run targeted tests with `cd spine && bun test tests/unit/db.test.ts tests/routes/status.test.ts tests/routes/guards.test.ts`
- [x] T024 Run full spine tests with `cd spine && bun test`
- [x] T025 Run type/lint validation with `just check` and `just lint` when dependencies are available

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup completion and blocks all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational completion.
- **User Story 2 (Phase 4)**: Depends on Foundational completion; can be implemented after or alongside US1, but sequential order is preferred for this branch.
- **User Story 3 (Phase 5)**: Depends on Foundational completion; final response shape should preserve fields from US1 and US2.
- **Polish (Phase 6)**: Depends on selected user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: No dependency on other user stories after Foundation.
- **User Story 2 (P2)**: No dependency on US1 behavior, but shares readiness model from Foundation.
- **User Story 3 (P3)**: Depends on the readiness checks produced by US1 and US2 to present the complete status response.

### Parallel Opportunities

- T002 can run alongside T001.
- T005 can run after T003 interface shape is known and before T004 is complete.
- T006 and T007 can be written in parallel.
- T011 and T012 can be written in parallel.
- T016 and T017 can be written in parallel.
- T021 and T022 can be completed in parallel during polish.

---

## Parallel Example: User Story 1

```bash
Task: "Add DB initialization readiness tests in spine/tests/unit/db.test.ts"
Task: "Add static asset readiness response tests in spine/tests/routes/status.test.ts"
```

## Parallel Example: User Story 2

```bash
Task: "Add access-boundary readiness tests in spine/tests/routes/status.test.ts"
Task: "Extend guard tests for malformed forwarded protocol and token edge cases in spine/tests/routes/guards.test.ts"
```

## Parallel Example: User Story 3

```bash
Task: "Add status contract shape tests for ready, state, and checks in spine/tests/routes/status.test.ts"
Task: "Add quickstart-oriented fail-closed status test coverage in spine/tests/routes/status.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Setup and Foundational readiness plumbing.
2. Implement storage/static readiness tests and behavior for US1.
3. Validate with targeted DB and status tests.
4. Stop and confirm the spine can report core foundation readiness for startup/storage/static serving.

### Incremental Delivery

1. Foundation readiness model.
2. US1 startup/storage/static readiness.
3. US2 fail-closed access-boundary readiness.
4. US3 final operator status contract.
5. Polish with targeted and full validation.

## Notes

- Keep changes minimal and spine-scoped.
- Do not introduce new runtime dependencies.
- Do not add persisted readiness state unless implementation reveals a concrete requirement.
- Preserve `/ping` as liveness and `/api/status` as authenticated readiness/status.
