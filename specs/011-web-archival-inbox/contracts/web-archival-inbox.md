# Contracts: Web Archival And Inbox Evolution

## Auth Boundary

- `/api/agent/archive-page` and `/api/agent/archive-url` use the existing bearer-token agent route group.
- `/api/archives*`, `/api/inbox*`, and settings/posture routes are Authentik-protected browser API routes.
- Surface must only use relative `/api/*` calls and must not import spine code or read archive files directly.

## POST /api/agent/archive-page

Rendered browser capture path for SingleFile or a future wrapper.

### Request

Multipart form data:

- `file`: Required archived HTML file or HTML blob.
- `url`: Required source URL.
- `title`: Optional page title.
- `why_saved`: Optional one-line note.
- `source`: Optional source label, default `browser-ext`.

Headers:

- `Authorization: Bearer <LATTICE_AGENT_TOKEN>`
- `X-Forwarded-Proto: https`

### Response 200

```json
{
  "id": 42,
  "url": "https://example.com/docs",
  "title": "Example Docs",
  "quality": "good",
  "captured_via": "singlefile",
  "superseded": [17]
}
```

### Behavior

- Stores the uploaded HTML as a local archive artifact.
- Extracts text and writes QMD source text.
- Classifies SingleFile captures as `good` unless file storage or extraction fails.
- Supersedes existing non-superseded degraded/failed archives for the same URL.
- Creates a recent-review inbox item for the new good archive.

### Errors

- `400` or `422`: Missing file, invalid URL, invalid form field, or empty upload.
- `401` or `403`: Bearer token guard rejects the request.
- `500`: Local storage, extraction, or database write failed.

## POST /api/agent/archive-url

URL-only capture path for mobile share, hotkey, and scripted inputs.

### Request Body

```json
{
  "url": "https://example.com/docs",
  "why_saved": "Need this API detail later",
  "source": "mobile-share"
}
```

### Response 202

```json
{
  "job_id": "archive-20260526-000001",
  "status": "queued"
}
```

### Behavior

- Enqueues a best-effort in-process archive job.
- Worker invokes the local URL archiver with a bounded timeout.
- Stores good or degraded artifacts when bytes are recoverable.
- Creates recapture inbox items for degraded or failed output.
- Sends an attention message for recapture when notification posture permits.

### Errors

- `400` or `422`: Invalid URL or invalid request body.
- `401` or `403`: Bearer token guard rejects the request.
- `503`: In-process queue is unavailable or saturated.

## GET /api/archives/:id

Returns archive metadata and extracted text preview for browser reading and inbox review.

### Response 200

```json
{
  "id": 42,
  "url": "https://example.com/docs",
  "title": "Example Docs",
  "archived_at": "2026-05-26T20:00:00.000Z",
  "captured_via": "singlefile",
  "source": "browser-ext",
  "why_saved": "Need this API detail later",
  "quality": "good",
  "supersedes": 17,
  "extracted_text": "Example Docs..."
}
```

### Errors

- `400`: Invalid id.
- `401` or `403`: Authentik guard rejects the request.
- `404`: Archive does not exist or was deleted.

## GET /api/archives/:id/raw

Returns the stored HTML artifact for an archive id.

### Behavior

- Looks up the archive by id and reads the recorded local file path only after confirming it resolves under archive storage.
- Responds with `text/html; charset=utf-8` where possible.

### Errors

- `400`: Invalid id.
- `401` or `403`: Authentik guard rejects the request.
- `404`: Archive or local artifact is missing.

## POST /api/archives/:id/action

Applies inbox/review actions to archive items.

### Request Body

```json
{
  "action": "recapture"
}
```

Allowed actions:

- `keep`: Mark recent archive review resolved as kept.
- `archive`: Mark recent archive review resolved as archived without changing technical quality.
- `recapture`: Keep item actionable and return the source URL for browser recapture.
- `delete`: Remove a degraded/failed archive from active review/search.
- `skip`: Defer the decision without turning it into urgency/debt.
- `auto-kept`: Internal action for settling-period promotion.

### Response 200

```json
{
  "ok": true,
  "url": "https://example.com/docs"
}
```

### Errors

- `400` or `422`: Invalid id/action combination.
- `401` or `403`: Authentik guard rejects the request.
- `404`: Archive does not exist or is no longer active.

## GET /api/inbox

Returns a unified inbox model for captures and archive review items.

### Query Parameters

- `limit`: Optional positive integer string; default 50, capped at 200.
- `cursor`: Optional opaque pagination cursor.

### Response 200

```json
{
  "items": [
    {
      "item_type": "archive_recapture",
      "id": "archive:17",
      "archive_id": 17,
      "title": "Example Docs",
      "summary": "Capture looks incomplete and needs desktop recapture.",
      "url": "https://example.com/docs",
      "source": "mobile-share",
      "quality": "degraded",
      "created_at": "2026-05-26T19:55:00.000Z",
      "actions": [
        { "action": "recapture", "label": "Re-capture", "shortcut": "r" },
        { "action": "delete", "label": "Delete", "shortcut": "d" },
        { "action": "skip", "label": "Skip", "shortcut": "Space" }
      ]
    }
  ],
  "next_cursor": null
}
```

### Rules

- Existing capture items and archive review items are sorted into one list.
- Item type determines action row variant.
- Recently captured items are omitted once they auto-promote or are reviewed.

## Search Result Contract

- Default search includes archive results only when `quality = 'good'` and the archive is not superseded.
- Degraded, failed, deleted, and superseded archives are excluded from default search.
- Search result `kind` gains an `archive` value with `id`, `url`, `title`, `snippet`, `body`, and `modified_at`.

## Notification Contract

Attention decision input:

```json
{
  "type": "archive_recapture",
  "title": "Example Docs",
  "url": "https://example.com/docs",
  "archive_id": 17,
  "quality": "degraded"
}
```

Posture rules:

- `quiet`: No Signal attention messages.
- `standard`: Send for `archive_recapture`; suppress `archive_recent`.
- `active`: Send for `archive_recapture` and may send for `archive_recent`.

Failure handling:

- Relay send failure is logged and never rolls back archive storage or inbox state.
