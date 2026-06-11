# Plan: Tasks Full CRUD - 006-mod-001

**Created**: 2026-06-09

## Overview

Two additive changes to the tasks feature, implemented in four files with no schema migration required.

---

## Design Decisions

### Task delete: hard delete vs. soft delete
**Decision**: Hard delete (remove the row, file, and attachments permanently).
**Rationale**: Confirmed by user. Matches the working-doc delete pattern. Soft delete would require a new schema column and a separate "trash" UI, adding scope with little benefit in a single-user PKM tool.

### Text edit: extend PATCH vs. new endpoint
**Decision**: Extend the existing `PATCH /api/captures/:id/task` body to accept an optional `text` field.
**Rationale**: All task metadata updates route through the same endpoint. Adding `text` as an optional field is backward-compatible and keeps the route structure flat.

### Attachment cleanup on delete
**Decision**: Inline the attachment cleanup in the DELETE route handler, mirroring the working-doc attachment delete pattern in `working.ts`.
**Rationale**: No shared cleanup helper exists for capture attachments. The attachment route handler in `attachments.ts` is per-attachment, not per-capture. A single transaction for row deletion plus a post-transaction file/index cleanup is the established pattern.

### Confirmation UX
**Decision**: `window.confirm` before firing the DELETE request.
**Rationale**: Consistent with `EditorPane.svelte`'s working-doc delete. Avoids introducing a custom modal component for this modification.

---

## Implementation Plan

### Step 1: Export `deleteCaptureFile` from `spine/src/search.ts`

Add alongside the existing `writeCaptureFile`:

```ts
export function deleteCaptureFile(id: number): void {
  const mdPath = join(capturesDir(), `${id}.md`);
  if (existsSync(mdPath)) unlinkSync(mdPath);
}
```

Imports needed: `existsSync`, `unlinkSync` (already imported in the file).

---

### Step 2: Add DELETE route and extend PATCH in `spine/src/routes/tasks.ts`

**DELETE /api/tasks/:id**:

```ts
.delete(
  '/api/tasks/:id',
  ({ params, set }) => {
    const id = parseInt(params.id, 10);
    if (isNaN(id)) { set.status = 400; return { error: 'Invalid id' }; }

    // Fetch attachments before deleting the row
    const atts = db.query(
      'SELECT id, stored_path FROM capture_attachments WHERE capture_id = ?'
    ).all(id) as { id: number; stored_path: string }[];

    const result = db.transaction(() =>
      db.prepare(
        `DELETE FROM captures WHERE id = ? AND triage_action = 'task' RETURNING id`
      ).get(id)
    )() as { id: number } | null;

    if (!result) { set.status = 404; return { error: 'Not found' }; }

    // Clean up attachments (binary + index files)
    for (const att of atts) {
      try { deleteAttachmentBinary(att.stored_path); } catch {}
      try { deleteAttachmentIndex(att.id); } catch {}
    }
    deleteCaptureFile(id);
    refreshIndex();
    return {};
  },
  { params: t.Object({ id: t.String() }) },
)
```

Where `deleteAttachmentBinary` and `deleteAttachmentIndex` are small inline helpers (or imports from search.ts if we add them there).

**Extended PATCH /api/captures/:id/task** - add optional `text` field to body schema and handler:

```ts
// In the body schema, add:
text: t.Optional(t.String())

// In the handler, before the UPDATE query:
if (body.text !== undefined) {
  const newText = body.text.trim();
  if (newText.length === 0) { set.status = 422; return { error: 'Task text is required' }; }
  if (newText.length > MAX_TASK_TEXT_LENGTH) { set.status = 422; return { error: 'Task text must be 10,000 characters or fewer' }; }
  // Include text in the UPDATE
}
```

The UPDATE query becomes:
```sql
UPDATE captures
SET task_due_date = ?, task_priority = ?, task_notes = ?, text = COALESCE(?, text)
WHERE id = ? AND triage_action = 'task'
RETURNING id, text, captured_at
```

After a successful update with `text`, call `writeCaptureFile(id, updatedText, 'task', capturedAt)` and `refreshIndex()`.

---

### Step 3: Update `surface/src/lib/api/tasks.ts`

Add `deleteTask`:
```ts
export function deleteTask(id: number): Promise<void> {
  return apiFetch(`/api/tasks/${id}`, { method: 'DELETE' });
}
```

Extend `UpdateTaskMetaParams`:
```ts
export interface UpdateTaskMetaParams {
  text?: string;
  due_date?: string | null;
  priority?: TaskPriority | null;
  notes?: string | null;
}
```

---

### Step 4: Update `surface/src/components/tasks/TasksView.svelte`

In the expanded task edit panel (`task-edit` div):

1. Add a `<textarea>` for task text above the due-date row, bound to `editText`, initialized in the `expand()` function.
2. Add a Delete button to `task-edit-actions` (left-aligned, destructive styling) that calls `deleteTask()` after `window.confirm`.

State additions:
```ts
let editText = $state('');
let deleting = $state(false);
```

In `expand()`:
```ts
editText = task.text;
```

`deleteTask` handler:
```ts
async function destroyTask(task: Task) {
  if (!window.confirm(`Delete "${task.text}"? This cannot be undone.`)) return;
  deleting = true;
  queryClient.setQueryData(taskKeys.list(), (old: Task[] | undefined) =>
    old ? old.filter((t) => t.id !== task.id) : []
  );
  try {
    await deleteTask(task.id);
    queryClient.invalidateQueries({ queryKey: taskKeys.done() });
    expandedId = null;
    wb.showToast('Task deleted');
  } catch (err) {
    logError('deleteTask', err);
    queryClient.invalidateQueries({ queryKey: taskKeys.list() });
    wb.showToast('Delete failed');
  } finally {
    deleting = false;
  }
}
```

In `saveEdit()`, pass `text: editText` when it differs from `task.text`.

---

## Validation

```bash
just test          # spine unit tests
just check         # tsc --noEmit
just lint          # oxlint + eslint
```
