# Tasks: Capture Inbox

**Input**: Design documents from `/specs/002-capture-inbox/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/captures.md, quickstart.md

**Tests**: Included because the spec defines independent tests and the plan requires targeted route and surface validation.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm existing capture inbox files and feature docs are in place.

- [X] T001 Verify active feature pointer references `specs/002-capture-inbox` in `.specify/feature.json`
- [X] T002 Review current capture-related implementation in `spine/src/routes/captures.ts`, `spine/src/captureEvents.ts`, `surface/src/lib/api/captures.ts`, `surface/src/components/home/HomeView.svelte`, `surface/src/components/home/InboxList.svelte`, and `surface/src/components/overlays/QuickCapture.svelte`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared validation and contract boundaries needed before story work.

**CRITICAL**: No user story work can begin until this phase is complete.

- [X] T003 Confirm `spine/migrations/001_captures.sql` defines the local-first capture persistence shape required by `specs/002-capture-inbox/data-model.md`
- [X] T004 [P] Confirm capture route registration remains inside the Authentik-protected guard in `spine/src/app.ts`
- [X] T005 [P] Add or confirm typed capture API request/response shapes in `surface/src/lib/api/captures.ts` match `specs/002-capture-inbox/contracts/captures.md`

**Checkpoint**: Foundation ready - user story implementation can now begin.

---

## Phase 3: User Story 1 - Save A Quick Capture (Priority: P1) MVP

**Goal**: Users can save a non-empty quick capture, reject invalid drafts, and keep draft text after failures.

**Independent Test**: Submit valid, empty, whitespace-only, and over-10,000-character captures and confirm only valid captures are persisted and shown with clear state text.

### Tests for User Story 1

- [X] T006 [P] [US1] Add route tests for trimming whitespace-only text and rejecting over-10,000-character text in `spine/tests/routes/captures.test.ts`
- [X] T007 [P] [US1] Add create-capture API validation coverage or type assertions in `surface/src/lib/api/captures.ts` if needed for the 10,000-character limit

### Implementation for User Story 1

- [X] T008 [US1] Enforce trim-aware non-empty text, trim-aware non-empty source, and 10,000-character text limit in `spine/src/routes/captures.ts`
- [X] T009 [US1] Preserve server-generated timestamps and successful capture response shape in `spine/src/routes/captures.ts`
- [X] T010 [US1] Add quick capture draft length validation and visible over-limit text in `surface/src/components/overlays/QuickCapture.svelte`
- [X] T011 [US1] Ensure failed save leaves the draft available and communicates failure in `surface/src/components/overlays/QuickCapture.svelte`

**Checkpoint**: User Story 1 is functional and independently testable.

---

## Phase 4: User Story 2 - Browse Recent Captures (Priority: P2)

**Goal**: Users can browse recent inbox captures newest-first and understand loading, empty, error, and populated states.

**Independent Test**: Seed multiple captures, open the inbox, and verify ordering, empty state, and row usability without relying on live updates.

### Tests for User Story 2

- [X] T012 [P] [US2] Confirm or extend newest-first, empty-state, default limit, and cursor tests in `spine/tests/routes/captures.test.ts`

### Implementation for User Story 2

- [X] T013 [US2] Confirm default recent inbox filtering and stable newest-first ordering in `spine/src/routes/captures.ts`
- [X] T014 [US2] Confirm `fetchCaptures(50)` and pagination contract compatibility in `surface/src/lib/api/captures.ts`
- [X] T015 [US2] Improve visible loading, empty, and error state language for the inbox in `surface/src/components/home/HomeView.svelte` and `surface/src/components/home/InboxList.svelte`
- [X] T016 [US2] Confirm capture rows are keyboard reachable and activatable in `surface/src/components/home/InboxList.svelte`

**Checkpoint**: User Stories 1 and 2 both work independently.

---

## Phase 5: User Story 3 - See Live Capture Updates (Priority: P3)

**Goal**: Open inbox views receive new same-instance captures without a full reload and remain usable after stream interruption.

**Independent Test**: Open the stream, create a capture, verify a capture event arrives, and confirm UI deduplicates events and handles disconnect textually.

### Tests for User Story 3

- [X] T017 [P] [US3] Confirm or extend SSE listener lifecycle and capture event tests in `spine/tests/routes/captures.test.ts`

### Implementation for User Story 3

- [X] T018 [US3] Confirm process-local listener registration, cleanup, and capture event emission in `spine/src/captureEvents.ts` and `spine/src/routes/captures.ts`
- [X] T019 [US3] Confirm `HomeView.svelte` deduplicates live capture events and updates `captureKeys.list(20)` without full reload in `surface/src/components/home/HomeView.svelte`
- [X] T020 [US3] Ensure live update disconnection is communicated with visible text or toast and does not remove existing captures in `surface/src/components/home/HomeView.svelte`

**Checkpoint**: All user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verification, accessibility evidence, and queue hygiene.

- [X] T021 [P] Update WCAG 2.2 AA verification notes in `docs/accessibility/capture-inbox.md`
- [X] T022 Run `cd spine && bun test tests/routes/captures.test.ts` and fix capture route regressions
- [X] T023 Run `cd surface && bun run check` and fix surface type or Svelte validation regressions
- [X] T024 Run quickstart validation steps from `specs/002-capture-inbox/quickstart.md`
- [X] T025 Mark capture inbox queue completion metadata in `.specify/extensions/time-machine/features-queue.yml`

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup (Phase 1): No dependencies.
- Foundational (Phase 2): Depends on setup and blocks all user stories.
- User Story 1 (Phase 3): Depends on foundational work and is the MVP.
- User Story 2 (Phase 4): Depends on foundational work; can be validated independently after capture data exists.
- User Story 3 (Phase 5): Depends on create-capture behavior from US1 for useful end-to-end verification.
- Polish (Phase 6): Depends on all desired user stories being complete.

### User Story Dependencies

- US1 Save A Quick Capture: No dependencies beyond foundation.
- US2 Browse Recent Captures: No dependency on live updates; uses persisted capture rows.
- US3 See Live Capture Updates: Depends on successful capture creation to emit meaningful events.

### Parallel Opportunities

- T004 and T005 can run in parallel.
- T006 and T007 can run in parallel before US1 implementation.
- T012 can run in parallel with UI state review if another worker owns surface files.
- T017 can run in parallel with surface live-update review after US1 create behavior is stable.
- T021 can run in parallel with final command verification once UI behavior is stable.

---

## Parallel Example: User Story 1

```bash
Task: "Add route tests for trimming whitespace-only text and rejecting over-10,000-character text in spine/tests/routes/captures.test.ts"
Task: "Add create-capture API validation coverage or type assertions in surface/src/lib/api/captures.ts if needed for the 10,000-character limit"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete setup and foundational verification.
2. Add failing route validation tests for empty/whitespace/over-limit captures.
3. Implement server-side validation.
4. Add surface quick capture length feedback and draft preservation.
5. Validate US1 independently.

### Incremental Delivery

1. US1: capture creation and invalid draft handling.
2. US2: recent inbox browse states and ordering.
3. US3: live event stream and recovery behavior.
4. Polish: accessibility evidence and command verification.

## Notes

- Keep work inside the listed capture inbox files unless verification reveals a direct dependency.
- Do not add new runtime dependencies.
- Do not implement triage, search indexing, tasks, or attachment scope unless preserving existing behavior requires it.
