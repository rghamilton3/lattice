# API Contract: Tasks Full CRUD

**Modification**: 006-mod-001
**Original Contract**: `specs/006-tasks-triage/contracts/tasks-triage.md`

---

## New Endpoint: Delete Task

```
DELETE /api/tasks/:id
```

**Auth**: Authentik (same as all other task routes)

**Path params**:
- `id` (string, required) - numeric capture id

**Success response**: `200 {}` or `204`

**Error responses**:
- `400 { error: "Invalid id" }` - `id` is not a valid integer
- `404 { error: "Not found" }` - no `captures` row with that id and `triage_action = 'task'` exists

**Side effects on success**:
1. All `capture_attachments` rows for the capture are deleted; their binary files and attachment-index `.md` files are removed from disk.
2. The capture `.md` file at `capturesDir()/${id}.md` is removed from disk.
3. The `captures` row is deleted.
4. `refreshIndex()` is called.

---

## Modified Endpoint: Update Task Metadata (now includes text)

```
PATCH /api/captures/:id/task
```

**Existing body fields** (unchanged):
- `due_date?: string | null`
- `priority?: "high" | "medium" | "low" | null`
- `notes?: string | null`

**New body field**:
- `text?: string` - if provided, must be non-empty after trim and at most 10 000 characters

**Error responses** (additions to existing):
- `422 { error: "Task text is required" }` - `text` provided but empty after trim
- `422 { error: "Task text must be 10,000 characters or fewer" }` - `text` too long

**Side effects when `text` is provided and valid**:
1. `captures.text` is updated in the database.
2. `writeCaptureFile(id, text, 'task', captured_at)` rewrites the on-disk `.md`.
3. `refreshIndex()` is called.

---

## Working Docs (unchanged, documented for completeness)

Working docs already provide full CRUD and are not modified by 006-mod-001:

| Method | Path | Operation |
|--------|------|-----------|
| `POST` | `/api/working` | Create doc |
| `GET` | `/api/working` | List docs |
| `GET` | `/api/working/:slug` | Read doc |
| `PUT` | `/api/working/:slug` | Update content (title is the `# H1` heading in content) |
| `DELETE` | `/api/working/:slug` | Delete doc |
