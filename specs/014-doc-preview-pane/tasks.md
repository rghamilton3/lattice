# Tasks: Working Doc Preview Pane

**Input**: Design documents from `/specs/014-doc-preview-pane/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/editor-preview.md, quickstart.md

**Tests**: Focused Playwright coverage is included because the specification defines measurable browser, responsive, keyboard, freshness, and rendering acceptance criteria. Run checks before merge.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Surface app**: `surface/src/`, `surface/e2e/`
- **Feature docs**: `specs/014-doc-preview-pane/`
- **Accessibility evidence**: `docs/accessibility/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the existing Surface editor, renderer, and validation context before editing.

- [X] T001 Review current CodeMirror mount, autosave, save success, save error, delete, and status behavior in `surface/src/components/editor/EditorPane.svelte`
- [X] T002 [P] Review current sanitized markdown rendering, fallback behavior, and overflow classes in `surface/src/components/reading/MarkdownRenderer.svelte`
- [X] T003 [P] Review existing working-doc editor coverage and API stubbing patterns in `surface/e2e/surface.e2e.ts`
- [X] T004 [P] Review current working-doc accessibility evidence sections to update for preview layout, status, keyboard, and reflow in `docs/accessibility/working-docs.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add split-preview status and renderer support that all user stories rely on.

**CRITICAL**: No user story work can begin until this phase is complete.

- [X] T005 Add editor preview-status text for saved-only split preview behavior in `surface/src/components/editor/EditorPane.svelte`
- [X] T006 Derive visible split-preview status from dirty edits, successful saves, and save failures in `surface/src/components/editor/EditorPane.svelte`
- [X] T007 Update successful save handling so the reading-pane preview refreshes only after `updateWorking(slug, content)` succeeds and preserves previous preview content on save failure in `surface/src/components/editor/EditorPane.svelte`
- [X] T008 Add an optional render-error callback or equivalent recoverable error signal while keeping sanitized output and escaped fallback behavior intact in `surface/src/components/reading/MarkdownRenderer.svelte` and `surface/src/components/reading/ReadingPane.svelte`

**Checkpoint**: Split-preview freshness state can be communicated without changing spine APIs, storage shape, or working-document fetch/save contracts.

---

## Phase 3: User Story 1 - Preview Saved Markdown Beside Editor (Priority: P1) MVP

**Goal**: Open rendered saved markdown beside the source editor through the workbench split-pane layout and refresh the preview after a successful save.

**Independent Test**: Open a working document with headings, lists, links, emphasis, block quotes, and code blocks; use Split to confirm source and rendered preview are visible side by side on desktop width; edit and save; confirm the preview reflects the saved markdown within 2 seconds.

### Validation Coverage for User Story 1

- [X] T009 [P] [US1] Add a Playwright smoke test that stubs `/api/working/:slug`, opens a working document, uses Split, and expects source and preview regions with markdown rendering in `surface/e2e/surface.e2e.ts`
- [X] T010 [P] [US1] Add a Playwright save-refresh assertion that edits markdown, fulfills the PUT save, and expects the preview to show the saved rendered result in `surface/e2e/surface.e2e.ts`

### Implementation for User Story 1

- [X] T011 [US1] Keep the CodeMirror editor as the primary source pane and add a Split action that opens the working document in the other workbench pane in `surface/src/components/editor/EditorPane.svelte`
- [X] T012 [US1] Reuse the existing reading-pane `MarkdownRenderer` for `${slug}.md` preview content in `surface/src/components/reading/ReadingPane.svelte`
- [X] T013 [US1] Preserve blank or incomplete markdown as readable saved content without treating empty markdown as an editor error in `surface/src/components/reading/MarkdownRenderer.svelte`
- [X] T014 [US1] Preserve independent workbench pane overflow, editor controls, and no page-level horizontal scrolling in `surface/src/components/editor/EditorPane.svelte`
- [X] T015 [US1] Adjust preview prose overflow for long lines, code blocks, Mermaid, KaTeX, and links without weakening DOMPurify sanitization in `surface/src/components/reading/MarkdownRenderer.svelte`
- [X] T016 [US1] Verify `cd surface && bun run check` passes after preview composition changes for `surface/src/components/editor/EditorPane.svelte` and `surface/src/components/reading/MarkdownRenderer.svelte`

**Checkpoint**: User Story 1 is fully functional and testable independently as the MVP.

---

## Phase 4: User Story 2 - Keep Editing Usable on Smaller Screens (Priority: P2)

**Goal**: Preserve editing, saving, navigation, and preview access on constrained viewports without crowding or horizontal page scrolling.

**Independent Test**: Open the editor at desktop and narrow widths; confirm required controls remain reachable, the editor remains usable, preview remains available, and keyboard navigation has no trap.

### Validation Coverage for User Story 2

- [X] T017 [P] [US2] Add a Playwright narrow-viewport test that confirms Back, Split, Save, Delete, Vim toggle, and source editor remain reachable without horizontal document overflow in `surface/e2e/surface.e2e.ts`
- [X] T018 [P] [US2] Add a Playwright keyboard-navigation test for Back, editor, preview status or links, Save, Delete, and Vim toggle with no focus trap in `surface/e2e/surface.e2e.ts`

### Implementation for User Story 2

- [X] T019 [US2] Add editor toolbar wrapping and split-action access below the desktop breakpoint in `surface/src/components/editor/EditorPane.svelte`
- [X] T020 [US2] Keep the editor pane primary and minimum usable height on constrained displays while retaining access to Split preview in `surface/src/components/editor/EditorPane.svelte`
- [X] T021 [US2] Ensure toolbar wrapping, focus order, button labels, and status text keep Back, Split, Save, Delete, and Vim toggle reachable at narrow widths in `surface/src/components/editor/EditorPane.svelte`
- [X] T022 [US2] Document manual keyboard and reflow validation evidence for the preview editor in `docs/accessibility/working-docs.md`
- [X] T023 [US2] Verify `cd surface && bun run test:e2e` includes the narrow viewport and keyboard scenarios for `surface/e2e/surface.e2e.ts`

**Checkpoint**: User Stories 1 and 2 work independently and together on desktop and constrained viewports.

---

## Phase 5: User Story 3 - Understand Preview Freshness (Priority: P3)

**Goal**: Communicate whether the preview reflects saved content, unsaved edits, refresh progress, or a recoverable render problem.

**Independent Test**: Edit without saving and confirm the interface indicates the preview may not include unsaved edits; save and confirm the preview status returns to current; simulate failure and confirm editing remains possible.

### Validation Coverage for User Story 3

- [X] T024 [P] [US3] Add a Playwright freshness test that edits without saving and expects visible stale or waiting-for-save preview status in `surface/e2e/surface.e2e.ts`
- [X] T025 [P] [US3] Add a Playwright failure-state test that simulates save or render failure and expects recoverable status while source editing and Save remain available in `surface/e2e/surface.e2e.ts`

### Implementation for User Story 3

- [X] T026 [US3] Add visible split-preview freshness text for saved, stale, refreshed, and save-failure states in `surface/src/components/editor/EditorPane.svelte`
- [X] T027 [US3] Expose preview freshness updates through the existing polite live-region/status pattern without relying on color alone in `surface/src/components/editor/EditorPane.svelte`
- [X] T028 [US3] Transition preview freshness to stale on CodeMirror document changes and back to refreshed only after successful preview refresh from saved content in `surface/src/components/editor/EditorPane.svelte`
- [X] T029 [US3] Show recoverable preview-render-failure copy when renderer failure is reported while preserving editor interaction and save controls in `surface/src/components/reading/ReadingPane.svelte`
- [X] T030 [US3] Document status communication and render failure accessibility evidence in `docs/accessibility/working-docs.md`

**Checkpoint**: All user stories are independently functional and preview status is understandable before and after save.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, documentation, accessibility, language, and regression checks across all stories.

- [X] T031 [P] Run `cd surface && bun run check` and record the result for Surface editor changes in `docs/accessibility/working-docs.md`
- [X] T032 [P] Run `cd surface && bun run test:unit -- --run` if unit tests exist or are added, and record any skipped rationale in `specs/014-doc-preview-pane/quickstart.md`
- [X] T033 Run `cd surface && bun run test:e2e` and record browser availability, pass/fail result, and any residual e2e risk in `docs/accessibility/working-docs.md`
- [X] T034 Run `just check` from the repository root and record final validation status for the feature in `specs/014-doc-preview-pane/quickstart.md`
- [X] T035 [P] Confirm no spine route, migration, auth, or API contract files were changed beyond the Surface-only scope documented in `specs/014-doc-preview-pane/plan.md`
- [X] T036 [P] Confirm all new user-facing preview copy is concise English-only UI text and document bilingual delivery as not applicable in `docs/accessibility/working-docs.md`
- [X] T037 Review final task completion against WCAG 2.2 AA keyboard operation, focus visibility, status communication, reflow, and contrast requirements in `docs/accessibility/working-docs.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion; blocks user story implementation.
- **User Story 1 (Phase 3)**: Depends on Foundational; delivers MVP preview rendering and save refresh.
- **User Story 2 (Phase 4)**: Depends on Foundational and can proceed after the US1 Split action exists; validates responsive usability.
- **User Story 3 (Phase 5)**: Depends on Foundational and integrates with US1 split-preview rendering; validates freshness communication.
- **Polish (Phase 6)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Start after Foundational; no dependency on US2 or US3.
- **User Story 2 (P2)**: Start after Foundational and after the Split preview action from US1 is available; independently validates constrained layout.
- **User Story 3 (P3)**: Start after Foundational and after Split preview behavior from US1 is available; independently validates status and freshness behavior.

### Within Each User Story

- Add focused validation coverage before or alongside implementation where feasible.
- Implement core editor/renderer changes before running story-specific Playwright assertions.
- Complete each checkpoint before moving to the next priority story.

### Parallel Opportunities

- T002, T003, and T004 can run in parallel with T001.
- T009 and T010 can run in parallel once Foundational tasks are complete.
- T017 and T018 can run in parallel once the Split preview action exists.
- T024 and T025 can run in parallel once freshness states are wired.
- T031, T032, T035, and T036 can run in parallel during final polish.

---

## Parallel Example: User Story 1

```bash
Task: "Add a Playwright smoke test that stubs /api/working/:slug, opens a working document, uses Split, and expects source and preview regions with markdown rendering in surface/e2e/surface.e2e.ts"
Task: "Add a Playwright save-refresh assertion that edits markdown, fulfills the PUT save, and expects the preview to show the saved rendered result in surface/e2e/surface.e2e.ts"
```

## Parallel Example: User Story 2

```bash
Task: "Add a Playwright narrow-viewport test that confirms Back, Split, Save, Delete, Vim toggle, and source editor remain reachable without horizontal document overflow in surface/e2e/surface.e2e.ts"
Task: "Add a Playwright keyboard-navigation test for Back, editor, preview status or links, Save, Delete, and Vim toggle with no focus trap in surface/e2e/surface.e2e.ts"
```

## Parallel Example: User Story 3

```bash
Task: "Add a Playwright freshness test that edits without saving and expects visible stale or waiting-for-save preview status in surface/e2e/surface.e2e.ts"
Task: "Add a Playwright failure-state test that simulates save or render failure and expects recoverable status while source editing and Save remain available in surface/e2e/surface.e2e.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational split-preview status and renderer support.
3. Complete Phase 3: User Story 1.
4. Stop and validate desktop workbench split preview, save refresh, and common markdown rendering.
5. Demo or merge MVP only if responsive and freshness scope is intentionally deferred.

### Incremental Delivery

1. Complete Setup and Foundational tasks to avoid API/storage changes.
2. Add User Story 1 for saved-content split preview and validate independently.
3. Add User Story 2 for narrow layout and keyboard usability, then validate independently.
4. Add User Story 3 for freshness and recoverable failure communication, then validate independently.
5. Finish Polish checks and accessibility evidence before merge.

### Parallel Team Strategy

1. One developer handles `surface/src/components/editor/EditorPane.svelte` state and layout changes.
2. One developer handles `surface/e2e/surface.e2e.ts` focused browser coverage.
3. One developer handles `surface/src/components/reading/MarkdownRenderer.svelte`, `surface/src/components/reading/ReadingPane.svelte` overflow/error support, and `docs/accessibility/working-docs.md` evidence.

---

## Notes

- [P] tasks use different files or independent validation work.
- [US1], [US2], and [US3] labels map to the prioritized user stories in `specs/014-doc-preview-pane/spec.md`.
- Keep implementation Surface-only; do not add spine endpoints, storage changes, migrations, auth changes, or new runtime dependencies.
- Preserve sanitized markdown rendering through `MarkdownRenderer.svelte` and never mutate source markdown during preview rendering.
- Accessibility and language review are explicit tasks: WCAG 2.2 AA evidence is required; bilingual delivery is documented as not applicable.
