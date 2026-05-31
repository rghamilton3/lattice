# Tasks: Annotations and Diagram Authoring

**Input**: Design documents from `specs/014-annotations-diagrams/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/annotations-api.md`, `contracts/search-contract.md`, `contracts/working-doc-diagrams.md`, `quickstart.md`

**Tests**: Included because `plan.md` explicitly requires Bun tests, Surface Vitest/browser tests, and quickstart validation for annotation, search, diagram, keyboard, and accessibility flows.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing. User story tasks include `[US1]`, `[US2]`, or `[US3]`; setup, foundational, and polish tasks intentionally do not.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files and does not depend on an incomplete task in the same phase
- **[Story]**: Maps task to a user story from `spec.md`
- Every task includes an exact file path

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish shared schema and type contracts used by annotation creation, annotation search, and Surface integration.

- [X] T001 Create SQLite annotations table migration with constraints for target kind, target id, optional offsets, selected text, non-empty comment, and timestamps in `spine/migrations/012_annotations.sql`
- [X] T002 [P] Add shared Annotation, AnnotationTargetKind, AnnotationCreateInput, and AnnotationListResponse API types in `surface/src/lib/types.ts`
- [X] T003 [P] Add spine-side annotation row/input/result types and supported target kind constants in `spine/src/annotations.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core annotation validation, typed API access, and selection helpers that must exist before user-story UI or route work begins.

**CRITICAL**: No user story work can begin until this phase is complete.

- [X] T004 Implement annotation input validation helpers for target kind, target id, offsets, selected text, and trimmed comment in `spine/src/annotations.ts`
- [X] T005 [P] Create typed Surface annotation API wrapper for list, create, and delete requests in `surface/src/lib/api/annotations.ts`
- [X] T006 [P] Extend selection utilities to return trimmed selected text plus best-effort character offsets relative to a reading container in `surface/src/lib/utils/selection.ts`
- [X] T007 [P] Add annotation API query keys for target-scoped annotation lists and mutations in `surface/src/lib/api/annotations.ts`
- [X] T008 Add annotation route import and authenticated browser route registration placeholder in `spine/src/app.ts`

**Checkpoint**: Foundation ready; user story implementation can now begin.

---

## Phase 3: User Story 1 - Comment on Any Passage (Priority: P1) MVP

**Goal**: The user can select text in captures, local files, working docs, and archived pages, save a non-empty comment, revisit the item, see the highlight/note, and delete the annotation without modifying source content.

**Independent Test**: Open each supported readable content type, select non-empty text, save a comment, close/reopen the item, confirm highlight and note remain attached, delete one annotation, and confirm the source text did not change.

### Tests for User Story 1

- [ ] T009 [P] [US1] Add migration/schema tests for `annotations` table columns, target kind validation, offset validation, and timestamp defaults in `spine/tests/unit/annotations.test.ts`
- [X] T010 [P] [US1] Add route tests for `POST /api/annotations`, `GET /api/annotations`, and `DELETE /api/annotations/:id` success responses in `spine/tests/routes/annotations.test.ts`
- [X] T011 [P] [US1] Add route validation tests for empty comments, invalid target kinds, invalid offsets, empty selections, missing query parameters, and unknown ids in `spine/tests/routes/annotations.test.ts`
- [ ] T012 [P] [US1] Add Surface API client tests for annotation list/create/delete request paths and payloads in `surface/src/lib/api/annotations.test.ts`
- [ ] T013 [P] [US1] Add selection utility tests for trimmed text, whitespace-only rejection, and best-effort offsets in `surface/src/lib/utils/selection.test.ts`
- [ ] T014 [P] [US1] Add ReadingPane browser tests for keyboard annotation creation, highlight display, note association, delete action, and visible focus states in `surface/src/components/reading/ReadingPane.svelte.test.ts`

### Implementation for User Story 1

- [X] T015 [US1] Implement annotation repository functions for create, list by target, delete by id, and row mapping in `spine/src/annotations.ts`
- [X] T016 [US1] Implement `POST /api/annotations`, `GET /api/annotations`, and `DELETE /api/annotations/:id` Elysia routes using browser auth in `spine/src/routes/annotations.ts`
- [X] T017 [US1] Wire `annotationsRoutes(db)` into the authenticated route group in `spine/src/app.ts`
- [X] T018 [US1] Implement `fetchAnnotations`, `createAnnotation`, and `deleteAnnotation` functions using `apiFetch` in `surface/src/lib/api/annotations.ts`
- [X] T019 [US1] Add target identity derivation for capture, local file, working doc, and archive reading states in `surface/src/components/reading/ReadingPane.svelte`
- [X] T020 [US1] Load and cache target-scoped annotations with TanStack Query in `surface/src/components/reading/ReadingPane.svelte`
- [X] T021 [US1] Add keyboard-operable annotation creation UI for selected passages, empty selection errors, empty comment errors, and non-urgent copy in `surface/src/components/reading/ReadingPane.svelte`
- [X] T022 [US1] Render saved annotation highlights and associated notes without changing source content in `surface/src/components/reading/ReadingPane.svelte`
- [X] T023 [US1] Add keyboard-operable delete controls with mutation invalidation and non-urgent confirmation/error copy in `surface/src/components/reading/ReadingPane.svelte`
- [X] T024 [US1] Add non-color-only highlight styling, visible focus indicators, accessible names, and semantic note associations in `surface/src/components/reading/ReadingPane.svelte`
- [ ] T025 [US1] Verify annotation create/revisit/delete manually for capture, local file, working doc, and archive targets using `specs/014-annotations-diagrams/quickstart.md`

**Checkpoint**: User Story 1 is fully functional and independently testable.

---

## Phase 4: User Story 2 - Find Annotated Material Through Search (Priority: P2)

**Goal**: Annotation comment text participates in the existing search experience, search results open the original annotated source, and deleted annotations stop producing matches.

**Independent Test**: Create an annotation with a distinctive phrase, search for that phrase, confirm the original annotated item appears with annotation context, open the result to reveal the annotation, delete the annotation, and confirm the deleted text no longer matches.

### Tests for User Story 2

- [ ] T026 [P] [US2] Add unit tests for annotation markdown generation and annotation index file delete behavior in `spine/tests/unit/search-annotations.test.ts`
- [X] T027 [P] [US2] Add search route tests proving annotation text returns the annotated source and deleted annotation text stops matching in `spine/tests/routes/search.test.ts`
- [ ] T028 [P] [US2] Add Surface search result tests for annotation context display and opening the annotated source target in `surface/src/components/search/ResultRow.svelte.test.ts`

### Implementation for User Story 2

- [X] T029 [US2] Add annotation QMD directory helper, markdown serializer, write helper, and delete helper in `spine/src/search.ts`
- [X] T030 [US2] Include existing annotations in `initSearch`, register the `annotations` QMD collection, and refresh the index after annotation file changes in `spine/src/search.ts`
- [X] T031 [US2] Call annotation index write on create and annotation index delete on delete from `spine/src/annotations.ts`
- [X] T032 [US2] Map QMD annotation collection hits back to original target kind, target id, annotation id, snippet, title fallback, and modified timestamp in `spine/src/search.ts`
- [X] T033 [US2] Extend Surface `SearchResult` union with annotation-origin fields `target_kind`, `target_id`, and `annotation_id` in `surface/src/lib/types.ts`
- [X] T034 [US2] Update search result rendering to expose annotation-match context and route to the annotated source instead of an annotation-only page in `surface/src/components/search/ResultRow.svelte`
- [X] T035 [US2] Pass annotation reveal context from search results into reading pane navigation state in `surface/src/lib/state/workbench.svelte.ts`
- [X] T036 [US2] Reveal or focus the matching annotation when opening an annotation-origin result in `surface/src/components/reading/ReadingPane.svelte`
- [ ] T037 [US2] Verify distinctive annotation phrase search, annotation-origin result context, source navigation, and deleted annotation search removal using `specs/014-annotations-diagrams/quickstart.md`

**Checkpoint**: User Stories 1 and 2 work independently and together.

---

## Phase 5: User Story 3 - Author Mermaid Diagrams in Working Docs (Priority: P3)

**Goal**: The user can insert an editable Mermaid fenced block into a working doc, preview valid diagrams inline, preserve source text for editing/search, and recover from invalid Mermaid syntax without data loss.

**Independent Test**: Open a working doc, use the insert diagram control from the keyboard, edit the Mermaid source, confirm valid diagrams render inline, confirm invalid syntax shows a clear non-destructive error, and search for a distinctive diagram node label.

### Tests for User Story 3

- [ ] T038 [P] [US3] Add EditorPane browser tests for keyboard insert-diagram action, fenced Mermaid template insertion, cursor/focus behavior, and working-doc content preservation in `surface/src/components/editor/EditorPane.svelte.test.ts`
- [ ] T039 [P] [US3] Add MarkdownRenderer browser tests for valid Mermaid rendering and invalid Mermaid non-destructive error display in `surface/src/components/reading/MarkdownRenderer.svelte.test.ts`
- [ ] T040 [P] [US3] Add working-doc route/search regression test proving Mermaid source remains persisted as markdown and searchable in `spine/tests/routes/working-route.test.ts`

### Implementation for User Story 3

- [X] T041 [US3] Add keyboard-operable insert diagram command that inserts the fenced Mermaid template at the current cursor or selection in `surface/src/components/editor/EditorPane.svelte`
- [X] T042 [US3] Add editor toolbar or command-palette entry for diagram insertion with accessible name, visible focus, and no pointer-only dependency in `surface/src/components/editor/EditorPane.svelte`
- [X] T043 [US3] Ensure valid fenced `mermaid` blocks render inline through the existing Mermaid path without stripping source markdown in `surface/src/components/reading/MarkdownRenderer.svelte`
- [X] T044 [US3] Add clear, screen-reader-understandable, keyboard-reachable non-destructive Mermaid render error UI in `surface/src/components/reading/MarkdownRenderer.svelte`
- [ ] T045 [US3] Verify diagram insertion, valid preview, invalid syntax recovery, keyboard-only operation, and diagram source search using `specs/014-annotations-diagrams/quickstart.md`

**Checkpoint**: All user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, accessibility evidence, language policy confirmation, and whole-project quality gates.

- [X] T046 [P] Run spine test suite and fix failures from annotation schema, routes, and search indexing in `spine/`
- [X] T047 [P] Run Surface test suite and fix failures from annotation UI, search result UI, and diagram insertion/rendering in `surface/`
- [ ] T048 Perform WCAG 2.2 AA keyboard, focus, semantics, non-color-only highlight, assistive-technology reachable error, and diagram preview validation notes in `specs/014-annotations-diagrams/quickstart.md`
- [ ] T049 Confirm bilingual delivery remains N/A for this personal-system phase and that new user-facing copy avoids urgency, guilt, backlog, streak, or overdue framing in `specs/014-annotations-diagrams/spec.md`
- [X] T050 Run repository lint and type checks, then fix all feature-related issues in `spine/`, `surface/`, and `specs/014-annotations-diagrams/tasks.md`
- [ ] T051 Complete final manual quickstart validation for annotation, search, diagram, and accessibility flows in `specs/014-annotations-diagrams/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion; blocks all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational completion; MVP scope.
- **User Story 2 (Phase 4)**: Depends on Foundational completion and integrates with annotation records from US1; can be developed with route/service test fixtures if US1 UI is not complete.
- **User Story 3 (Phase 5)**: Depends on Foundational completion only; independent of annotation storage and search indexing except final whole-app validation.
- **Polish (Phase 6)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **US1 (P1)**: No dependency on other user stories; delivers annotation create/view/delete MVP.
- **US2 (P2)**: Requires annotation records and index files; should remain independently testable through backend fixtures and Surface search mocks.
- **US3 (P3)**: No dependency on US1 or US2; uses existing working-doc editor and markdown rendering paths.

### Within Each User Story

- Tests should be written first and should fail before implementation.
- Schema/types before services.
- Services before routes.
- API clients before UI integration.
- Accessibility expectations are part of the story implementation, not deferred to polish.

---

## Parallel Execution Examples

### User Story 1

```bash
Task: "T009 [US1] Add migration/schema tests in spine/tests/unit/annotations.test.ts"
Task: "T012 [US1] Add Surface API client tests in surface/src/lib/api/annotations.test.ts"
Task: "T013 [US1] Add selection utility tests in surface/src/lib/utils/selection.test.ts"
Task: "T014 [US1] Add ReadingPane browser tests in surface/src/components/reading/ReadingPane.svelte.test.ts"
```

### User Story 2

```bash
Task: "T026 [US2] Add annotation search unit tests in spine/tests/unit/search-annotations.test.ts"
Task: "T027 [US2] Add annotation search route tests in spine/tests/routes/search.test.ts"
Task: "T028 [US2] Add Surface annotation search result tests in surface/src/components/search/ResultRow.svelte.test.ts"
```

### User Story 3

```bash
Task: "T038 [US3] Add EditorPane diagram insertion tests in surface/src/components/editor/EditorPane.svelte.test.ts"
Task: "T039 [US3] Add MarkdownRenderer Mermaid tests in surface/src/components/reading/MarkdownRenderer.svelte.test.ts"
Task: "T040 [US3] Add working-doc Mermaid source regression test in spine/tests/routes/working-route.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Complete Phase 3: User Story 1.
4. Stop and validate annotation create/revisit/delete independently across all supported target kinds.
5. Only then proceed to annotation search and diagram authoring.

### Incremental Delivery

1. Setup plus Foundational creates the migration, shared types, API client shell, and selection helpers.
2. US1 adds persistent annotations and the reading UX.
3. US2 adds annotation-aware search and source navigation.
4. US3 adds Mermaid diagram insertion and rendering/error UX in working docs.
5. Polish validates accessibility, language constraints, lint, type checks, and manual quickstart flows.

### Parallel Team Strategy

1. Complete Phase 1 and Phase 2 together.
2. After the foundation is complete, one implementer can focus on US1 storage/routes/UI, another on US2 search indexing/result mapping with fixtures, and another on US3 editor/renderer work.
3. Merge by story checkpoint, running the story-specific tests before moving to the next priority.

---

## Notes

- `[P]` tasks touch different files and can run in parallel after their phase dependencies are met.
- All browser routes for annotations must stay in the existing Authentik-guarded route group, not under `/api/agent/*`.
- Source documents must never be modified by annotation create, view, or delete operations.
- Mermaid diagrams remain plain fenced markdown in working docs; no separate diagram table is part of this phase.
- Accessibility and keyboard operation are acceptance requirements for every affected UI task.
- Bilingual delivery is explicitly N/A for this phase unless future project policy changes.
