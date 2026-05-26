# Contracts: Working Docs

All endpoints are user-facing `/api/*` routes and require the existing Authentik guard.

## GET /api/working

Success response:

```json
[
  {
    "slug": "project-plan",
    "title": "Project Plan",
    "modified_at": "2026-05-26T12:00:00.000Z"
  }
]
```

Validation and errors:

- Returns an empty list when no working documents exist.
- Results are ordered by `modified_at DESC`.
- Server-side storage/listing failures return `500` with `{ "error": "Failed to list working docs" }`.

## POST /api/working

Request body:

```json
{
  "title": "Project Plan",
  "content": "# Project Plan\n\nNotes"
}
```

Optional seed fields:

- `seed_capture_id`: Existing capture id to seed content from.
- `seed_file_id`: Existing indexed file id to seed content from.

Success response:

```json
{ "slug": "project-plan" }
```

Validation and errors:

- Empty titles fail request validation or document validation.
- Titles that produce an empty slug return a client-facing validation error.
- Duplicate slugs return `409` with `{ "error": "Slug already exists" }`.
- Missing seed capture returns `404` with `{ "error": "Capture not found" }`.
- Missing seed file returns `404` with `{ "error": "File not found" }`.

## GET /api/working/:slug

Path parameters:

- `slug` (string): Working document slug matching `^[a-z0-9-]+$`.

Success response:

```json
{
  "slug": "project-plan",
  "title": "Project Plan",
  "modified_at": "2026-05-26T12:00:00.000Z",
  "content": "# Project Plan\n\nNotes"
}
```

Validation and errors:

- Invalid slug shape fails request validation.
- Missing documents return `404` with `{ "error": "Not found" }`.

## PUT /api/working/:slug

Path parameters:

- `slug` (string): Existing working document slug matching `^[a-z0-9-]+$`.

Request body:

```json
{ "content": "# Project Plan\n\nUpdated notes" }
```

Success response:

```json
{ "ok": true }
```

Validation and errors:

- Invalid slug shape fails request validation.
- Missing documents return `404` with `{ "error": "Not found" }`.
- Content is stored exactly as provided.

## DELETE /api/working/:slug

Path parameters:

- `slug` (string): Existing working document slug matching `^[a-z0-9-]+$`.

Success response:

```json
{ "ok": true }
```

Validation and errors:

- Invalid slug shape fails request validation.
- Missing documents return `404` with `{ "error": "Not found" }`.
- Deleted documents no longer appear in `GET /api/working` and return not found when reopened.
