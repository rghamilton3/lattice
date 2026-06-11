# Modification Spec: Full CRUD Lifecycle for Tasks and Working Docs

**Original Feature**: [006-tasks-triage](../../spec.md)
**Modification ID**: 006-mod-001
**Branch**: `006-mod-001-full-crud`
**Created**: 2026-06-09
**Status**: Draft

## Input
User description: "tasks and working docs need a full CRUD lifecycle"

## Why Modify?

Tasks were missing two of the four standard CRUD operations:

- **No delete**: A user who creates a task by mistake, or whose work is superseded, has no way to remove it. The only removal path is completing the task, which is semantically wrong and pollutes the completed list.
- **No text edit**: Task text is immutable after creation. Only metadata (due date, priority, notes) can be changed. Users who mistype task text or want to refine the wording must delete and recreate.

Working docs already support the full lifecycle (create, read, update content, delete) and are not changed by this modification. The slug-rename gap is tracked separately as a GitHub issue.

---

## What's Changing?

### Added

- `DELETE /api/tasks/:id` endpoint in spine that hard-deletes the capture row, its on-disk capture file, and any associated `capture_attachments` rows + binary files + index `.md` files, then refreshes the search index.
- `deleteCaptureFile(id)` export in `spine/src/search.ts` to encapsulate capture file removal (mirrors the `deleteWorkingAttachmentIndex` pattern already present).
- `deleteTask(id)` function in `surface/src/lib/api/tasks.ts`.
- Delete button in the expanded task row in `surface/src/components/tasks/TasksView.svelte`, gated behind `window.confirm`.
- Text field in the expanded task row edit panel in `TasksView.svelte`, allowing users to update the task text inline.

### Modified

- `PATCH /api/captures/:id/task` body schema extended to accept an optional `text` field. When `text` is provided it is validated (non-empty after trim, max 10 000 chars), the `captures.text` column is updated, and `writeCaptureFile` is called to rewrite the on-disk `.md` and refresh the index.
- `updateTaskMeta` params in `surface/src/lib/api/tasks.ts` extended to include an optional `text` field.
- Expanded task edit panel in `TasksView.svelte` gains a text `<textarea>` above the existing due-date / priority / notes fields.

### Removed

None.

### Unchanged (Important to Document)

- Working docs feature (004) is CRUD-complete and receives no changes.
- All existing task routes (`GET /api/tasks`, `GET /api/tasks/done`, `POST /api/tasks`, `PATCH /api/tasks/:id/complete`, `PATCH /api/tasks/:id/uncomplete`) remain unchanged.
- Triage flow (process captures into keep/archive/promote/task/skip) is unchanged.
- No database schema migrations are required.
- Authentik auth boundary and existing error handling patterns are unchanged.

---

## Impact Analysis

See `impact-analysis.md` in this directory.

### Files Affected

**Modified**:
- `spine/src/search.ts` - add `deleteCaptureFile` export
- `spine/src/routes/tasks.ts` - add DELETE route; extend PATCH body
- `surface/src/lib/api/tasks.ts` - add `deleteTask`; extend `UpdateTaskMetaParams`
- `surface/src/components/tasks/TasksView.svelte` - delete button + text edit field

**New Tests**:
- `spine/tests/` - DELETE and text-PATCH route coverage

---

## Backward Compatibility

**Breaking Changes**: No

The DELETE endpoint is new (no existing client calls it). The PATCH extension uses an optional field; callers that omit `text` continue to work as before.

**Compatibility Checklist**:
- [x] Existing API contracts unchanged OR properly versioned
- [x] Existing data readable by new code
- [x] No forced migration for existing users
- [x] Deprecation warnings not needed (no removal)

---

## Updated User Scenarios

### New Scenario: Delete a Task

**Given** an active or completed task exists that is no longer needed, **When** the user opens the task's edit panel and confirms deletion, **Then** the task is permanently removed from both the active and completed lists and cannot be recovered.

**Acceptance Scenarios**:
1. **Given** an active task exists, **When** the user expands the task and clicks Delete and confirms, **Then** the task disappears from the active list immediately and the DELETE call returns success.
2. **Given** a completed task is shown, **When** the user restores it to active and then deletes it, **Then** it is gone from both lists.
3. **Given** the user clicks Delete but cancels the confirmation, **Then** the task remains unchanged.
4. **Given** a DELETE request is made for a missing or non-task id, **Then** a 404 is returned.

### New Scenario: Edit Task Text

**Given** an active task exists with text that needs correction, **When** the user opens the task's edit panel, changes the text field, and saves, **Then** the task text is updated in the list and in the search index.

**Acceptance Scenarios**:
1. **Given** an active task is open for editing, **When** the user changes the text to a non-empty string within the length limit and saves, **Then** the task row reflects the new text.
2. **Given** the user clears the text field, **When** they attempt to save, **Then** a validation error prevents the save and the task text is unchanged.
3. **Given** the user enters text over 10 000 characters, **When** they attempt to save, **Then** a validation error is returned.

---

## Updated Requirements

### New Requirements

- **FR-NEW-001**: Authenticated users MUST be able to permanently delete any task (active or completed), which removes the capture row, its on-disk file, and any associated attachments.
- **FR-NEW-002**: Authenticated users MUST be able to update the text of an active task; the system MUST apply the same validation rules as task creation (non-empty, max 10 000 chars).
- **FR-NEW-003**: The delete action MUST require an explicit confirmation step before the capture is removed.
- **FR-NEW-004**: The search index MUST be refreshed after a task deletion or text update to reflect the change in subsequent searches.

---

## Testing Strategy

### New Tests

- `spine/tests/`: `DELETE /api/tasks/:id` - success (row + file removed), not-found (404), non-task id (404)
- `spine/tests/`: `PATCH /api/captures/:id/task` with `text` - success (text updated, file rewritten), empty text (422), over-length text (422)
- UI: delete button is present in expanded task row; `confirm` fires before request; task disappears from list on success
- UI: text field is present in expanded task edit panel; saves correctly; validation shown on empty/over-long text

---

## Constitution Compliance

- [x] **Specification-First**: Modification spec complete before coding
- [x] **Minimal Complexity**: No unnecessary features added beyond requirement
- [ ] **TDD**: Tests updated/added before implementation (pending)
- [x] **Progressive Enhancement**: Builds on stable foundation
- [x] **Clear Boundaries**: Spine handles delete cascade; surface handles confirmation

---

## Rollout Strategy

**Phased Rollout**: No - both changes are additive and low-risk, deploy together.

**Rollback Plan**: Remove the DELETE route and `text` PATCH field from tasks.ts; revert TasksView.svelte and the API client. No data migration required for rollback.

---

## Verification Checklist

- [x] Impact analysis reviewed and accurate
- [x] Backward compatibility assessed
- [x] Migration path documented (N/A - no breaking changes)
- [x] All modified scenarios documented
- [x] Test strategy defined
- [x] Original spec cross-referenced
- [x] Constitution compliance verified

---
*Modification spec created using `/ss:modify` workflow*
