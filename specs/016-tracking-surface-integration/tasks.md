# Tasks: Tracking Surface Integration

**Input**: Design documents from `/specs/016-tracking-surface-integration/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/tracking-surface-api.md, contracts/tracking-surface-ui.md, quickstart.md

**Tests**: Include focused Spine route tests, Surface unit/component tests, and representative Playwright flows because the plan and quickstart define required validation for search, creation, board movement, follow-ups, keyboard access, and responsive behavior.

**Organization**: Tasks are grouped by user story so each story can be implemented and tested independently after the shared foundation is complete.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files and has no dependency on another incomplete task in the same phase
- **[Story]**: User story label for traceability; setup, foundational, and polish tasks have no story label
- Every task includes exact file paths

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare the shared files and documentation surfaces needed by all tracking work.

- [X] T001 Create `surface/src/components/tracking/` directory with placeholder `TrackingView.svelte` in `surface/src/components/tracking/TrackingView.svelte`
- [X] T002 [P] Create tracking accessibility evidence document scaffold in `docs/accessibility/tracking-surface.md`
- [X] T003 [P] Add empty Surface tracking API module with exported query-key namespace in `surface/src/lib/api/tracks.ts`
- [X] T004 [P] Add tracking type section placeholders in `surface/src/lib/types.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core API/data primitives that must exist before any user story can be completed.

**CRITICAL**: No user story work can be considered complete until this phase is complete.

- [X] T005 Add `track_bins` schema migration with unique active normalized names in `spine/migrations/013_track_bins.sql`
- [X] T006 Add Spine row and response interfaces for `TrackBinRow`, `TrackPhoto`, `TrackDetailResponse`, `TrackBoardCard`, `TrackBoardResponse`, and board action responses in `spine/src/db/rows.ts`
- [X] T007 Add reusable track validation and insertion helper for browser-created `surface-*` records in `spine/src/routes/tracks.ts`
- [X] T008 Add reusable item phrase, location phrase, newest-wins, and bin-normalization helpers for board/detail derivation in `spine/src/routes/tracks.ts`
- [X] T009 Add local track photo storage helpers using canonical path checks and `X-Content-Type-Options: nosniff` in `spine/src/routes/tracks.ts`
- [X] T010 Add shared Surface tracking interfaces for records, search responses, detail responses, bins, board cards, board responses, photos, and follow-ups in `surface/src/lib/types.ts`
- [X] T011 Implement typed Surface tracking API wrappers and query keys for all `/api/tracks/*` contracts in `surface/src/lib/api/tracks.ts`
- [X] T012 Add tracking pane content variants for workspace and record detail navigation in `surface/src/lib/types.ts`
- [X] T013 Update workbench pane comparison, navigation helpers, and view handling for tracking pane content in `surface/src/lib/state/workbench.svelte.ts`
- [X] T014 Route tracking pane content to `TrackingView.svelte` from `surface/src/components/workbench/PaneRouter.svelte`

**Checkpoint**: Foundation ready; user story implementation can now begin.

---

## Phase 3: User Story 1 - Search And Review Tracked Items (Priority: P1) MVP

**Goal**: Users can search tracking records from Surface, see a top answer plus history/context/photo indicators, and open a stable reading view.

**Independent Test**: Search for an item with multiple prior records and confirm the user can identify the current best answer, origin context, photo availability, and related history from Surface alone; reload a stable detail link and confirm it restores the same record.

### Tests for User Story 1

- [X] T015 [US1] Add Spine route tests for `GET /api/tracks/:id` success, same-item history, related-location records, and 404 behavior in `spine/src/routes/tracks.test.ts`
- [X] T016 [US1] Add Surface API wrapper tests for tracking search, query-open, and record-detail calls in `surface/src/lib/api/tracks.test.ts`
- [X] T017 [US1] Add Surface workbench state tests for opening tracking workspace and stable tracking detail pane content in `surface/src/lib/state/workbench.test.ts`

### Implementation for User Story 1

- [X] T018 [US1] Implement `GET /api/tracks/:id` reading payload with selected record, same-item history, and related location tracks in `spine/src/routes/tracks.ts`
- [X] T019 [US1] Create search input, top-result, history, empty, loading, and error UI consolidated in `surface/src/components/tracking/TrackingView.svelte`
- [X] T020 [US1] Create stable tracking reading view with selected record, same-item history, related location records, source/displaced/photo context, and back action consolidated in `surface/src/components/tracking/TrackingView.svelte`
- [X] T021 [US1] Compose search and reading modes in the tracking container in `surface/src/components/tracking/TrackingView.svelte`
- [X] T022 [US1] Wire result opening to `POST /api/tracks/queries/:id/open` and tracking detail pane navigation consolidated in `surface/src/components/tracking/TrackingView.svelte`
- [X] T023 [US1] Add tracking workspace entry point to existing Surface navigation or home/workbench controls in `surface/src/components/shell/AppShell.svelte`
- [X] T024 [US1] Add Playwright coverage for search, open result, browser back, and stable detail reload in `surface/e2e/surface.e2e.ts`

**Checkpoint**: User Story 1 is fully functional and independently testable as the MVP.

---

## Phase 4: User Story 2 - Track From The Surface (Priority: P2)

**Goal**: Users can create a text-only or photo-backed tracking record from Surface and immediately find it through search/history.

**Independent Test**: Submit a blank entry and see validation with no record; submit text-only and photo-backed entries; confirm created records appear in search and preserve source/photo context.

### Tests for User Story 2

- [X] T025 [US2] Add Spine route tests for `POST /api/tracks`, source validation, blank text rejection, supersedes validation, duplicate hints, and immediate search visibility in `spine/src/routes/tracks.test.ts`
- [X] T026 [US2] Add Spine route tests for `POST /api/tracks/photos` and `GET /api/tracks/photos/:ref/raw` success, unsupported upload rejection, missing file behavior, and path-safety rejection in `spine/src/routes/tracks.test.ts`
- [X] T027 [US2] Add Surface API wrapper tests for create-track and photo-upload calls in `surface/src/lib/api/tracks.test.ts`

### Implementation for User Story 2

- [X] T028 [US2] Implement browser-authenticated `POST /api/tracks` with append-only insertion and documented `surface-*` source enforcement in `spine/src/routes/tracks.ts`
- [X] T029 [US2] Implement `POST /api/tracks/photos` local image upload and authenticated `GET /api/tracks/photos/:ref/raw` serving in `spine/src/routes/tracks.ts`
- [X] T030 [US2] Create text entry, optional photo upload, validation, save failure retry, and success state UI consolidated in `surface/src/components/tracking/TrackingView.svelte`
- [X] T031 [US2] Integrate the consolidated tracking form into the tracking workspace and refresh/invalidate search, board, and follow-up state after successful save in `surface/src/components/tracking/TrackingView.svelte`
- [X] T032 [US2] Add Playwright coverage for blank validation, text-only create, photo create, and save-failure retry behavior in `surface/e2e/surface.e2e.ts`

**Checkpoint**: User Story 2 works independently and does not require voice, phone, or command-line workflows.

---

## Phase 5: User Story 3 - Reorganize Items On A Board (Priority: P3)

**Goal**: Users can view derived item cards in free-text bins, create bins, move cards by pointer or keyboard controls, and mark items displaced without merging item identities.

**Independent Test**: Create bins, view cards, move a card into a bin, confirm a new current track is created with previous history preserved, and confirm displaced indicators/filter work with keyboard-only access.

### Tests for User Story 3

- [X] T033 [US3] Add Spine route tests for `GET /api/tracks/board`, bin grouping, unbinned cards, newest-wins card derivation, displaced-only filtering, and fuzzy duplicate separation in `spine/src/routes/tracks.test.ts`
- [X] T034 [US3] Add Spine route tests for `POST /api/tracks/bins`, duplicate normalized-name handling, `POST /api/tracks/board/move`, and `POST /api/tracks/board/checkout` in `spine/src/routes/tracks.test.ts`
- [X] T035 [US3] Add Surface API wrapper tests for board, create-bin, move-card, and checkout calls in `surface/src/lib/api/tracks.test.ts`

### Implementation for User Story 3

- [X] T036 [US3] Implement `GET /api/tracks/board?displaced=all|only` with durable bins, derived current cards, unbinned cards, displaced count, and no automatic merges in `spine/src/routes/tracks.ts`
- [X] T037 [US3] Implement `POST /api/tracks/bins` with free-text validation, normalization, active duplicate handling, and phrase-promotion support in `spine/src/routes/tracks.ts`
- [X] T038 [US3] Implement `POST /api/tracks/board/move` to create `<item phrase> in <bin name>` records with `displaced=false`, `supersedes=from_track_id`, and source `surface-drag` or `surface-board` in `spine/src/routes/tracks.ts`
- [X] T039 [US3] Implement `POST /api/tracks/board/checkout` to create displaced checkout records with free-form context and `supersedes=from_track_id` in `spine/src/routes/tracks.ts`
- [X] T040 [US3] Create board bins, unbinned area, cards, create-bin form, phrase-promote affordance, displaced indicator, and displaced-only filter consolidated in `surface/src/components/tracking/TrackingView.svelte`
- [X] T041 [US3] Add keyboard-accessible card move controls, pointer drag where practical, move failure recovery, checkout context entry, and open-history action consolidated in `surface/src/components/tracking/TrackingView.svelte`
- [X] T042 [US3] Integrate the consolidated tracking board into the tracking workspace with board refresh after bin, move, checkout, and create-track operations in `surface/src/components/tracking/TrackingView.svelte`
- [X] T043 [US3] Add Playwright coverage for create bin, keyboard card move, pointer card move if implemented, displaced checkout, displaced filter, and no drag-to-merge behavior in `surface/e2e/surface.e2e.ts`

**Checkpoint**: User Story 3 works independently while preserving append-only newest-wins history.

---

## Phase 6: User Story 4 - Resolve Tracking Follow-Ups (Priority: P4)

**Goal**: Pending follow-ups appear as action rows in Surface so users can confirm still accurate, record moved, or skip without backlog language.

**Independent Test**: Prepare pending follow-ups for displaced and non-displaced records, complete still-accurate, moved, and skip actions, and confirm prompts disappear without backlog behavior.

### Tests for User Story 4

- [X] T044 [US4] Add Surface API wrapper tests for fetch follow-ups, still-accurate, moved, and skip calls in `surface/src/lib/api/tracks.test.ts`
- [X] T045 [US4] Add Playwright coverage for visible follow-up rows, `Still there`, `Still out`, moved entry, skip, and no-reappearing prompt behavior in `surface/e2e/surface.e2e.ts`

### Implementation for User Story 4

- [X] T046 [US4] Create follow-up action rows with original query, opened record, API-provided affirmative label, moved-location input, skip, and non-backlog copy consolidated in `surface/src/components/tracking/TrackingView.svelte`
- [X] T047 [US4] Integrate consolidated follow-up rows into the tracking workspace and link to them from eligible home context in `surface/src/components/tracking/TrackingView.svelte`
- [X] T048 [US4] Add eligible follow-up rendering or link-in from the home context in `surface/src/components/home/HomeView.svelte`
- [X] T049 [US4] Ensure moved follow-up creates `surface-followup` records, resolves the prompt, refreshes search/board/follow-up state, and preserves typed retry text on failure consolidated in `surface/src/components/tracking/TrackingView.svelte`

**Checkpoint**: User Story 4 works independently and keeps follow-ups dismissible instead of accumulating obligations.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Accessibility, copy, responsive behavior, cleanup, and final validation across all stories.

- [X] T050 [P] Document WCAG 2.2 AA keyboard, focus, status messaging, accessible names, non-color-only displaced state, photo fallback, drag alternative, and responsive reflow evidence in `docs/accessibility/tracking-surface.md`
- [X] T051 [P] Record bilingual delivery as N/A with rationale and complete plain-English follow-up copy review in `docs/accessibility/tracking-surface.md`
- [X] T052 Verify no technical, debt, overdue, backlog, streak, or failure wording appears in user-facing tracking copy consolidated in `surface/src/components/tracking/TrackingView.svelte`
- [X] T053 Verify narrow-screen reflow and no page-level horizontal scrolling for tracking workspace in `surface/src/components/tracking/TrackingView.svelte`
- [X] T054 Run focused Spine tests for tracking routes and schema with `bun test src/routes/tracks.test.ts src/routes/agent.track.test.ts src/tracks.schema.test.ts` from `spine/`
- [X] T055 Run Surface validation with `bun run check`, `bun run test:unit -- --run`, and `bun run test:e2e` from `surface/`
- [ ] T056 Run root validation with `just test`, `just check`, and `just lint` from repository root when feasible

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion; blocks all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational completion; MVP scope
- **User Story 2 (Phase 4)**: Depends on Foundational completion; integrates with US1 search/history but can be validated independently after create/search flow exists
- **User Story 3 (Phase 5)**: Depends on Foundational completion and benefits from US2 create-track helpers for append-only board actions
- **User Story 4 (Phase 6)**: Depends on Foundational completion and existing Phase 1 follow-up API routes; integrates with US2 create-track wrappers for moved follow-up records
- **Polish (Phase 7)**: Depends on all desired user stories being complete

### User Story Dependencies

- **US1 Search And Review (P1)**: Start after Foundational; no dependency on other Phase 4 Surface stories
- **US2 Track From Surface (P2)**: Start after Foundational; search verification uses US1 if both are implemented, but API create behavior is independently testable
- **US3 Board Reorganization (P3)**: Start after Foundational; board actions reuse shared create helpers and must preserve independent board verification
- **US4 Follow-Ups (P4)**: Start after Foundational; uses existing follow-up endpoints and Surface API wrappers

### Within Each User Story

- Write or update tests before implementation tasks in that story
- Add Spine route behavior before Surface UI that depends on it
- Add typed Surface API wrappers before components that call those wrappers
- Complete each story checkpoint before moving to the next priority if working sequentially

---

## Parallel Opportunities

- T002, T003, and T004 can run in parallel after T001 if different agents own docs, API module, and types
- After Phase 2, Surface-only tests/components and Spine route work can be split by story when file conflicts are coordinated
- US1 Surface search and reading work is consolidated in `TrackingView.svelte`; coordinate edits there after T018 and T011
- US2 Spine route work can proceed in parallel with the consolidated create/photo UI in `TrackingView.svelte` after T011 if the API contract is followed
- US3 board endpoint tasks in `spine/src/routes/tracks.ts` should be serialized, while consolidated board UI edits are coordinated in `TrackingView.svelte`
- US4 consolidated follow-up rows in `TrackingView.svelte` and `HomeView.svelte` link-in work can proceed in parallel after the Surface API wrapper tests are in place
- T050 and T051 can run in parallel with late implementation cleanup once the UI copy and controls are stable

## Parallel Example: User Story 1

```bash
Task: "Implement GET /api/tracks/:id reading payload with selected record, same-item history, and related location tracks in spine/src/routes/tracks.ts"
Task: "Create search input, top-result, history, empty, loading, error UI, and stable reading view in surface/src/components/tracking/TrackingView.svelte"
```

## Parallel Example: User Story 2

```bash
Task: "Implement browser-authenticated POST /api/tracks with append-only insertion and documented surface-* source enforcement in spine/src/routes/tracks.ts"
Task: "Create text entry, optional photo upload, validation, save failure retry, and success state UI in surface/src/components/tracking/TrackingView.svelte"
```

## Parallel Example: User Story 3

```bash
Task: "Implement GET /api/tracks/board?displaced=all|only with durable bins, derived current cards, unbinned cards, displaced count, and no automatic merges in spine/src/routes/tracks.ts"
Task: "Create board bins, unbinned area, cards, create-bin form, phrase-promote affordance, displaced indicator, and displaced-only filter in surface/src/components/tracking/TrackingView.svelte"
```

## Parallel Example: User Story 4

```bash
Task: "Create follow-up action rows with original query, opened record, API-provided affirmative label, moved-location input, skip, and non-backlog copy in surface/src/components/tracking/TrackingView.svelte"
Task: "Add eligible follow-up rendering or link-in from the home context in surface/src/components/home/HomeView.svelte"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 setup.
2. Complete Phase 2 foundation.
3. Complete Phase 3 search and reading view.
4. Stop and validate US1 with Spine tests, Surface check, and the search/detail quickstart flow.

### Incremental Delivery

1. Deliver US1 so Surface can find and read tracking history.
2. Deliver US2 so Surface can create new records and photo-backed records.
3. Deliver US3 so board organization creates append-only moves and checkouts.
4. Deliver US4 so follow-ups close loops from within Surface.
5. Finish accessibility evidence, copy review, responsive checks, and root validation.

### Notes

- Preserve append-only tracking behavior; never edit old `tracks` rows for moves, corrections, or checkouts.
- Keep item cards derived; do not add a canonical item registry or drag-to-merge behavior.
- Keep browser routes under the existing Authentik `/api/*` model and do not call `/api/agent/track` from Surface.
- Do not add a new runtime dependency unless existing platform APIs cannot satisfy accessible board movement or photo upload.
