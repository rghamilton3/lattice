# Contract: Annotations API

Auth model: Browser-authenticated route group guarded by the existing Authentik header middleware. These routes are not part of `/api/agent/*` and do not use the agent bearer token.

## POST /api/annotations

Creates an annotation for a supported target.

Request body:

```json
{
  "target_kind": "capture",
  "target_id": "cap_123",
  "selection_start": 10,
  "selection_end": 42,
  "selection_text": "selected source passage",
  "comment": "my durable reading note"
}
```

Rules:

- `target_kind`, `target_id`, and trimmed non-empty `comment` are required.
- `target_kind` must be `capture`, `local_file`, `working`, or `archive`.
- Offsets are optional, but if present must form a valid increasing range.
- Empty selected text or whitespace-only selected text is rejected when selection data is supplied.

Success response `201`:

```json
{
  "annotation": {
    "id": "ann_123",
    "target_kind": "capture",
    "target_id": "cap_123",
    "selection_start": 10,
    "selection_end": 42,
    "selection_text": "selected source passage",
    "comment": "my durable reading note",
    "created_at": "2026-05-29T12:00:00.000Z",
    "updated_at": "2026-05-29T12:00:00.000Z"
  }
}
```

Error responses:

- `400` for invalid target kind, invalid offsets, empty comment, or empty selection.
- `404` when the target identity is known to be invalid.

Side effects:

- Persists the annotation in SQLite.
- Writes or refreshes the annotation QMD index document.
- Does not mutate the source target.

## GET /api/annotations

Lists annotations for a target.

Query parameters:

- `target_kind`: Required; one of `capture`, `local_file`, `working`, `archive`.
- `target_id`: Required target id.

Success response `200`:

```json
{
  "annotations": [
    {
      "id": "ann_123",
      "target_kind": "capture",
      "target_id": "cap_123",
      "selection_start": 10,
      "selection_end": 42,
      "selection_text": "selected source passage",
      "comment": "my durable reading note",
      "created_at": "2026-05-29T12:00:00.000Z",
      "updated_at": "2026-05-29T12:00:00.000Z"
    }
  ]
}
```

Error responses:

- `400` for missing or invalid query parameters.

## DELETE /api/annotations/:id

Deletes an annotation.

Success response `204`: Empty body.

Error responses:

- `404` when no annotation exists for `id`.

Side effects:

- Removes the SQLite annotation row.
- Removes or refreshes the annotation QMD index document so deleted comment text stops matching search.
- Does not mutate the source target.
