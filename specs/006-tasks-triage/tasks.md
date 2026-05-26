# Tasks: Tasks And Triage

**Input**: Design documents from `specs/006-tasks-triage/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/tasks-triage.md`, `quickstart.md`

## Phase 1: Setup

- [X] T001 Review existing triage, command, and task persistence behavior in `spine/src/routes/captures.ts`, `spine/src/routes/tasks.ts`, `spine/src/commands.ts`, and task/triage migrations
- [X] T002 Review existing process and task UI behavior in `surface/src/components/process/ProcessMode.svelte`, `surface/src/components/tasks/TasksView.svelte`, `surface/src/components/overlays/NewTask.svelte`, and `surface/src/lib/state/useCompleteTask.svelte.ts`

## Phase 2: Foundational

- [X] T003 [P] Add route test coverage scaffold for task list/create/update/complete/restore behavior in `spine/tests/routes/tasks.test.ts`
- [X] T004 [P] Add command parser edge case coverage in `spine/tests/unit/commands.test.ts`
- [X] T005 [P] Inspect current task UI accessible names, status/error messaging, and duplicate-submit guards in surface components

## Phase 3: User Story 1 - Process Capture Inbox (P1)

**Goal**: Users can process captures into keep, archive, promote, task, or skip outcomes and safely exit a process session.

**Independent Test**: Seed untriaged captures, choose each outcome, exit the process flow, and verify triage metadata plus inbox refresh behavior.

- [X] T006 [P] [US1] Add capture triage tests for all supported actions and invalid actions in `spine/tests/routes/captures.test.ts`
- [X] T007 [US1] Ensure capture triage route validates ids/actions and persists triage timestamps in `spine/src/routes/captures.ts`
- [X] T008 [US1] Improve process-mode loading/error/status semantics and keyboard labels in `surface/src/components/process/ProcessMode.svelte`
- [X] T009 [US1] Ensure process-mode exit refreshes inbox and task lists after decisions in `surface/src/lib/state/workbench.svelte.ts` and `surface/src/components/process/ProcessMode.svelte`

## Phase 4: User Story 2 - Create And Manage Active Tasks (P2)

**Goal**: Users can create direct tasks, view active task ordering, edit metadata, and mark tasks complete.

**Independent Test**: Create tasks with varied due dates/priorities, update metadata, complete one, and verify active list ordering and cache state.

- [X] T010 [P] [US2] Add task route tests for direct create validation, active ordering, metadata updates, and completion in `spine/tests/routes/tasks.test.ts`
- [X] T011 [US2] Harden task create/update/complete route validation and deterministic active sorting in `spine/src/routes/tasks.ts`
- [X] T012 [US2] Add duplicate-submit guards and accessible status/error feedback for new-task creation in `surface/src/components/overlays/NewTask.svelte`
- [X] T013 [US2] Add accessible active-task loading/error/edit/save/complete status behavior in `surface/src/components/tasks/TasksView.svelte`
- [X] T014 [US2] Improve optimistic completion cache recovery and list invalidation in `surface/src/lib/state/useCompleteTask.svelte.ts`
- [X] T015 [US2] Improve home task preview status/error semantics in `surface/src/components/home/HomeView.svelte`

## Phase 5: User Story 3 - Review And Restore Completed Tasks (P3)

**Goal**: Users can review completed tasks newest-first and restore completed work to active status.

**Independent Test**: Complete tasks, view completed history, restore one, and verify metadata is preserved and active/completed lists update.

- [X] T016 [P] [US3] Add task route tests for completed newest-first ordering, restore behavior, and missing/non-task errors in `spine/tests/routes/tasks.test.ts`
- [X] T017 [US3] Ensure completed/restored task route behavior preserves metadata in `spine/src/routes/tasks.ts`
- [X] T018 [US3] Add accessible completed-section toggle, restore labels, and restore status/error feedback in `surface/src/components/tasks/TasksView.svelte`

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T019 [P] Document WCAG 2.2 AA evidence and bilingual N/A rationale in `docs/accessibility/tasks-triage.md`
- [X] T020 Run `cd spine && bun test tests/unit/commands.test.ts tests/routes/captures.test.ts tests/routes/tasks.test.ts`
- [X] T021 Run `cd surface && bun run check`
- [ ] T022 Mark completed tasks in `specs/006-tasks-triage/tasks.md` after verification and queue metadata updates

## Dependencies

- Phase 1 must complete before Phase 2.
- Phase 2 must complete before user-story implementation.
- US1 is the MVP and should complete before US2 and US3.
- US2 should complete before US3 because completed-task review depends on task creation and completion.
- Polish tasks run after all selected user stories are implemented.

## Parallel Examples

- Foundational: T003, T004, and T005 can proceed in parallel.
- US1: T006 can be written before T007 while T008 is reviewed independently.
- US2: T010 can be written before T011 while T012/T013/T015 target separate UI files.
- US3: T016 can be written before T017 while T018 targets surface UI.
- Polish: T019 can be drafted while verification commands T020 and T021 run.

## Implementation Strategy

1. Complete setup/foundational review.
2. Deliver US1 process-mode persistence and accessible feedback.
3. Add robust active task route/UI behavior for US2.
4. Add completed task review/restore coverage and UI feedback for US3.
5. Finish accessibility evidence and run targeted spine/surface checks.
