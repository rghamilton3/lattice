# Impact Analysis: Full CRUD Lifecycle for Tasks

**Original Feature**: [006-tasks-triage](../../spec.md)
**Modification ID**: 006-mod-001
**Analysis Date**: 2026-06-09

---

## Proposed Changes

Add the two CRUD operations currently missing from the tasks feature:

1. **Hard-delete a task** - `DELETE /api/tasks/:id` removes the capture row, on-disk capture file, any capture attachments (rows + binary files + index files), and refreshes the search index.
2. **Edit task text** - extend `PATCH /api/captures/:id/task` to accept an optional `text` field, applying the same validation as task creation (non-empty, max 10 000 chars), and rewriting the on-disk capture file to keep search in sync.

Working docs are already CRUD-complete: `POST /api/working` (create), `GET /api/working` and `GET /api/working/:slug` (read), `PUT /api/working/:slug` (update content + displayed title via H1 heading), `DELETE /api/working/:slug` (delete). No working-doc changes are in scope for this modification.

---

## Affected Components

### Direct Dependencies

| Component | Type | Impact | Notes |
|-----------|------|--------|-------|
| `spine/src/routes/tasks.ts` | API route | High | Add DELETE endpoint; extend PATCH body to accept `text` |
| `spine/src/search.ts` | Utility | Medium | Export `deleteCaptureFile`; `writeCaptureFile` already handles text update |
| `surface/src/lib/api/tasks.ts` | API client | Medium | Add `deleteTask`; extend `updateTaskMeta` params to include `text` |
| `surface/src/components/tasks/TasksView.svelte` | UI | High | Add Delete button + confirmation in expanded task row; add text field to inline edit |
| `spine/tests/` | Tests | Medium | New test coverage for DELETE and text-edit PATCH paths |

### Indirect Dependencies

| Component | Type | Impact | Notes |
|-----------|------|--------|-------|
| `spine/src/routes/attachments.ts` | API route | Low | Attachment binary cleanup on task delete must not conflict with existing attachment delete route |
| Search index (`captures/` dir) | File system | Low | Delete and text-update both rewrite the index; `refreshIndex()` handles this |
| `capture_attachments` table | Database | Low | Must DELETE attachment rows and their binary files before deleting capture row |

---

## Breaking Changes Assessment

**Breaking Changes Identified**: No

Both changes are additive:
- A new `DELETE /api/tasks/:id` endpoint does not change existing routes.
- Adding an optional `text` field to the PATCH body is backward-compatible; existing callers omitting `text` continue to work unchanged.

---

## Backward Compatibility Strategy

Both changes are purely additive. No compatibility layer or migration is required. Existing clients that do not send `text` in the PATCH body continue to work as before.

---

## Migration Requirements

### Data Migration
None required. The capture schema already supports deletion via standard SQL. No column additions are needed for text editing (the `text` column already exists).

### Code Migration
None required for existing callers.

---

## Risk Assessment

**Risk Level**: Low

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Orphaned attachment binary files on task delete | Low | Medium | Fetch all `capture_attachments` rows for the task, delete binary files + index `.md` files before deleting the DB row |
| Accidental delete from double-click | Low | Medium | Require `window.confirm` in the UI before firing the DELETE request |
| Text update not reflected in search | Low | Low | `writeCaptureFile` overwrites the on-disk `.md` and `refreshIndex()` is called after; same pattern as task creation |
| Deleting a task that has already been completed (edge case) | Low | Low | DELETE must work on any `triage_action = 'task'` row regardless of `task_completed_at` |

---

## Testing Requirements

### New Tests Required
- `spine/tests/`: DELETE /api/tasks/:id returns 204/200 and removes the row + file
- `spine/tests/`: DELETE /api/tasks/:id on a missing or non-task capture returns 404
- `spine/tests/`: DELETE /api/tasks/:id cleans up `capture_attachments` rows
- `spine/tests/`: PATCH /api/captures/:id/task with `text` field updates text and on-disk file
- `spine/tests/`: PATCH with empty or too-long `text` returns 422
- UI: Delete button present in expanded task row; `confirm` dialog fires before request

---

## Timeline Estimate

| Phase | Duration |
|-------|----------|
| Spine: add `deleteCaptureFile` export and DELETE route | ~1h |
| Spine: extend PATCH to accept text | ~30m |
| Surface: API client additions | ~20m |
| Surface: TasksView.svelte UI changes | ~1h |
| Tests | ~1h |
| **Total** | **~3.5h** |

---

## Recommendations

1. Export `deleteCaptureFile` from `search.ts` (mirrors `deleteWorkingAttachmentIndex` pattern already there) to keep attachment cleanup logic centralized.
2. Reuse the existing `writeCaptureFile` call inside the PATCH text handler - no new file-write helper is needed.
3. Use `window.confirm` as the delete confirmation mechanism (consistent with the working-doc delete in `EditorPane.svelte`).
4. Track slug-rename for working docs as a separate GitHub issue (created alongside this modification).

**Proceed with Modification**: Yes
