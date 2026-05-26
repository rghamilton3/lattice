# Tasks: Retrieval Search

**Input**: Design documents from `/specs/003-retrieval-search/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/retrieval.md, quickstart.md

**Tests**: Route tests are included because the feature specification and existing project structure identify backend contract behavior as required validation.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify existing retrieval infrastructure and implementation context.

- [X] T001 Verify repository ignore/tooling coverage for Bun/Svelte/TypeScript artifacts in `.gitignore`, `.prettierignore`, `.dockerignore`, and `surface/eslint.config.js`
- [X] T002 [P] Confirm plan artifacts reference retrieval source, tests, and accessibility evidence in `specs/003-retrieval-search/plan.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared retrieval contracts and data mapping behavior that all user stories depend on.

- [X] T003 [P] Review retrieval API contract coverage in `specs/003-retrieval-search/contracts/retrieval.md`
- [X] T004 [P] Review retrieval data model coverage in `specs/003-retrieval-search/data-model.md`
- [X] T005 Confirm existing Authentik-protected route registration for `/api/search`, `/api/files`, `/api/similar`, and `/api/nearby` in `spine/src/app.ts`

---

## Phase 3: User Story 1 - Search Indexed Knowledge (Priority: P1) MVP

**Goal**: Users can search indexed captures, working material, local files, and attachment metadata with openable result references and clear UI states.

**Independent Test**: Seed captures/files, perform search, and verify mapped results include kind, snippet, recency, score, and openable identifiers.

### Tests for User Story 1

- [X] T006 [P] [US1] Add route coverage for local-file search result row ids and unavailable search empty-state behavior in `spine/tests/routes/search.test.ts`

### Implementation for User Story 1

- [X] T007 [US1] Map local-file search hits to their SQLite row id while preserving machine id and modified time in `spine/src/search.ts`
- [X] T008 [US1] Improve search result loading, empty, and error state text with accessible roles in `surface/src/components/home/LibraryView.svelte`
- [X] T009 [US1] Improve lateral results loading, empty, and error state text with accessible roles in `surface/src/components/search/ResultList.svelte`
- [X] T010 [US1] Add accessible action labels and score semantics for search result rows in `surface/src/components/search/ResultRow.svelte`

**Checkpoint**: User Story 1 search results are openable and state text is accessible.

---

## Phase 4: User Story 2 - Browse Indexed Files (Priority: P2)

**Goal**: Users can browse indexed files with newest-first pagination and safe raw-file/detail access.

**Independent Test**: Seed file rows, browse pages without duplicates, open file detail, and request raw content for valid, missing, and unsafe paths.

### Tests for User Story 2

- [X] T011 [P] [US2] Add route coverage for strict file id validation and file-list cursor boundaries in `spine/tests/routes/files.test.ts`

### Implementation for User Story 2

- [X] T012 [US2] Enforce strict positive integer id parsing for file detail/raw routes in `spine/src/routes/files.ts`
- [X] T013 [US2] Improve indexed-file browse loading/error/empty text and file row labels in `surface/src/components/home/LibraryView.svelte`

**Checkpoint**: User Story 2 file browsing and safe raw access are independently testable.

---

## Phase 5: User Story 3 - Discover Related Material (Priority: P3)

**Goal**: Users can request similar and nearby material from supported source items without duplicated source results.

**Independent Test**: Seed a source item plus candidates, request similar/nearby, and verify source exclusion, caps, bounds, and chronological nearby ordering.

### Tests for User Story 3

- [X] T014 [P] [US3] Add route coverage for local-file similar source exclusion and strict lateral id validation in `spine/tests/routes/lateral.test.ts`

### Implementation for User Story 3

- [X] T015 [US3] Exclude local-file source items from similar results in `spine/src/routes/lateral.ts`
- [X] T016 [US3] Preserve nearby result timestamps when converting nearby results to search rows in `surface/src/components/search/ResultList.svelte`
- [X] T017 [US3] Improve filter/facet control accessible labels and state text in `surface/src/components/search/Facets.svelte`

**Checkpoint**: User Story 3 similar and nearby discovery are independently testable.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validate the full feature and record evidence.

- [X] T018 Update WCAG 2.2 AA retrieval search evidence in `docs/accessibility/retrieval-search.md`
- [X] T019 Run spine retrieval tests: `cd spine && bun test tests/routes/search.test.ts tests/routes/lateral.test.ts tests/routes/files.test.ts`
- [X] T020 Run surface validation: `cd surface && bun run check`
- [X] T021 Validate quickstart scenarios in `specs/003-retrieval-search/quickstart.md`
- [X] T022 Update Time Machine queue completion metadata in `.specify/extensions/time-machine/features-queue.yml`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on setup completion and blocks user story implementation.
- **User Story 1 (Phase 3)**: Depends on foundational phase; MVP path.
- **User Story 2 (Phase 4)**: Depends on foundational phase; can be validated independently after backend files tests pass.
- **User Story 3 (Phase 5)**: Depends on foundational phase and benefits from US1 local-file id mapping.
- **Polish (Phase 6)**: Depends on selected user stories being complete.

### Parallel Opportunities

- T002, T003, T004 can run in parallel with setup/context review.
- T006, T011, and T014 affect separate test files and can be drafted independently.
- Surface accessibility tasks T008, T009, T010, T013, T016, and T017 affect focused components but should be integrated before `bun run check`.

---

## Implementation Strategy

### MVP First

1. Complete setup/foundational tasks.
2. Complete US1 tests and search mapping/UI states.
3. Run `cd spine && bun test tests/routes/search.test.ts` and `cd surface && bun run check`.

### Incremental Delivery

1. Add US2 strict file route validation and file browse state text.
2. Add US3 local-file similar exclusion and lateral accessibility improvements.
3. Complete accessibility evidence and quickstart validation.
