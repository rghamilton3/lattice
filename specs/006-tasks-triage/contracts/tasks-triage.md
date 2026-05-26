# Contracts: Tasks And Triage

## `POST /api/captures/:id/triage`

Assigns a triage outcome to a capture.

Request body:

```json
{ "action": "keep" }
```

Accepted actions: `keep`, `archive`, `promote`, `task`, `skip`.

Success response: `200 {}`.

Errors:

- `400 { "error": "Invalid id" }` for non-numeric ids.
- `400 { "error": "Invalid action" }` for unsupported actions.
- `404 { "error": "Not found" }` for missing captures.

Side effects:

- Sets `triaged_at` to the current timestamp.
- Sets `triage_action` to the requested action.
- Default inbox lists exclude the row after success.

## `POST /api/captures`

Creates a capture and optionally converts a supported leading slash command into triage state.

Request body:

```json
{ "text": "/task buy milk", "source": "browser" }
```

Success response:

```json
{ "id": 123, "triage_action": "task", "text": "buy milk" }
```

Command behavior:

- `/task <body>` maps to `triage_action = task` and stores `<body>` as text.
- `/note <body>` maps to `triage_action = keep` and stores `<body>` as text.
- `/skip <body>` maps to `triage_action = skip` and stores `<body>` as text.
- Unknown commands, commands without a body, and slashes not at the beginning are stored as plain text with no triage action.

Errors:

- `422 { "error": "Capture text is required" }` for blank text.
- `422 { "error": "Capture text must be 10,000 characters or fewer" }` for overly long text.
- `422 { "error": "Capture source is required" }` for blank/missing source.

## `GET /api/tasks`

Lists active tasks.

Success response: array of task rows with `task_completed_at = null`.

Ordering:

1. Tasks with due dates before undated tasks.
2. Earlier due dates before later due dates.
3. Priority order: high, medium, low, none.
4. Deterministic recency/id tie-break for otherwise equal rows.

## `GET /api/tasks/done`

Lists completed tasks.

Success response: array of task rows where `task_completed_at` is not null, sorted newest-completed first.

## `POST /api/tasks`

Creates a direct task.

Request body:

```json
{
  "text": "renew passport",
  "due_date": "2026-06-30",
  "priority": "high",
  "notes": "Need photo first"
}
```

Success response:

```json
{ "id": 123 }
```

Errors:

- `422` for blank text or invalid body shape.
- `422` for unsupported priority.

Side effects:

- Inserts a capture row with source `task`, `triage_action = task`, and `triaged_at` set.
- Writes the capture markdown file and refreshes retrieval indexing.

## `PATCH /api/captures/:id/task`

Updates metadata for an active or completed task row.

Request body:

```json
{ "due_date": null, "priority": "medium", "notes": "Updated notes" }
```

Success response: `200 {}`.

Errors:

- `400 { "error": "Invalid id" }` for non-numeric ids.
- `404 { "error": "Not found" }` for missing or non-task captures.
- `422` for unsupported priority/body shape.

## `PATCH /api/tasks/:id/complete`

Marks a task complete.

Success response: `200 {}`.

Errors:

- `400 { "error": "Invalid id" }` for non-numeric ids.
- `404 { "error": "Not found" }` for missing or non-task captures.

## `PATCH /api/tasks/:id/uncomplete`

Restores a completed task to active status.

Success response: `200 {}`.

Errors:

- `400 { "error": "Invalid id" }` for non-numeric ids.
- `404 { "error": "Not found" }` for missing or non-task captures.
