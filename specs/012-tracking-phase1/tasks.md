# Tasks: Tracking Phase 1

**Input**: Design documents from `specs/012-tracking-phase1/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: Include targeted spine route/unit tests because the spec defines independent test scenarios and measurable loop-closure outcomes.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with other marked tasks in the same phase after prerequisites are complete
- **[Story]**: Which user story this task belongs to (`US1`, `US2`, `US3`, `US4`)
- Every task includes an exact repository path

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the Phase 0 substrate and current tests before changing workflow behavior.

- [x] T001 Run baseline spine tracking tests with `bun test src/routes/tracks.test.ts src/routes/agent.track.test.ts src/tracks.schema.test.ts` from `spine/` for `spine/src/routes/tracks.test.ts`, `spine/src/routes/agent.track.test.ts`, and `spine/src/tracks.schema.test.ts`
- [x] T002 [P] Inspect `spine/migrations/011_tracks.sql` and confirm existing `tracks` and `track_queries` columns cover Phase 1 without a required migration
- [x] T003 [P] Inspect `spine/src/testSupport/db.ts` and `spine/src/testSupport/http.ts` for helpers needed by new route tests

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared matching, response types, and time constants required by all Phase 1 stories.

**CRITICAL**: No user story work can begin until this phase is complete.

- [x] T004 Add shared tracking workflow constants for 12-hour eligibility, 14-day follow-up window, and 90-day duplicate horizon in `spine/src/routes/tracks.ts`
- [x] T005 Add lightweight query tokenization and stop-word filtering helpers in `spine/src/routes/tracks.ts`
- [x] T006 Add reusable track row mapping and match-scoring helpers for retrieval, duplicate hints, and follow-up suppression in `spine/src/routes/tracks.ts`
- [x] T007 Update tracking response and follow-up TypeScript interfaces in `spine/src/db/rows.ts`
- [x] T008 [P] Add focused unit coverage for tokenization and match scoring in `spine/src/routes/tracks.test.ts`

**Checkpoint**: Shared matching and types are ready for story implementation.

---

## Phase 3: User Story 1 - Complete a Track and Retrieval Cycle (Priority: P1) MVP

**Goal**: A user can create a free-form track and retrieve it with ordinary wording, seeing a primary newest answer plus older history.

**Independent Test**: Record `drill is on the garage top shelf, blue case`, search for `where is the drill`, and verify the response logs a query, returns the newest useful primary result, and keeps older drill records as history.

### Tests for User Story 1

- [x] T009 [P] [US1] Update search response tests for `primary`, `history`, and `empty_message` in `spine/src/routes/tracks.test.ts`
- [x] T010 [P] [US1] Add ordinary-wording search ranking tests for multi-token queries in `spine/src/routes/tracks.test.ts`
- [x] T011 [P] [US1] Add blank-query and no-useful-match behavior tests in `spine/src/routes/tracks.test.ts`

### Implementation for User Story 1

- [x] T012 [US1] Replace raw substring search with token-ranked retrieval in `spine/src/routes/tracks.ts`
- [x] T013 [US1] Return `query_id`, `primary`, `history`, and `empty_message` from `GET /api/tracks/search` in `spine/src/routes/tracks.ts`
- [x] T014 [US1] Preserve query logging for every valid search in `spine/src/routes/tracks.ts`
- [x] T015 [US1] Ensure search results include text, time, source, displaced state, photo reference, and supersedes fields in `spine/src/routes/tracks.ts`
- [x] T016 [US1] Keep `/api/tracks/queries/:id/open` compatible with the new search response shape in `spine/src/routes/tracks.ts`
- [x] T017 [US1] Run `bun test src/routes/tracks.test.ts` from `spine/` and fix retrieval-cycle failures in `spine/src/routes/tracks.test.ts`

**Checkpoint**: User Story 1 is fully functional and independently testable.

---

## Phase 4: User Story 2 - Close the Loop After Retrieval (Priority: P2)

**Goal**: Opened retrieval results produce one dismissible follow-up after eligibility, with exactly three outcomes.

**Independent Test**: Search and open a result, age the query past eligibility, list pending follow-ups, then close separate follow-ups as still accurate, moved, and skipped.

### Tests for User Story 2

- [x] T018 [P] [US2] Add pending follow-up eligibility and affirmative-label tests in `spine/src/routes/tracks.test.ts`
- [x] T019 [P] [US2] Add tests that unopened queries, newer matching tracks, and expired queries do not appear as pending in `spine/src/routes/tracks.test.ts`
- [x] T020 [P] [US2] Add still-accurate, moved, skip, and invalid moved-text tests in `spine/src/routes/tracks.test.ts`

### Implementation for User Story 2

- [x] T021 [US2] Implement pending follow-up derivation for opened unclosed queries in `spine/src/routes/tracks.ts`
- [x] T022 [US2] Implement newer matching track suppression for follow-ups in `spine/src/routes/tracks.ts`
- [x] T023 [US2] Implement expiration processing that sets `loop_outcome = 'expired'` and `loop_closed_at` in `spine/src/routes/tracks.ts`
- [x] T024 [US2] Add `GET /api/tracks/followups` with opened track, query context, `expires_at`, and displaced-aware `affirmative_label` in `spine/src/routes/tracks.ts`
- [x] T025 [US2] Add `POST /api/tracks/followups/:query_id/still-accurate` in `spine/src/routes/tracks.ts`
- [x] T026 [US2] Add `POST /api/tracks/followups/:query_id/moved` that inserts an append-only track with `supersedes` set to the opened track in `spine/src/routes/tracks.ts`
- [x] T027 [US2] Add `POST /api/tracks/followups/:query_id/skip` in `spine/src/routes/tracks.ts`
- [x] T028 [US2] Ensure follow-up endpoints return clear 400/404/409 errors without counters, badges, debt text, or repeat scheduling in `spine/src/routes/tracks.ts`
- [x] T029 [US2] Run `bun test src/routes/tracks.test.ts` from `spine/` and fix loop-closure failures in `spine/src/routes/tracks.test.ts`

**Checkpoint**: User Stories 1 and 2 both work independently.

---

## Phase 5: User Story 3 - See Helpful Duplicate Hints Without Auto-Cleanup (Priority: P3)

**Goal**: Creating a strongly overlapping recent track returns advisory duplicate hints while always saving the new record and never mutating old records.

**Independent Test**: Save `drill on the garage top shelf`, then save `drill in blue case on garage shelf`, and verify the second response includes possible related records while both rows remain append-only.

### Tests for User Story 3

- [x] T030 [P] [US3] Add duplicate-hint response tests for strong recent overlap in `spine/src/routes/agent.track.test.ts`
- [x] T031 [P] [US3] Add tests proving duplicate hints do not block inserts or mutate prior rows in `spine/src/routes/agent.track.test.ts`
- [x] T032 [P] [US3] Add tests for weak/no overlap returning an empty `possible_duplicates` array in `spine/src/routes/agent.track.test.ts`

### Implementation for User Story 3

- [x] T033 [US3] Add duplicate candidate lookup using the 90-day horizon and shared match scoring in `spine/src/routes/agent.ts`
- [x] T034 [US3] Return `possible_duplicates` from `POST /api/agent/track` in `spine/src/routes/agent.ts`
- [x] T035 [US3] Ensure duplicate hint objects include `track_id`, `text`, `captured_at`, `source`, `displaced`, and plain-language `reason` in `spine/src/routes/agent.ts`
- [x] T036 [US3] Keep insertion independent from hint calculation so duplicate matching cannot prevent saves in `spine/src/routes/agent.ts`
- [x] T037 [US3] Run `bun test src/routes/agent.track.test.ts` from `spine/` and fix duplicate-hint failures in `spine/src/routes/agent.track.test.ts`

**Checkpoint**: User Stories 1, 2, and 3 are independently functional.

---

## Phase 6: User Story 4 - Use the Workflow Without Surface Polish (Priority: P4)

**Goal**: Phase 1 can be completed through the smallest user-facing surface without a polished tracking board.

**Independent Test**: Complete track, search, result-open, follow-up listing, and all three follow-up outcomes using the documented curl/browser flow or minimal web UI without editing stored data directly.

### Tests for User Story 4

- [x] T038 [P] [US4] Update quickstart smoke commands to match final response shapes and endpoint paths in `specs/012-tracking-phase1/quickstart.md`
- [x] T039 [P] [US4] Add CLI/message accessibility review notes for the chosen non-polished surface in `specs/012-tracking-phase1/quickstart.md`

### Implementation for User Story 4

- [x] T040 [US4] Decide and document whether Phase 1 uses curl/browser endpoints only or adds minimal Surface UI in `specs/012-tracking-phase1/quickstart.md`
- [x] T041 [US4] If adding persistent Surface UI, add tracking API wrapper functions in `surface/src/lib/api/tracks.ts` (N/A: no persistent Surface UI added)
- [x] T042 [US4] If adding persistent Surface UI, add tracking and follow-up types in `surface/src/lib/types.ts` (N/A: no persistent Surface UI added)
- [x] T043 [US4] If adding persistent Surface UI, add a minimal searchable tracking workflow component in `surface/src/components/tracking/TrackingView.svelte` (N/A: no persistent Surface UI added)
- [x] T044 [US4] If adding persistent Surface UI, expose the tracking workflow from `surface/src/routes/+page.svelte` or the existing shell component that owns primary navigation (N/A: no persistent Surface UI added)
- [x] T045 [US4] If adding persistent Surface UI, create WCAG 2.2 AA evidence for keyboard, focus, labels, and non-color-only state in `docs/accessibility/tracking-phase1.md` (N/A: no persistent Surface UI added)
- [x] T046 [US4] If not adding persistent Surface UI, document `docs/accessibility/` evidence as N/A and confirm plain-text action labels in `specs/012-tracking-phase1/quickstart.md`
- [x] T047 [US4] Run `cd surface && bun run check` if any `surface/src/` files changed and fix check failures in changed `surface/src/` files (N/A: no `surface/src/` files changed)

**Checkpoint**: The workflow is usable without a polished tracking board or implementation-document lookup.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: End-to-end validation, regression checks, and documentation cleanup across all stories.

- [x] T048 [P] Update API contract examples if implementation response details changed in `specs/012-tracking-phase1/contracts/tracking-workflow-api.md`
- [x] T049 [P] Update surface contract notes if the chosen user-facing surface changed in `specs/012-tracking-phase1/contracts/follow-up-surfaces.md`
- [x] T050 Run the full local smoke test from `specs/012-tracking-phase1/quickstart.md` (covered by route-level full-cycle smoke tests in the coding environment)
- [x] T051 Run `just test` from repository root using `Justfile`
- [x] T052 Run `just check` from repository root using `Justfile` (spine check passed; Surface check blocked by missing `svelte-kit` dependency in this worktree)
- [x] T053 Confirm no Phase 1 copy introduces backlog, streak, overdue, debt, or nagging language in `spine/src/routes/tracks.ts`, `spine/src/routes/agent.ts`, and any changed `surface/src/` files
- [x] T054 Confirm bilingual delivery remains N/A or document any newly introduced translation requirement in `specs/012-tracking-phase1/quickstart.md`
- [x] T055 Record done evidence for one full real-item cycle and three loop-closure outcomes in `specs/012-tracking-phase1/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion; blocks all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational; MVP scope.
- **User Story 2 (Phase 4)**: Depends on Foundational and benefits from US1 search/open behavior.
- **User Story 3 (Phase 5)**: Depends on Foundational; can be implemented after shared match scoring exists.
- **User Story 4 (Phase 6)**: Depends on US1 and US2 API behavior; can defer persistent UI until API workflow is stable.
- **Polish (Phase 7)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **US1 (P1)**: Required MVP; no dependency on other user stories after Foundational.
- **US2 (P2)**: Requires query logging and result-open behavior from US1 for full validation.
- **US3 (P3)**: Requires shared matching helpers from Foundational; independent of US2.
- **US4 (P4)**: Requires final endpoint behavior from US1 and US2; Surface UI tasks are optional if curl/browser flow is chosen.

### Within Each User Story

- Add or update story-specific tests first.
- Implement route/type behavior after failing tests define expected contracts.
- Run the targeted `bun test` command for the touched spine route before moving to the next story.
- Keep tracks append-only and avoid taxonomy, semantic retrieval, OCR, board views, and auto cleanup in every story.

---

## Parallel Opportunities

- T002 and T003 can run in parallel after T001 starts.
- T008 can be prepared while T004-T007 are implemented, then finalized after helper signatures are stable.
- US1 test tasks T009-T011 can run in parallel.
- US2 test tasks T018-T020 can run in parallel after US1 behavior is available.
- US3 test tasks T030-T032 can run in parallel after shared matching helpers exist.
- US4 documentation/accessibility checks T038-T039 can run in parallel with the UI/no-UI decision task.
- Contract and surface contract updates T048-T049 can run in parallel during polish.

## Parallel Example: User Story 1

```bash
Task: "Update search response tests for primary, history, and empty_message in spine/src/routes/tracks.test.ts"
Task: "Add ordinary-wording search ranking tests for multi-token queries in spine/src/routes/tracks.test.ts"
Task: "Add blank-query and no-useful-match behavior tests in spine/src/routes/tracks.test.ts"
```

## Parallel Example: User Story 2

```bash
Task: "Add pending follow-up eligibility and affirmative-label tests in spine/src/routes/tracks.test.ts"
Task: "Add tests that unopened queries, newer matching tracks, and expired queries do not appear as pending in spine/src/routes/tracks.test.ts"
Task: "Add still-accurate, moved, skip, and invalid moved-text tests in spine/src/routes/tracks.test.ts"
```

## Parallel Example: User Story 3

```bash
Task: "Add duplicate-hint response tests for strong recent overlap in spine/src/routes/agent.track.test.ts"
Task: "Add tests proving duplicate hints do not block inserts or mutate prior rows in spine/src/routes/agent.track.test.ts"
Task: "Add tests for weak/no overlap returning an empty possible_duplicates array in spine/src/routes/agent.track.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 setup and Phase 2 foundational matching/types.
2. Complete Phase 3 US1 retrieval cycle.
3. Stop and validate search/open behavior using `bun test src/routes/tracks.test.ts` and the quickstart track/search/open steps.

### Incremental Delivery

1. Add US1 retrieval response and ranking.
2. Add US2 derived follow-ups and three outcomes.
3. Add US3 duplicate hints at tracking time.
4. Add or document US4 minimal user-facing workflow.
5. Run full smoke, `just test`, and `just check` before considering Phase 1 complete.

### Accessibility And Language Strategy

1. Treat persistent Surface UI as WCAG 2.2 AA scoped work if it is added.
2. Treat curl/browser/Signal flow copy as user-facing CLI/message text that must be readable without color and use explicit action labels.
3. Keep bilingual delivery marked N/A unless a translation requirement or translation resource is introduced separately.
