# Tasks: Tracking Phase 0

**Input**: Design documents from `specs/011-tracking-phase0/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: Included because the feature specification defines independent tests and measurable smoke-test outcomes for each user story.

**Organization**: Tasks are grouped by user story to keep each increment independently implementable and testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files and does not depend on incomplete tasks.
- **[Story]**: User story label for traceability.
- Every task includes an exact target file path.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish schema and shared route scaffolding needed by all tracking stories.

- [X] T001 Create tracking schema migration with `tracks` and `track_queries` tables plus indexes in `spine/migrations/011_tracks.sql`
- [X] T002 [P] Add shared tracking row/request/response TypeScript interfaces in `spine/src/db/rows.ts`
- [X] T003 [P] Create placeholder authenticated browser tracking route module in `spine/src/routes/tracks.ts`
- [X] T004 Register `tracksRoutes(db)` inside the existing Authentik guard in `spine/src/app.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add tests and lightweight test support that block all user-story work.

**Critical**: No user story implementation should begin until this phase is complete.

- [X] T005 Add migration/schema tests for `tracks`, `track_queries`, indexes, and foreign keys in `spine/src/tracks.schema.test.ts`
- [X] T006 [P] Add test database setup helpers for route tests in `spine/src/testSupport/db.ts`
- [X] T007 [P] Add app request/auth helper utilities for bearer-token and Authentik-style test requests in `spine/src/testSupport/http.ts`
- [X] T008 Cover track request normalization and validation through route tests in `spine/src/routes/agent.track.test.ts`
- [X] T009 Run `bun test spine/src/tracks.schema.test.ts` and fix schema/setup failures in `spine/migrations/011_tracks.sql`

**Checkpoint**: Database schema and test harness are ready; user stories can now be implemented.

---

## Phase 3: User Story 1 - Record a Track from Any Phase 0 Path (Priority: P1) MVP

**Goal**: Authorized Phase 0 clients can create append-only normal and checkout/displaced tracking records with consistent core metadata.

**Independent Test**: Submit normal and displaced records to `/api/agent/track`, then confirm each row stores text, capture time, source, ingested time, displaced state, and optional photo/supersession metadata without category/tag fields.

### Tests for User Story 1

- [X] T010 [P] [US1] Add route tests for successful normal and displaced `POST /api/agent/track` writes in `spine/src/routes/agent.track.test.ts`
- [X] T011 [P] [US1] Add route tests for blank text, missing source, invalid displaced values, invalid supersession, and missing bearer token in `spine/src/routes/agent.track.test.ts`
- [X] T012 [P] [US1] Add append-only regression test proving duplicate/stale/friction text creates additional rows without editing prior rows in `spine/src/routes/agent.track.test.ts`

### Implementation for User Story 1

- [X] T013 [US1] Implement `POST /track` inside existing `agentRoutes` body schema in `spine/src/routes/agent.ts`
- [X] T014 [US1] Insert tracking rows with spine-set `ingested_at`, explicit boolean-to-integer `displaced`, nullable `photo_ref`, and nullable `supersedes` in `spine/src/routes/agent.ts`
- [X] T015 [US1] Validate optional `supersedes` references an existing `tracks.id` before insert in `spine/src/routes/agent.ts`
- [X] T016 [US1] Run `bun test spine/src/routes/agent.track.test.ts` and fix write-path failures in `spine/src/routes/agent.ts`

**Checkpoint**: User Story 1 is independently functional and testable as the MVP.

---

## Phase 4: User Story 2 - Find a Recently Tracked Item (Priority: P2)

**Goal**: Authenticated browser users can search tracking records, see newest useful matches with history, and mark a result opened for future loop-closure behavior.

**Independent Test**: Record a known phrase, search for an item word, confirm matching records include text/time/source/displaced/id in newest-first order, then mark one result opened.

### Tests for User Story 2

- [X] T017 [P] [US2] Add route tests for `GET /api/tracks/search?q=drill` result shape and newest-first ordering in `spine/src/routes/tracks.test.ts`
- [X] T018 [P] [US2] Add route tests for blank query rejection, missing Authentik auth rejection, and empty/no-match response behavior in `spine/src/routes/tracks.test.ts`
- [X] T019 [P] [US2] Add route tests for `POST /api/tracks/queries/:id/open` success, unknown query, unknown track, and invalid `track_id` in `spine/src/routes/tracks.test.ts`

### Implementation for User Story 2

- [X] T020 [US2] Implement keyword track search with query logging in `spine/src/routes/tracks.ts`
- [X] T021 [US2] Return `query_id` plus result fields `id`, `text`, `captured_at`, `ingested_at`, `source`, `displaced`, `photo_ref`, and `supersedes` from `spine/src/routes/tracks.ts`
- [X] T022 [US2] Implement result-open logging endpoint `POST /api/tracks/queries/:id/open` in `spine/src/routes/tracks.ts`
- [X] T023 [US2] Run `bun test spine/src/routes/tracks.test.ts` and fix search/open failures in `spine/src/routes/tracks.ts`

**Checkpoint**: User Story 2 is independently functional and proves write-to-search round trip.

---

## Phase 5: User Story 3 - Verify In-Home Voice Capture (Priority: P3)

**Goal**: The printing-room HA Voice path can submit normal and checkout phrases to the common tracking endpoint and verify searchable records quickly.

**Independent Test**: From the printing room, speak one normal track phrase and one checkout phrase, then confirm both appear as searchable records within 5 seconds with `ha-voice:printing-room` provenance.

### Tests for User Story 3

- [X] T024 [P] [US3] Add HA payload smoke-test examples for normal and checkout requests in `spine/src/routes/agent.track.test.ts`

### Implementation for User Story 3

- [X] T025 [US3] Document HA Voice sentence triggers, payload fields, fallback phrases, and 5-second verification in `specs/011-tracking-phase0/quickstart.md`
- [X] T026 [US3] Add a HA Voice manual verification checklist with pass/fail rows in `specs/011-tracking-phase0/ha-voice-verification.md`
- [X] T027 [US3] Execute the HA Voice verification checklist and record results or blockers in `specs/011-tracking-phase0/ha-voice-verification.md`

**Checkpoint**: User Story 3 is independently verifiable through documented device setup plus the shared tracking/search substrate.

---

## Phase 6: User Story 4 - Verify Portable and Fallback Capture (Priority: P4)

**Goal**: Tasker phone voice and Signal commands create searchable normal and displaced records with distinguishable source provenance.

**Independent Test**: Create one normal and one displaced track from phone voice and Signal text, then confirm all records are searchable within 10 seconds and source values distinguish `tasker-voice`, `signal-text`, and optional `signal-photo`.

### Tests for User Story 4

- [X] T028 [P] [US4] Add Signal parser tests for `/track`, `/checkout`, blank command content, and existing `/capture` preservation in `spine/src/signal/messages.test.ts`
- [X] T029 [P] [US4] Add Signal relay posting tests for track versus capture endpoint selection and displaced state payloads in `spine/src/signal-relay.test.ts`

### Implementation for User Story 4

- [X] T030 [US4] Extend parsed Signal message types to distinguish capture, track, checkout, and optional photo tracking payloads in `spine/src/signal/messages.ts`
- [X] T031 [US4] Route Signal `/track` and `/checkout` messages to `/api/agent/track` while preserving existing capture routing in `spine/src/signal-relay.ts`
- [X] T032 [US4] Preserve Signal photo caption text and optional stored photo reference for tracking payloads in `spine/src/signal-relay.ts`
- [X] T033 [US4] Document Tasker phrase setup, Signal command setup, assistant-interception failure criteria, and 10-second verification in `specs/011-tracking-phase0/quickstart.md`
- [X] T034 [US4] Add portable and Signal manual verification checklist with pass/fail rows in `specs/011-tracking-phase0/portable-signal-verification.md`
- [X] T035 [US4] Run `bun test spine/src/signal/messages.test.ts spine/src/signal-relay.test.ts` and fix routing regressions in `spine/src/signal/messages.ts` and `spine/src/signal-relay.ts`

**Checkpoint**: User Story 4 is independently verifiable for phone voice, Signal text, and optional Signal photo.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Validate the whole Phase 0 substrate, preserve governance requirements, and prepare for implementation handoff.

- [X] T036 [P] Add quickstart curl verification transcript placeholders for normal track, checkout track, search, and result-open flows in `specs/011-tracking-phase0/quickstart.md`
- [X] T037 [P] Add accessibility evidence or N/A rationale for API/device-only Phase 0 work in `specs/011-tracking-phase0/accessibility.md`
- [X] T038 [P] Add bilingual delivery N/A rationale and any English-only user-facing copy review notes in `specs/011-tracking-phase0/accessibility.md`
- [X] T039 [P] Add CLI/terminal output accessibility review for curl/manual setup errors in `specs/011-tracking-phase0/accessibility.md`
- [X] T040 Run `just test` from repository root and fix failures in `spine/src/`
- [X] T041 Run `just check` from repository root and fix TypeScript/Svelte check failures in `spine/src/` or `surface/src/`
- [X] T042 Run the complete quickstart smoke test and record final results in `specs/011-tracking-phase0/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup (Phase 1) has no dependencies.
- Foundational (Phase 2) depends on Setup and blocks every user story.
- User Story 1 (Phase 3) depends on Foundational and is the MVP.
- User Story 2 (Phase 4) depends on Foundational and needs at least seeded/created track rows for full validation.
- User Story 3 (Phase 5) depends on User Story 1 and User Story 2 because device verification needs both write and search paths.
- User Story 4 (Phase 6) depends on User Story 1 and User Story 2 because portable/Signal verification needs both write and search paths.
- Polish (Phase 7) depends on all desired user stories being complete.

### User Story Dependencies

- US1: No dependency on other user stories after foundation; delivers the writable tracking substrate.
- US2: Can be built after foundation using seeded database rows, but complete acceptance requires US1-created records.
- US3: Requires US1 and US2 so HA Voice can create and retrieve records.
- US4: Requires US1 and US2 so Tasker/Signal can create and retrieve records.

### Parallel Opportunities

- T002 and T003 can run in parallel after T001 is understood.
- T006 and T007 can run in parallel with T005.
- T010, T011, and T012 can be authored in parallel before US1 implementation.
- T017, T018, and T019 can be authored in parallel before US2 implementation.
- T024 can run in parallel with US3 documentation tasks once US1 request shape is stable.
- T028 and T029 can be authored in parallel before Signal routing changes.
- T036, T037, T038, and T039 can run in parallel during polish.

---

## Parallel Example: User Story 1

```bash
Task: "Add route tests for successful normal and displaced POST /api/agent/track writes in spine/src/routes/agent.track.test.ts"
Task: "Add route tests for blank text, missing source, invalid displaced values, invalid supersession, and missing bearer token in spine/src/routes/agent.track.test.ts"
Task: "Add append-only regression test proving duplicate/stale/friction text creates additional rows without editing prior rows in spine/src/routes/agent.track.test.ts"
```

## Parallel Example: User Story 2

```bash
Task: "Add route tests for GET /api/tracks/search?q=drill result shape and newest-first ordering in spine/src/routes/tracks.test.ts"
Task: "Add route tests for blank query rejection, missing Authentik auth rejection, and empty/no-match response behavior in spine/src/routes/tracks.test.ts"
Task: "Add route tests for POST /api/tracks/queries/:id/open success, unknown query, unknown track, and invalid track_id in spine/src/routes/tracks.test.ts"
```

## Parallel Example: User Story 4

```bash
Task: "Add Signal parser tests for /track, /checkout, blank command content, and existing /capture preservation in spine/src/signal/messages.test.ts"
Task: "Add Signal relay posting tests for track versus capture endpoint selection and displaced state payloads in spine/src/signal-relay.test.ts"
```

---

## Implementation Strategy

### MVP First

1. Complete Phase 1 and Phase 2.
2. Complete Phase 3 for US1.
3. Stop and validate that `/api/agent/track` can create normal and displaced records with correct metadata.
4. Continue only after the writable tracking substrate is stable.

### Incremental Delivery

1. Add US1 to create tracking records.
2. Add US2 to search records and log opened results.
3. Add US3 to verify the printing-room HA Voice path.
4. Add US4 to verify Tasker phone voice and Signal fallback paths.
5. Finish polish checks, accessibility/language governance, and quickstart evidence.

### Validation Commands

1. `bun test spine/src/tracks.schema.test.ts`
2. `bun test spine/src/routes/agent.track.test.ts`
3. `bun test spine/src/routes/tracks.test.ts`
4. `bun test spine/src/signal/messages.test.ts spine/src/signal-relay.test.ts`
5. `just test`
6. `just check`
