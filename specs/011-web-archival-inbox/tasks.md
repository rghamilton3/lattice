# Tasks: Web Archival And Inbox Evolution

**Input**: Design documents from `/specs/011-web-archival-inbox/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/web-archival-inbox.md`, `quickstart.md`

**Tests**: Included because the implementation plan defines targeted spine, surface, route, search, notification, and keyboard coverage.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently after shared foundation work.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files and has no dependency on another incomplete task.
- **[Story]**: User story label for story phases only.
- Every task includes an exact file path.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare repository structure and configuration needed by the archive feature.

- [ ] T001 Create archive accessibility documentation stub in `docs/accessibility/web-archival-inbox.md`
- [ ] T002 Add archive storage and monolith environment notes to `README.md`
- [ ] T003 Add optional archive storage and monolith service configuration notes to `docker-compose.yml`
- [ ] T004 [P] Create archive module placeholder in `spine/src/archives.ts`
- [ ] T005 [P] Create archive job module placeholder in `spine/src/archiveJobs.ts`
- [ ] T006 [P] Create archive quality module placeholder in `spine/src/archiveQuality.ts`
- [ ] T007 [P] Create archive event module placeholder in `spine/src/archiveEvents.ts`
- [ ] T008 [P] Create surface archive API placeholder in `surface/src/lib/api/archives.ts`
- [ ] T009 [P] Create shared inbox component directory and placeholder in `surface/src/components/inbox/ActionRow.svelte`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core archive persistence, shared types, route registration, and search plumbing required before user story work.

**Critical**: No user story work can begin until this phase is complete.

- [ ] T010 Add additive archive schema migration with archive rows, quality fields, supersession fields, review fields, and indexes in `spine/migrations/010_archives.sql`
- [ ] T011 Implement archive row types, validation helpers, and URL normalization in `spine/src/archives.ts`
- [ ] T012 Implement content-addressed archive storage path resolution and path confinement in `spine/src/archives.ts`
- [ ] T013 Implement archive HTML text extraction helper for stored artifacts in `spine/src/archives.ts`
- [ ] T014 Implement archive markdown source file generation for QMD indexing in `spine/src/archives.ts`
- [ ] T015 Extend QMD setup and search result mapping for `kind: "archive"` in `spine/src/search.ts`
- [ ] T016 Extend browser search route filtering to default to good, non-superseded archives in `spine/src/routes/search.ts`
- [ ] T017 Add archive route registration for browser-authenticated archive routes in `spine/src/app.ts`
- [ ] T018 Extend signal message types with archive attention payloads in `spine/src/signal/messages.ts`
- [ ] T019 Add shared archive and inbox item TypeScript types in `surface/src/lib/types.ts`
- [ ] T020 Add archive API client functions for metadata, raw links, and actions in `surface/src/lib/api/archives.ts`
- [ ] T021 [P] Add archive storage and search unit test scaffolding in `spine/tests/unit/archives.test.ts`
- [ ] T022 [P] Add archive route integration test scaffolding in `spine/tests/integration/archive-routes.test.ts`

**Checkpoint**: Foundation ready. Archive rows, file storage, search mapping, and shared types are available for story implementation.

---

## Phase 3: User Story 1 - Save Durable Web Pages (Priority: P1) MVP

**Goal**: Save URL-only and rendered browser pages as durable web archive artifacts with searchable text and retrievable metadata.

**Independent Test**: Submit one URL-only archive request and one rendered SingleFile multipart upload, then verify each creates a stored artifact, metadata, extracted text, and a default-searchable good result when technically usable.

### Tests for User Story 1

- [ ] T023 [P] [US1] Add unit tests for storing archive bytes, hashing, metadata validation, and QMD source generation in `spine/tests/unit/archives.test.ts`
- [ ] T024 [P] [US1] Add integration tests for `POST /api/agent/archive-page` good SingleFile upload in `spine/tests/integration/archive-routes.test.ts`
- [ ] T025 [P] [US1] Add integration tests for `POST /api/agent/archive-url` job acceptance in `spine/tests/integration/archive-routes.test.ts`
- [ ] T026 [P] [US1] Add search tests for good non-superseded archive results in `spine/tests/unit/archives.test.ts`

### Implementation for User Story 1

- [ ] T027 [US1] Implement archive creation service for good stored artifacts in `spine/src/archives.ts`
- [ ] T028 [US1] Implement multipart SingleFile `POST /api/agent/archive-page` handling in `spine/src/routes/agent.ts`
- [ ] T029 [US1] Implement in-process URL job model and queue acceptance in `spine/src/archiveJobs.ts`
- [ ] T030 [US1] Implement URL-only `POST /api/agent/archive-url` route and 202 job response in `spine/src/routes/agent.ts`
- [ ] T031 [US1] Implement local `monolith` invocation with bounded timeout in `spine/src/archiveJobs.ts`
- [ ] T032 [US1] Persist successful monolith output as archive artifacts through `spine/src/archives.ts`
- [ ] T033 [US1] Connect archive storage completion to QMD refresh behavior in `spine/src/search.ts`
- [ ] T034 [US1] Add browser metadata and raw artifact routes in `spine/src/routes/archives.ts`
- [ ] T035 [US1] Render archive search results and raw archive links in `surface/src/components/search/ResultRow.svelte`
- [ ] T036 [US1] Document URL-only and SingleFile save flows in `README.md`

**Checkpoint**: User Story 1 is functional and testable as the MVP.

---

## Phase 4: User Story 2 - Recover Failed Or Degraded Archives (Priority: P2)

**Goal**: Route degraded or failed URL-only captures into the existing inbox with Re-capture, Delete, and Skip actions, and allow good rendered captures to supersede degraded history.

**Independent Test**: Force a degraded URL-only archive, confirm it appears as an inbox recapture item, use Re-capture/Delete/Skip actions, then save a good rendered replacement and verify the old row is retained but hidden from current default search.

### Tests for User Story 2

- [ ] T037 [P] [US2] Add quality classifier tests for short text, browser-rendering-required phrases, empty app shells, and failed monolith output in `spine/tests/unit/archiveQuality.test.ts`
- [ ] T038 [P] [US2] Add supersession and deleted-review tests in `spine/tests/unit/archives.test.ts`
- [ ] T039 [P] [US2] Add route tests for degraded archive inbox items and archive actions in `spine/tests/integration/archive-routes.test.ts`
- [ ] T040 [P] [US2] Add surface unit tests for recapture action rows in `surface/src/components/inbox/ActionRow.test.ts`

### Implementation for User Story 2

- [ ] T041 [US2] Implement technical quality classification heuristics in `spine/src/archiveQuality.ts`
- [ ] T042 [US2] Apply quality classification to URL-only worker results in `spine/src/archiveJobs.ts`
- [ ] T043 [US2] Implement archive supersession when a good SingleFile capture replaces degraded or failed current rows in `spine/src/archives.ts`
- [ ] T044 [US2] Extend existing inbox query to include `archive_recapture` item type in `spine/src/routes/captures.ts`
- [ ] T045 [US2] Implement `POST /api/archives/:id/action` for `recapture`, `delete`, and `skip` in `spine/src/routes/archives.ts`
- [ ] T046 [US2] Update default search exclusion for degraded, failed, deleted, and superseded archives in `spine/src/routes/search.ts`
- [ ] T047 [US2] Replace capture-specific inline action buttons with shared action descriptors for recapture items in `surface/src/components/home/InboxList.svelte`
- [ ] T048 [US2] Implement shared ActionRow rendering, keyboard shortcuts, and focus guards for recapture actions in `surface/src/components/inbox/ActionRow.svelte`
- [ ] T049 [US2] Wire Re-capture to open the archive source URL while leaving the inbox item pending in `surface/src/components/home/InboxList.svelte`

**Checkpoint**: User Story 2 is functional and independently testable without a separate archive queue.

---

## Phase 5: User Story 3 - Review Recent Successful Captures Calmly (Priority: P3)

**Goal**: Show recently successful archives in the existing inbox for bounded optional review, with calm actions and automatic keep behavior.

**Independent Test**: Save a good archive, confirm it appears as a recent review item with Keep, Archive, Re-capture, and Skip, confirm no Standard-posture ping is sent, and confirm it auto-keeps after the settling period.

### Tests for User Story 3

- [ ] T050 [P] [US3] Add tests for recent review eligibility and auto-kept settling behavior in `spine/tests/unit/archives.test.ts`
- [ ] T051 [P] [US3] Add route tests for recent archive inbox items and keep/archive/recapture/skip actions in `spine/tests/integration/archive-routes.test.ts`
- [ ] T052 [P] [US3] Add surface unit tests for recent archive ActionRow labels and shortcuts in `surface/src/components/inbox/ActionRow.test.ts`
- [ ] T053 [P] [US3] Add Playwright coverage for recent capture review and keyboard operation in `surface/e2e/surface.e2e.ts`

### Implementation for User Story 3

- [ ] T054 [US3] Add recent-review window and auto-kept resolution logic in `spine/src/archives.ts`
- [ ] T055 [US3] Extend inbox query to include `archive_recent` items with calm labels and no debt copy in `spine/src/routes/captures.ts`
- [ ] T056 [US3] Implement archive actions `keep`, `archive`, `recapture`, `skip`, and internal `auto-kept` in `spine/src/routes/archives.ts`
- [ ] T057 [US3] Render recent archive review rows through the shared ActionRow in `surface/src/components/home/InboxList.svelte`
- [ ] T058 [US3] Add recent archive action variants and keyboard shortcuts in `surface/src/components/inbox/ActionRow.svelte`
- [ ] T059 [US3] Remove or avoid inbox copy and counts that imply archive review debt in `surface/src/components/home/InboxList.svelte`

**Checkpoint**: User Story 3 is functional and optional review remains calm and bounded.

---

## Phase 6: User Story 4 - Route Attention Without Moving State Out Of Surface (Priority: P4)

**Goal**: Use Signal only for attention according to Quiet, Standard, and Active posture while keeping pending state in spine/surface.

**Independent Test**: Switch posture values, create recapture and recent archive items, and verify Signal decisions differ by posture while inbox state remains authoritative when relay sends fail or are suppressed.

### Tests for User Story 4

- [ ] T060 [P] [US4] Add notification decision tests for Quiet, Standard, and Active posture in `spine/tests/unit/archiveNotifications.test.ts`
- [ ] T061 [P] [US4] Add route or integration tests proving relay failure does not rollback archive or inbox state in `spine/tests/integration/archive-routes.test.ts`
- [ ] T062 [P] [US4] Add surface tests for posture controls and prominence behavior in `surface/src/components/overlays/Settings.test.ts`

### Implementation for User Story 4

- [ ] T063 [US4] Implement archive attention decision helpers in `spine/src/archiveEvents.ts`
- [ ] T064 [US4] Connect recapture and recent-review events to Signal relay decisions in `spine/src/archiveEvents.ts`
- [ ] T065 [US4] Persist and read notification posture values in `spine/src/archiveEvents.ts`
- [ ] T066 [US4] Add browser API support for reading and updating notification posture in `spine/src/routes/settings.ts`
- [ ] T067 [US4] Add notification posture controls and explanatory copy in `surface/src/components/overlays/Settings.svelte`
- [ ] T068 [US4] Adjust surface inbox prominence for Quiet, Standard, and Active posture in `surface/src/components/home/InboxList.svelte`
- [ ] T069 [US4] Ensure Signal messages include title or URL, item type, quality, and action context in `spine/src/signal/messages.ts`

**Checkpoint**: User Story 4 is functional and notifications remain attention-only.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, accessibility, validation, and cleanup across all stories.

- [ ] T070 [P] Document keyboard coverage, focus handling, recapture behavior, and posture controls in `docs/accessibility/web-archival-inbox.md`
- [ ] T071 [P] Add quickstart curl examples and SingleFile configuration notes to `README.md`
- [ ] T072 [P] Add production archive storage and monolith deployment notes to `docker-compose.yml`
- [ ] T073 Audit archive route auth, path confinement, invalid URL handling, and HTTP fail-closed behavior in `spine/src/routes/agent.ts`
- [ ] T074 Audit archive raw file serving path confinement and deleted-artifact behavior in `spine/src/routes/archives.ts`
- [ ] T075 Run spine tests with `cd spine && bun test`
- [ ] T076 Run surface checks with `cd surface && bun run check`
- [ ] T077 Run surface unit tests with `cd surface && bun run test:unit`
- [ ] T078 Run targeted surface e2e tests with `cd surface && bun run test:e2e`
- [ ] T079 Run repository validation with `just check`, `just lint`, and `just test`
- [ ] T080 Validate manual acceptance checks from `specs/011-web-archival-inbox/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion and blocks all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational; MVP scope.
- **User Story 2 (Phase 4)**: Depends on Foundational and integrates best after User Story 1 archive creation exists.
- **User Story 3 (Phase 5)**: Depends on Foundational and benefits from User Story 1 good archive creation.
- **User Story 4 (Phase 6)**: Depends on Foundational and should integrate after User Story 2 and User Story 3 event sources exist.
- **Polish (Phase 7)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **US1 Save Durable Web Pages**: No dependency on other stories after foundation; suggested MVP.
- **US2 Recover Failed Or Degraded Archives**: Requires archive rows and benefits from US1 SingleFile replacement flow.
- **US3 Review Recent Successful Captures Calmly**: Requires good archive rows and archive actions; can be built after or alongside US2 once foundation exists.
- **US4 Route Attention Without Moving State Out Of Surface**: Requires recapture and recent-review event sources from US2 and US3.

### Within Each User Story

- Tests should be added before implementation tasks in that story.
- Data/model/service changes should precede route changes.
- Route changes should precede surface integration.
- Surface components should be wired after API clients and types exist.
- Story checkpoint validation should happen before moving to the next priority when working sequentially.

---

## Parallel Opportunities

- Setup placeholders T004 through T009 can run in parallel.
- Foundational tests T021 and T022 can run in parallel with documentation/setup work after T010 is drafted.
- US1 tests T023 through T026 can run in parallel before implementation.
- US2 tests T037 through T040 can run in parallel before implementation.
- US3 tests T050 through T053 can run in parallel before implementation.
- US4 tests T060 through T062 can run in parallel before implementation.
- Documentation tasks T070 through T072 can run in parallel with final audits after story behavior stabilizes.

---

## Parallel Example: User Story 1

```bash
Task: "T023 [P] [US1] Add unit tests for storing archive bytes, hashing, metadata validation, and QMD source generation in spine/tests/unit/archives.test.ts"
Task: "T024 [P] [US1] Add integration tests for POST /api/agent/archive-page good SingleFile upload in spine/tests/integration/archive-routes.test.ts"
Task: "T025 [P] [US1] Add integration tests for POST /api/agent/archive-url job acceptance in spine/tests/integration/archive-routes.test.ts"
Task: "T026 [P] [US1] Add search tests for good non-superseded archive results in spine/tests/unit/archives.test.ts"
```

## Parallel Example: User Story 2

```bash
Task: "T037 [P] [US2] Add quality classifier tests for short text, browser-rendering-required phrases, empty app shells, and failed monolith output in spine/tests/unit/archiveQuality.test.ts"
Task: "T038 [P] [US2] Add supersession and deleted-review tests in spine/tests/unit/archives.test.ts"
Task: "T039 [P] [US2] Add route tests for degraded archive inbox items and archive actions in spine/tests/integration/archive-routes.test.ts"
Task: "T040 [P] [US2] Add surface unit tests for recapture action rows in surface/src/components/inbox/ActionRow.test.ts"
```

## Parallel Example: User Story 3

```bash
Task: "T050 [P] [US3] Add tests for recent review eligibility and auto-kept settling behavior in spine/tests/unit/archives.test.ts"
Task: "T051 [P] [US3] Add route tests for recent archive inbox items and keep/archive/recapture/skip actions in spine/tests/integration/archive-routes.test.ts"
Task: "T052 [P] [US3] Add surface unit tests for recent archive ActionRow labels and shortcuts in surface/src/components/inbox/ActionRow.test.ts"
Task: "T053 [P] [US3] Add Playwright coverage for recent capture review and keyboard operation in surface/e2e/surface.e2e.ts"
```

## Parallel Example: User Story 4

```bash
Task: "T060 [P] [US4] Add notification decision tests for Quiet, Standard, and Active posture in spine/tests/unit/archiveNotifications.test.ts"
Task: "T061 [P] [US4] Add route or integration tests proving relay failure does not rollback archive or inbox state in spine/tests/integration/archive-routes.test.ts"
Task: "T062 [P] [US4] Add surface tests for posture controls and prominence behavior in surface/src/components/overlays/Settings.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 setup.
2. Complete Phase 2 foundation.
3. Complete Phase 3 User Story 1.
4. Stop and validate URL-only save, SingleFile save, durable artifact retrieval, extracted text indexing, and default good search.

### Incremental Delivery

1. Deliver US1 as durable archival MVP.
2. Add US2 so degraded captures become recoverable through the existing inbox.
3. Add US3 so successful captures get calm optional review.
4. Add US4 so attention relay behavior follows notification posture without moving state out of surface.
5. Finish polish, accessibility notes, quickstart validation, and full checks.

### Validation Targets

- Spine: `cd spine && bun test`
- Surface checks: `cd surface && bun run check`
- Surface unit tests: `cd surface && bun run test:unit`
- Surface e2e: `cd surface && bun run test:e2e`
- Repository: `just check`, `just lint`, `just test`

---

## Notes

- Keep archive persistence in `spine/`; Surface must call relative `/api/*` only.
- Keep the URL-only queue in-process for v1; do not add Redis, BullMQ, an ORM, or a headless browser.
- Keep degraded quality strictly technical; do not encode editorial judgment.
- Keep Signal as best-effort attention only; inbox state remains authoritative in spine/surface.
- Preserve Skip in every action row and avoid overdue, streak, or debt language.
