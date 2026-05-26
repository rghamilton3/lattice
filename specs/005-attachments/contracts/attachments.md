# Contracts: Attachments

All routes are user routes protected by the existing Authentik forward-auth guard unless explicitly noted. Agent attachment ingest remains bearer-token protected and is not expanded by this feature.

## Capture Attachments

### `GET /api/captures/:id/attachments`

Returns attachment metadata for an existing capture in chronological order.

Success `200`:

```json
[
  {
    "id": 42,
    "capture_id": 7,
    "filename": "note.pdf",
    "content_type": "application/pdf",
    "size_bytes": 12345,
    "stored_path": "7/42",
    "upload_source": "browser",
    "created_at": "2026-05-26T18:00:00.000Z"
  }
]
```

Errors:
- `400 { "error": "Invalid id" }` for non-numeric capture ids.
- `404 { "error": "Not found" }` when the capture does not exist.

### `POST /api/captures/:id/attachments`

Uploads one multipart `file` field to an existing capture.

Success `200` returns the created attachment metadata.

Errors:
- `400 { "error": "Invalid id" }` for non-numeric capture ids.
- `400 { "error": "Invalid multipart body" }` for malformed multipart data.
- `400 { "error": "Missing file field" }` when no file is provided.
- `404 { "error": "Not found" }` when the capture does not exist.

Side effects:
- Stores binary under the configured attachment directory.
- Writes attachment metadata to SQLite.
- Writes retrieval metadata and refreshes search.

### `GET /api/captures/:id/attachments/:attId/raw`

Streams the raw file for an attachment belonging to the specified capture.

Success `200` response headers:
- `Content-Type`: stored media type.
- `Content-Disposition`: attachment with sanitized filename.
- `X-Content-Type-Options`: `nosniff`.

Errors:
- `400` body `Invalid id` for non-numeric capture or attachment ids.
- `404` body `Not found` when metadata does not match the capture and attachment id.
- `404` body `File not found on disk` when metadata exists but binary is missing.
- `403` body `Forbidden` when the resolved file path escapes attachment storage.
- `500` body `Internal error` for unexpected filesystem resolution failures.

### `DELETE /api/captures/:id/attachments/:attId`

Deletes an attachment belonging to the specified capture.

Success `200`:

```json
{}
```

Errors:
- `400 { "error": "Invalid id" }` for non-numeric capture or attachment ids.
- `404 { "error": "Not found" }` when metadata does not match.

Side effects:
- Removes the metadata row.
- Attempts binary and retrieval metadata cleanup.
- Refreshes search.

## Working Attachments

### `GET /api/working/:slug/attachments`

Returns attachment metadata for an existing working document in chronological order.

Success `200`:

```json
[
  {
    "id": 43,
    "slug": "draft-note",
    "filename": "diagram.png",
    "content_type": "image/png",
    "size_bytes": 67890,
    "stored_path": "working/draft-note/43",
    "created_at": "2026-05-26T18:00:00.000Z"
  }
]
```

Errors:
- `404 { "error": "Not found" }` when the working document does not exist.

### `POST /api/working/:slug/attachments`

Uploads one multipart `file` field to an existing working document.

Success `200` returns the created working attachment metadata.

Errors:
- `400 { "error": "Invalid multipart body" }` for malformed multipart data.
- `400 { "error": "Missing file field" }` when no file is provided.
- `404 { "error": "Not found" }` when the working document does not exist.

Side effects:
- Stores binary under `working/<slug>/` in the configured attachment directory.
- Writes working attachment metadata to SQLite.
- Writes retrieval metadata and refreshes search.

### `GET /api/working/:slug/attachments/:attId/raw`

Streams the raw file for an attachment belonging to the specified working document.

Success and headers match capture raw serving.

Errors:
- `400` body `Invalid id` for non-numeric attachment ids.
- `404` body `Not found` when metadata does not match the slug and attachment id.
- `404` body `File not found on disk` when metadata exists but binary is missing.
- `403` body `Forbidden` when the resolved file path escapes working attachment storage.
- `500` body `Internal error` for unexpected filesystem resolution failures.

### `DELETE /api/working/:slug/attachments/:attId`

Deletes an attachment belonging to the specified working document.

Success `200`:

```json
{}
```

Errors:
- `400 { "error": "Invalid id" }` for non-numeric attachment ids.
- `404 { "error": "Not found" }` when metadata does not match.

Side effects:
- Removes the metadata row.
- Attempts binary and retrieval metadata cleanup.
- Refreshes search.

## Retrieval Result Contract

Attachment metadata can appear in search results as:

```json
{
  "kind": "capture-attachment",
  "id": 42,
  "capture_id": 7,
  "filename": "note.pdf",
  "score": 0.81,
  "snippet": "note.pdf",
  "body": "...",
  "path": "...",
  "modified_at": "2026-05-26T18:00:00.000Z"
}
```

or:

```json
{
  "kind": "working-attachment",
  "id": 43,
  "slug": "draft-note",
  "filename": "diagram.png",
  "score": 0.79,
  "snippet": "diagram.png",
  "body": "...",
  "path": "...",
  "modified_at": "2026-05-26T18:00:00.000Z"
}
```

Stale retrieval hits without backing metadata must be filtered or made non-actionable before they reach the surface.
