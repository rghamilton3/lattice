# Data Model: Signal Voice Capture Pipeline

## Migration 018_audio_transcription.sql

```sql
ALTER TABLE capture_attachments ADD COLUMN extraction_failure_reason TEXT NOT NULL DEFAULT '';
ALTER TABLE working_attachments ADD COLUMN extraction_failure_reason TEXT NOT NULL DEFAULT '';
```

No new tables. The `processing` status value needs no schema change
(`extraction_status` is TEXT with no CHECK constraint, migration 013).

## extraction_status lifecycle (extended, all extraction types)

```
pending ──► processing ──► done                  (text extracted / transcript stored)
                       ──► dark                  (image, no text; VLM description path)
                       ──► failed                (reason persisted)
```

- `processing` is set by `processOne()` immediately before extraction begins, for
  every attachment kind (per clarification 2026-06-11).
- Startup sweep (`sweepPending`) re-enqueues: `pending`, `processing`
  (crash-interrupted), and `failed` rows whose `extraction_failure_reason` starts
  with `transient:`.
- `extraction_failure_reason` convention:
  - `transient: <detail>` - retryable (AI server unreachable, timeout, 5xx, 429).
    Re-enqueued by startup sweep and by the periodic transient-retry loop.
  - `terminal: <detail>` - not retryable automatically (undecodable audio,
    zero-length audio, 4xx contract errors). Surfaced in the surface as a
    recoverable item; manual retry via the retry endpoint re-runs it.
  - cleared (set to `''`) whenever a row re-enters `processing`.

## Audio attachment identification

An attachment is audio when `content_type` starts with `audio/` (Signal produces
`audio/aac`, `audio/ogg; codecs=opus`, etc.). Audio routes to the transcription
path in `processOne()`; all other types keep their existing Tier 0 / OCR / VLM
behavior.

## Transcript storage (reuses spec-017 description pattern)

A transcript is an `attachment_descriptions` row (existing table, migration 014):

| Column | Use for transcripts |
|--------|---------------------|
| `attachment_kind` | `'capture'` (or `'working'` for working-doc audio) |
| `attachment_id` | the audio attachment |
| `produced_text` | raw ASR output (never mutated) |
| `final_text` | indexed text; user edits land here |
| `confirmed` | 1 once user-edited/confirmed; blocks regeneration (RH-4) |
| `model_id` | ASR model id used (provenance, RH-3) |
| `supersedes` | previous transcript row on re-run (history) |

Rules (identical to VLM descriptions, spec 017 FR-012/FR-013):

- On success, insert a new row; if an unconfirmed head row exists, the new row's
  `supersedes` points at it.
- If the head row is `confirmed = 1`, transcription is skipped entirely
  (idempotency TX-7); the attachment is re-marked `done` and re-indexed from the
  confirmed `final_text`.
- `capture_attachments.extracted_text` holds the indexed snapshot of the active
  transcript (`final_text` of the head row), keeping the existing
  `writeAttachmentIndex` flow unchanged.

## State sources of truth

- Outstanding transcription work: `extraction_status` column (TX-1). The
  in-process queue (`extraction-queue.ts` promise chain) is disposable.
- Transcript content + provenance: `attachment_descriptions` head row
  (`supersedes IS NULL`).
- Searchable text: `extracted_text` snapshot -> `${dbDir}/attachment-index/{id}.md`
  via `writeAttachmentIndex`.

## Deletion (NF-4)

`DELETE /api/tasks/:id` (capture delete) extends to remove, for each attachment:

1. the stored file under the attachments dir (`stored_path`),
2. the attachment-index markdown (`${dbDir}/attachment-index/{id}.md`),
3. `attachment_descriptions` rows for `('capture', attachment_id)`,
4. the `capture_attachments` row (existing behavior),

then `refreshIndex()`. This closes the pre-existing orphaned-files gap for all
attachment types, satisfying NF-4 for audio + transcript.

## Configuration additions

`~/.config/lattice/config.toml` under `[spine.qmd]` (pattern follows
`ocr_model` / `vlm_model`):

```toml
# [spine.qmd]
# asr_model       = "parakeet-tdt-0.6b-v2"   # model id routed by llama-swap
# asr_timeout_s   = 300                       # per-request transcription timeout
```

- `getAsrModel()` added beside `getOcrModel()` / `getVlmModel()` in
  `spine/src/config.ts`. Transcription is enabled only when `asr_model` is set;
  otherwise audio attachments behave as today (done with empty text, filename-only
  index).
- Base URL and bearer key reuse the existing `getQmdBaseUrl()` front door.
- Retry policy constants (in code, not config): 3 in-job attempts with 2s/8s/30s
  backoff for transient errors; periodic transient-retry sweep every 10 minutes.
- Notification posture: `TRANSCRIPTION_NOTIFICATION_POSTURE` env
  (`quiet|standard|active`, default `standard`), mirroring
  `ARCHIVE_NOTIFICATION_POSTURE`.
