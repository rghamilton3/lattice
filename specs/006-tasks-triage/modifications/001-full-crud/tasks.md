# Tasks: Full CRUD Lifecycle for Tasks - 006-mod-001

**Input**: Design documents from `specs/006-tasks-triage/modifications/001-full-crud/`

**Prerequisites**: `plan.md`, `modification-spec.md`, `contracts/tasks-crud.md`, `data-model.md`

**Tests**: Required per modification spec. Spine route tests are in `spine/tests/`. Surface UI verification is manual or via e2e.

**Organization**: Tasks are grouped by layer (spine, surface) and ordered by dependency.

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel - touches different files with no incomplete dependency

---

## Phase 1: Spine - Utility

**Purpose**: Add the `deleteCaptureFile` export needed by the DELETE route.

- [x] T001 Add `deleteCaptureFile(id: number): void` export to `spine/src/search.ts` alongside `writeCaptureFile`; it should call `unlinkSync` on `join(capturesDir(), '${id}.md')` if the file exists (mirrors `deleteWorkingAttachmentIndex` pattern)

**Checkpoint**: `spine/src/search.ts` exports `deleteCaptureFile`.

---

## Phase 2: Spine - Routes

**Purpose**: Add DELETE endpoint and extend PATCH text support in `spine/src/routes/tasks.ts`.

- [x] T002 Add `DELETE /api/tasks/:id` route to `spine/src/routes/tasks.ts`:
  - Parse and validate `id`; return 400 on NaN
  - Fetch `capture_attachments` rows for `capture_id = id` (id + stored_path columns)
  - DELETE the `captures` row WHERE `id = ? AND triage_action = 'task'` RETURNING id; return 404 if null
  - For each attachment: attempt to `unlinkSync` the binary at `join(attachmentsDir, att.stored_path)` and `unlinkSync` the index `.md` at `join(attachmentsMdDir(), '${att.id}.md')` (catch and warn on each)
  - Call `deleteCaptureFile(id)` and `refreshIndex()`
  - Import `deleteCaptureFile` and `attachmentsMdDir` from `../search`
  - The route requires `attachmentsDir` - thread it through from the route factory param (already available at module scope via closure)

- [x] T003 Extend `PATCH /api/captures/:id/task` in `spine/src/routes/tasks.ts` to accept an optional `text` field:
  - Add `text: t.Optional(t.String())` to the body schema
  - When `body.text` is provided: trim it; return 422 "Task text is required" if empty; return 422 "Task text must be 10,000 characters or fewer" if over `MAX_TASK_TEXT_LENGTH`
  - Build the UPDATE to set `text = COALESCE(?, text)` so the column is only changed when a non-null value is passed
  - RETURNING must include `text` and `captured_at` so the handler can call `writeCaptureFile` after the UPDATE
  - Call `writeCaptureFile(id, result.text, 'task', result.captured_at)` and `refreshIndex()` only when `body.text` was provided and the update succeeded

**Checkpoint**: `just test` passes; DELETE removes the row and returns `{}`; PATCH with `text` updates the row and disk file.

---

## Phase 3: Spine - Tests

**Purpose**: Cover the new DELETE path and extended PATCH path.

- [x] T004 [P] Add spine tests for `DELETE /api/tasks/:id`:
  - Test file: whichever test file covers tasks routes (e.g. `spine/tests/unit/` or `spine/tests/routes/`)
  - Success: seed a task capture, DELETE it, confirm row is gone and the `.md` file is absent
  - Not found: DELETE with a valid integer that has no task row returns 404
  - Invalid id: DELETE with a non-integer id returns 400
  - Non-task row: DELETE an id that exists in captures but with a different `triage_action` returns 404

- [x] T005 [P] Add spine tests for the `text` field in `PATCH /api/captures/:id/task`:
  - Success: PATCH with a valid `text` field updates `captures.text` and rewrites the on-disk `.md`
  - Empty text: PATCH with `text: ""` returns 422
  - Over-length text: PATCH with a 10 001-character string returns 422
  - Omitting `text`: existing behavior is unchanged (backward-compat regression)

**Checkpoint**: `just test` passes with new tests green.

---

## Phase 4: Surface - API Client

**Purpose**: Add `deleteTask` and extend `updateTaskMeta` in `surface/src/lib/api/tasks.ts`.

- [x] T006 Add `deleteTask(id: number): Promise<void>` to `surface/src/lib/api/tasks.ts` - calls `apiFetch('/api/tasks/${id}', { method: 'DELETE' })`

- [x] T007 Extend `UpdateTaskMetaParams` in `surface/src/lib/api/tasks.ts` to include `text?: string`

**Checkpoint**: `just check` passes (tsc --noEmit sees the new export and param).

---

## Phase 5: Surface - UI

**Purpose**: Add delete button and text edit field to the task inline edit panel in `surface/src/components/tasks/TasksView.svelte`.

- [x] T008 Add `editText = $state('')` and `deleting = $state(false)` state variables alongside existing edit state

- [x] T009 Initialize `editText = task.text` inside the `expand(task)` function

- [x] T010 Add a `<textarea>` for task text at the top of the `task-edit` div (above the due-date row), bound to `editText`, with label "Text", placeholder "task text…", `rows="2"`. Apply the same Escape-to-cancel and Ctrl+Enter-to-save keydown handlers as the notes textarea.

- [x] T011 Pass `text: editText` to `updateTaskMeta` in `saveEdit(task)` only when `editText !== task.text` (avoid a no-op write when only metadata changed); show "Task text is required" toast on 422 and keep the panel open

- [x] T012 Add `destroyTask(task: Task)` async function:
  - `window.confirm` prompt before proceeding
  - Optimistic removal from `taskKeys.list()` query cache (and `taskKeys.done()` if the task is completed)
  - Call `deleteTask(task.id)`
  - On success: `invalidateQueries` for both lists, collapse the expanded row, `wb.showToast('Task deleted')`
  - On error: rollback optimistic update via `invalidateQueries`, `wb.showToast('Delete failed')`

- [x] T013 Add a Delete button to `task-edit-actions` (left side, separate from save/cancel):
  - Use `btn btn-ghost btn-mini` with destructive color (`color: var(--c-alarm)`)
  - `aria-label="Delete task: {task.text}"`
  - `disabled={deleting || saving}`
  - `onclick={() => destroyTask(task)}`

- [x] T014 Import `deleteTask` from `$lib/api/tasks` in the script block

**Checkpoint**: Dev server starts (`just dev`), a task can be created, its text edited and saved, and it can be deleted with a confirm dialog. No TypeScript errors in `just check`.

---

## Phase 6: Polish

- [x] T015 Run `just lint` and `just check` from the repo root and fix any issues in the modified files
- [x] T016 Run `just test` and confirm all spine tests pass
- [ ] T017 Manually verify in the running app:
  - Create a task, expand it, edit the text, save - text updates in the list
  - Delete an active task via the delete button - it disappears from the list
  - Cancel the confirm dialog - task is unchanged
  - Check that omitting text in the edit panel (clicking save with only metadata changes) still works

---

## Dependencies & Execution Order

- **Phase 1** has no dependencies; do it first to unblock T002.
- **Phase 2** depends on Phase 1 (T002 uses `deleteCaptureFile`). T003 is independent of T002 but both are in the same file.
- **Phase 3** (T004, T005) can start in parallel once Phase 2 is complete; they are independent of each other.
- **Phase 4** is independent of Phases 2-3 and can start after the contract is defined (T006, T007 are independent).
- **Phase 5** depends on Phase 4 (needs `deleteTask` import and extended params).
- **Phase 6** runs last.

## Scope Guardrails

- Do not add a soft-delete column or trash UI.
- Do not change the capture schema or add a migration.
- Do not add a new overlay/modal component; use `window.confirm` for delete confirmation.
- Do not change any working-doc routes or UI.
- Do not change any triage or process-flow routes.
