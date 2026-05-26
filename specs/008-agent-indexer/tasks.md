# Tasks: Agent Indexer

**Input**: Design documents from `specs/008-agent-indexer/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/agent-indexer.md`, `quickstart.md`

## Phase 1: Setup

- [x] T001 Review existing agent polling, extraction, cache, config, and service behavior in `agent/src/main.rs`, `agent/src/scan.rs`, `agent/src/extract.rs`, `agent/src/cache.rs`, `agent/src/config.rs`, and `agent/lattice-agent.service`
- [x] T002 Review existing spine agent ingestion/status routes, migrations, and tests in `spine/src/routes/agent.ts`, `spine/migrations/002_file_index.sql`, `spine/migrations/007_agent_status.sql`, and `spine/tests/routes/agent.test.ts`

## Phase 2: Foundational

- [x] T003 [P] Add or confirm Rust unit coverage for time formatting, glob matching, config defaults, and cache schema behavior in `agent/src/time.rs`, `agent/src/scan.rs`, `agent/src/config.rs`, and `agent/src/cache.rs`
- [x] T004 [P] Add or confirm spine route coverage for index idempotency, hash updates, validation errors, bearer-token rejection, and status upsert behavior in `spine/tests/routes/agent.test.ts`
- [x] T005 Confirm migrations and route contracts match `specs/008-agent-indexer/contracts/agent-indexer.md` in `spine/migrations/002_file_index.sql`, `spine/migrations/007_agent_status.sql`, and `spine/src/routes/agent.ts`

## Phase 3: User Story 1 - Index Local Watch Directories (P1)

**Goal**: Configured watch directories are scanned and changed supported files are posted to spine for retrieval.

**Independent Test**: Configure a temporary watch directory with supported files, run one scan cycle, and verify changed files are sent with path, MIME type, text, hash, size, and modified timestamp.

- [x] T006 [P] [US1] Add or confirm text and PDF extraction behavior and unsupported MIME skips in `agent/src/extract.rs`
- [x] T007 [P] [US1] Add or confirm watch directory traversal, glob filtering, hidden directory skip, symlink non-following, and missing-directory diagnostics in `agent/src/scan.rs`
- [x] T008 [US1] Confirm changed file payload formation and bearer-auth POST behavior in `agent/src/scan.rs`
- [x] T009 [US1] Confirm spine `/api/agent/index` persists file rows, writes local-file markdown, refreshes search, and validates required fields in `spine/src/routes/agent.ts` and `spine/tests/routes/agent.test.ts`

## Phase 4: User Story 2 - Avoid Duplicate And Unchanged Posts (P2)

**Goal**: Unchanged files are skipped locally and duplicate posts are idempotent on the spine.

**Independent Test**: Run two scans over unchanged files and verify only the first scan posts; modify one file and verify only the changed file posts again.

- [x] T010 [P] [US2] Add or confirm local cache upsert/get/known-path behavior in `agent/src/cache.rs`
- [x] T011 [US2] Confirm metadata fast-path skip and same-hash skip behavior in `agent/src/scan.rs`
- [x] T012 [US2] Confirm `--force` and force-reindex command clear known watch paths without deleting source files in `agent/src/main.rs` and `agent/src/cache.rs`
- [x] T013 [US2] Confirm repeated `/api/agent/index` posts are no-ops for the same hash and update in place for a new hash in `spine/src/routes/agent.ts` and `spine/tests/routes/agent.test.ts`

## Phase 5: User Story 3 - Operate As A Local Background Agent (P3)

**Goal**: The agent validates configuration, reports status, retries safely on spine failures, and can run under the user service definition.

**Independent Test**: Start with valid and invalid configuration, verify clear diagnostics and status payloads, and review service restart/logging behavior.

- [x] T014 [P] [US3] Confirm configuration loading, `~` expansion, default machine id, poll interval, and max file size behavior in `agent/src/config.rs`
- [x] T015 [P] [US3] Confirm status state transitions and heartbeat/status POST behavior in `agent/src/status.rs`, `agent/src/main.rs`, and `agent/src/scan.rs`
- [x] T016 [US3] Confirm spine `/api/agent/status` upserts latest health and `/api/status` exposes summarized agent diagnostics in `spine/src/routes/agent.ts`, `spine/src/routes/status.ts`, and `spine/tests/routes/agent.test.ts`
- [x] T017 [US3] Review `agent/lattice-agent.service` for user-level startup, restart behavior, and plain text journal diagnostics

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T018 [P] Document setup, diagnostics, and supported extraction limits in `README.md`
- [x] T019 [P] Document WCAG 2.2 AA diagnostic/docs evidence and bilingual N/A rationale in `docs/accessibility/agent-indexer.md`
- [x] T020 Run `cd agent && cargo test`
- [x] T021 Run `cd spine && bun test tests/routes/agent.test.ts`
- [x] T022 Mark completed tasks in `specs/008-agent-indexer/tasks.md` after verification and queue metadata updates

## Dependencies

- Phase 1 must complete before Phase 2.
- Phase 2 must complete before user-story verification or implementation changes.
- US1 is the MVP and should complete before US2 and US3 because cache/status behavior depends on core scan/index flow.
- US2 and US3 can proceed after US1 is validated.
- Polish tasks run after all selected user stories are implemented or confirmed.

## Parallel Examples

- Foundational: T003 and T004 can run in parallel because Rust and spine tests touch different files.
- US1: T006 and T007 can be reviewed independently before T008/T009 integration confirmation.
- US3: T014 and T015 can proceed in parallel with service file review T017.
- Polish: T018 and T019 can be drafted while command verification runs.

## Implementation Strategy

1. Confirm the existing agent/spine implementation against the newly written contracts before changing behavior.
2. Fill only real gaps discovered by tests or contract mismatches; avoid redesigning the already-present poll/cache/post pipeline.
3. Validate MVP indexing first, then dedupe/idempotency, then status/service operation.
4. Update docs/accessibility evidence and run targeted Rust and spine tests.
5. Mark task and queue metadata only after verification succeeds.
