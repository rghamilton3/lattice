# Contract: Spine API deltas

## Existing endpoints, changed behavior

### POST /api/agent/capture/:id/attachments (bearer auth)

Unchanged request/response shape (`{ signal_id, content_type, filename, data,
size_bytes }`). New behavior: after the durable write, the spine enqueues
extraction via `queueAttachment(...)` - closing the gap where signal-uploaded
attachments were never extracted (IN-4). Response is returned as soon as capture,
attachment, and `pending` status are durable; extraction is never inline.

### GET /api/captures/:id/attachments/:attId/description (Authentik auth)

Gate relaxed: previously `409` unless `extraction_status = 'dark'`. Now also
serves the head `attachment_descriptions` row when the attachment is audio
(`content_type LIKE 'audio/%'`) - i.e. the transcript, regardless of
`done`/`failed` status, when a row exists.

### PATCH /api/captures/:id/attachments/:attId/description (Authentik auth)

Same gate relaxation. Editing `final_text` and/or setting `confirmed: true` on a
transcript:

- updates the head row (RH-4: confirmed blocks any future regeneration),
- refreshes `capture_attachments.extracted_text` snapshot,
- rewrites the attachment index file and refreshes search.

### DELETE capture (existing capture-delete path in routes/tasks.ts)

Now removes attachment files on disk, attachment-index markdown, and
`attachment_descriptions` rows alongside the `capture_attachments` rows (NF-4).

## New endpoints

### POST /api/captures/:id/attachments/:attId/retry-extraction (Authentik auth)

Manual retry for `failed` attachments (NT-4 recoverable surface state).

- `404` unknown attachment; `409` if status is not `failed`.
- Resets status to `pending`, clears `extraction_failure_reason`, enqueues the
  job, returns `{ status: "pending" }`.
- Works for any failed extraction type (audio included). A confirmed transcript
  short-circuits per TX-7 (re-index, mark `done`, no ASR call).

## Attachment listing payloads

Wherever capture attachments are serialized to the surface (inbox attachment
list), include `extraction_status` and `extraction_failure_reason` so the surface
can render pending/processing state, the transcript, and a Retry affordance with
the failure reason. (Today's payload already includes extraction fields where
needed; extend selects that omit them.)

## Events (NT-1, NT-2, NT-3)

`spine/src/transcriptionEvents.ts` (new), mirroring `archiveEvents.ts`:

- `emitTranscriptionAttention(posture, { captureId, attachmentId, kind: 'complete' | 'failed_terminal', excerpt })`
- Posture from `TRANSCRIPTION_NOTIFICATION_POSTURE` (default `standard`):
  - `quiet`: no emissions
  - `standard`: completions + terminal failures
  - `active`: completions + all failures (including transient exhaustion)
- Listener bridges onto the existing capture SSE stream
  (`GET /api/captures/stream`) as an `attachment_transcribed` /
  `attachment_extraction_failed` event so the surface can show an ephemeral,
  non-actionable toast. Dismissal verbs in surface copy: "Open" / "Skip" (no "X",
  no overdue state).
