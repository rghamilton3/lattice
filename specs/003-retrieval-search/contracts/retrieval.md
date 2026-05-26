# Contracts: Retrieval Search

All endpoints are user-facing `/api/*` routes and require the existing Authentik guard.

## GET /api/search

Query parameters:

- `q` (string, required after trim): Search query.
- `deep` (optional string): Only `true` enables deep search; all other values use fast search.

Success response:

```json
{
  "results": [
    {
      "kind": "capture",
      "id": 42,
      "score": 0.91,
      "snippet": "matched context",
      "body": "full indexed body",
      "path": "captures/42.md",
      "modified_at": "2026-05-26T12:00:00.000Z"
    }
  ]
}
```

Validation and errors:

- Missing or whitespace-only `q` returns `400` with `{ "error": "q is required" }`.
- If search initialization is unavailable, the route must not crash the service; safe empty results or a clear error are acceptable.

## GET /api/files

Query parameters:

- `limit` (optional string): Defaults to 100, capped at 500.
- `cursor` (optional string): Base64url cursor containing file pagination state.

Success response:

```json
{
  "items": [
    {
      "id": 7,
      "machine_id": "laptop",
      "path": "/notes/project.md",
      "mime_type": "text/markdown",
      "modified_at": "2026-05-26T12:00:00.000Z"
    }
  ],
  "next_cursor": null
}
```

Validation and errors:

- Malformed, empty, or non-positive-id cursors return `400` with `{ "error": "Invalid cursor" }`.
- Results are ordered by `modified_at DESC, id DESC`.

## GET /api/files/:id

Path parameters:

- `id` (string): Numeric indexed file id.

Success response: Full indexed file row including text, hash, MIME type, size, and timestamps.

Validation and errors:

- Non-numeric ids return `400`.
- Missing rows return `404`.

## GET /api/files/:id/raw

Path parameters:

- `id` (string): Numeric indexed file id.

Success response: Raw file response with the recorded content type.

Validation and errors:

- Non-numeric ids return `400`.
- Missing rows or files missing on disk return `404`.
- Circular symlinks or paths that resolve to a different canonical path return `403`.

## GET /api/similar

Query parameters:

- `id` (string, required): Source item id or working slug.
- `kind` (required): `capture`, `local-file`, or `working`.

Success response:

```json
{
  "results": [
    {
      "kind": "local-file",
      "id": 0,
      "score": 0.72,
      "snippet": "related context",
      "body": "full indexed body",
      "path": "local-files/laptop/hash.md",
      "machine_id": "laptop",
      "modified_at": "2026-05-26T12:00:00.000Z"
    }
  ]
}
```

Validation and errors:

- Invalid kind fails request validation.
- Non-numeric capture/local-file ids return `400`.
- Missing source items return `404`.
- Result count is capped at 10 and excludes the source item.

## GET /api/nearby

Query parameters:

- `timestamp` (string, required after trim): Center timestamp.
- `window_hours` (optional string): Defaults to 72 when missing or zero; clamped to 1 through 720.

Success response:

```json
{
  "results": [
    {
      "id": 9,
      "kind": "capture",
      "ts": "2026-05-26T12:00:00.000Z",
      "snippet": "nearby text",
      "machine_id": null
    }
  ]
}
```

Validation and errors:

- Missing timestamp fails request validation or returns `400` when blank.
- Invalid timestamp returns `400` with `{ "error": "Invalid timestamp" }`.
- Results are sorted ascending by timestamp.
