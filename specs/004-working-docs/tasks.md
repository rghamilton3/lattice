# Tasks: Working Docs

**Input**: Design documents from `/specs/004-working-docs/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/working.md, quickstart.md

**Tests**: Unit and route tests are included because the feature specification and existing project structure identify backend document lifecycle behavior as required validation.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify existing working-doc infrastructure and implementation context.

- [X] T001 Verify existing working-doc source, route, API, editor, and workbench files match the plan structure
- [X] T002 [P] Confirm plan artifacts cover contracts, data model, quickstart, and accessibility evidence for `specs/004-working-docs/plan.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared validation and API behavior that all user stories depend on.

- [X] T003 [P] Review working-doc API contract coverage in `specs/004-working-docs/contracts/working.md`
- [X] T004 [P] Review working-doc data model coverage in `specs/004-working-docs/data-model.md`
- [X] T005 Confirm existing Authentik-protected route registration for `/api/working` in `spine/src/app.ts`

---

## Phase 3: User Story 1 - Create and Save a Working Document (Priority: P1) MVP

**Goal**: Users can create a markdown working document, save it, and reopen it with source content preserved.

**Independent Test**: Create a document with markdown content, read it back, and verify slug, title, modified timestamp, and body are preserved.

### Tests for User Story 1

- [X] T006 [P] [US1] Add unit coverage for trimmed/unsafe title handling and verbatim empty content preservation in `spine/tests/unit/working.test.ts`
- [X] T007 [P] [US1] Add route coverage for titles that produce empty slugs and explicit empty content in `spine/tests/routes/working-route.test.ts`

### Implementation for User Story 1

- [X] T008 [US1] Return a recoverable validation error for titles that produce empty slugs in `spine/src/routes/working.ts`
- [X] T009 [US1] Preserve explicitly provided empty markdown content during create in `spine/src/working.ts`
- [X] T010 [US1] Improve editor save-status announcements and manual save affordance in `surface/src/components/editor/EditorPane.svelte`

**Checkpoint**: User Story 1 document creation and save feedback are independently testable.

---

## Phase 4: User Story 2 - Browse and Read Existing Working Documents (Priority: P2)

**Goal**: Users can browse existing working documents and open one for reading from the workbench.

**Independent Test**: Seed multiple working documents, list them newest-first, and open the expected document by slug.

### Tests for User Story 2

- [X] T011 [P] [US2] Add route coverage for newest-first working list order in `spine/tests/routes/working-route.test.ts`

### Implementation for User Story 2

- [X] T012 [US2] Improve working-document empty/error state text in `surface/src/components/home/LibraryView.svelte`
- [X] T013 [US2] Confirm working-document open actions expose clear accessible names in `surface/src/components/home/LibraryView.svelte`

**Checkpoint**: User Story 2 browsing and opening are independently testable.

---

## Phase 5: User Story 3 - Edit and Delete Working Documents (Priority: P3)

**Goal**: Users can revise or remove working documents without breaking the surrounding workbench.

**Independent Test**: Update a saved document, confirm persistence, delete it, and verify list/read behavior reflects removal.

### Tests for User Story 3

- [X] T014 [P] [US3] Add route coverage that deleted working docs are removed from `GET /api/working` in `spine/tests/routes/working-route.test.ts`

### Implementation for User Story 3

- [X] T015 [US3] Add editor delete action with confirmation, query invalidation, and workbench navigation in `surface/src/components/editor/EditorPane.svelte`
- [X] T016 [US3] Surface missing-document editor errors without trapping users in a broken pane in `surface/src/components/editor/EditorPane.svelte`

**Checkpoint**: User Story 3 edit/delete lifecycle is independently testable.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validate the full feature and record evidence.

- [X] T017 Update WCAG 2.2 AA working-doc evidence in `docs/accessibility/working-docs.md`
- [X] T018 Run spine working-doc tests: `cd spine && bun test tests/unit/working.test.ts tests/routes/working-route.test.ts`
- [X] T019 Run surface validation: `cd surface && bun run check`
- [X] T020 Validate quickstart scenarios in `specs/004-working-docs/quickstart.md`
- [X] T021 Update Time Machine queue completion metadata in `.specify/extensions/time-machine/features-queue.yml`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on setup completion and blocks user story implementation.
- **User Story 1 (Phase 3)**: Depends on foundational phase; MVP path.
- **User Story 2 (Phase 4)**: Depends on foundational phase and can be validated after list/read routes pass.
- **User Story 3 (Phase 5)**: Depends on foundational phase and benefits from US1 editor save handling.
- **Polish (Phase 6)**: Depends on selected user stories being complete.

### Parallel Opportunities

- T002, T003, and T004 can run in parallel with setup/context review.
- T006, T007, T011, and T014 affect focused backend tests and can be drafted independently.
- Surface tasks T010, T012, T013, T015, and T016 affect two components and should be integrated before `bun run check`.

---

## Implementation Strategy

### MVP First

1. Complete setup/foundational tasks.
2. Complete US1 tests and validation/save feedback changes.
3. Run `cd spine && bun test tests/unit/working.test.ts tests/routes/working-route.test.ts` and `cd surface && bun run check`.

### Incremental Delivery

1. Add US2 route list-order coverage and working-list state text improvements.
2. Add US3 delete UI and missing-document recovery.
3. Complete accessibility evidence and quickstart validation.
