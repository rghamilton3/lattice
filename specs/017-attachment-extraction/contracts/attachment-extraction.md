# API Contract: Attachment Extraction and Image Description

**Feature**: 017-attachment-extraction
**Date**: 2026-06-08

---

## Changed Responses

### GET /api/captures/:id/attachments

Existing endpoint; response shape extended with new fields.

**Response item (was)**:
```json
{
  "id": 1,
  "capture_id": 42,
  "filename": "report.pdf",
  "content_type": "application/pdf",
  "size_bytes": 102400,
  "stored_path": "captures/42/1",
  "upload_source": "",
  "created_at": "2026-06-01T10:00:00.000Z"
}
```

**Response item (now)**:
```json
{
  "id": 1,
  "capture_id": 42,
  "filename": "report.pdf",
  "content_type": "application/pdf",
  "size_bytes": 102400,
  "stored_path": "captures/42/1",
  "upload_source": "",
  "created_at": "2026-06-01T10:00:00.000Z",
  "extraction_status": "done"
}
```

> `extraction_status` is one of: `"pending"` | `"done"` | `"failed"` | `"dark"`

### POST /api/captures/:id/attachments

Upload response also gains `extraction_status: "pending"`.

---

### GET /api/working/:slug/attachments

Same extension - each item gains `extraction_status`.

### POST /api/working/:slug/attachments

Upload response also gains `extraction_status: "pending"`.

---

## New Endpoints

### GET /api/captures/:id/attachments/:attId/description

Return the current description for a `dark` capture attachment.

**Auth**: Authentik (same as parent attachment route)

**Path params**: `id` (capture id, integer), `attId` (attachment id, integer)

**Success** `200 OK`:
```json
{
  "id": 7,
  "attachment_kind": "capture",
  "attachment_id": 1,
  "produced_text": "A diagram showing three microservices connected by arrows...",
  "final_text": "A diagram showing three microservices connected by arrows labeled HTTP.",
  "confirmed": false,
  "model_id": "minicpm-v",
  "supersedes": null,
  "created_at": "2026-06-01T10:05:00.000Z"
}
```

**Not found** `404`:
- Attachment does not exist, or does not belong to capture, or no description exists yet.

**Not applicable** `409`:
- Attachment exists but `extraction_status != 'dark'`. Body: `{ "error": "Attachment is not dark" }`.

---

### PATCH /api/captures/:id/attachments/:attId/description

Edit the `final_text` and/or mark the description as confirmed. User-authored edits only.

**Auth**: Authentik

**Body**:
```json
{
  "final_text": "A diagram showing three microservices...",
  "confirmed": true
}
```
Both fields are optional. At least one must be present.

**Success** `200 OK` - returns full updated description object (same shape as GET).

**Errors**:
- `400` - body missing both fields, or `final_text` is empty string.
- `404` - attachment/description not found.
- `409` - description already confirmed and caller is trying to set `confirmed: false` (once confirmed, only `final_text` can still be updated by a user - the system respects confirmed but the user can always re-edit text).

---

### GET /api/working/:slug/attachments/:attId/description

Same as capture variant but under the working-document attachment namespace.

**Path params**: `slug` (working doc slug), `attId` (attachment id, integer)

Identical success/error shape.

---

### PATCH /api/working/:slug/attachments/:attId/description

Same as capture variant.

---

## No New Agent Routes

Extraction and description generation are internal spine operations triggered by attachment upload and the startup sweep. The agent does not call any new endpoints for this feature.

---

## Backward Compatibility

All changes to existing endpoints are additive (new fields on existing response objects). Clients that do not read `extraction_status` continue to work without modification.

The `stored_path` and `id` fields on attachment responses are unchanged. The binary-file `raw` endpoints (`/api/captures/:id/attachments/:attId/raw`, `/api/working/:slug/attachments/:attId/raw`) are unchanged.
