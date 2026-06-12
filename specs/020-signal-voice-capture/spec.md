---
parent_branch: worktree-feat+signal-voice-capture
feature_number: "020"
status: Complete
created_at: 2026-06-11T22:01:19-05:00
references_consulted:
  - specs/007-signal-relay/spec.md
  - specs/016-remote-inference/spec.md
  - specs/017-attachment-extraction/spec.md
  - memory/project_remote_inference_fallback.md
---

# Feature: Signal Voice Capture Pipeline

## Overview

Capture a spoken thought by sending a Signal voice note to Lattice. The audio enters
through the spine like every other capture, is transcribed asynchronously by an English
ASR model behind an OpenAI-compatible shim, and the transcript becomes the capture's
searchable content while the source audio stays attached.

Scope: English, single-speaker, asynchronous batch (record-then-transcribe). No
real-time or streaming path anywhere.

Today (per `specs/007-signal-relay` and `specs/017-attachment-extraction`), a Signal
voice note already produces a capture with placeholder text `[voice note]` and an
uploaded audio attachment, but the attachment is content-dark forever: the
signal-upload path never enqueues extraction, and no extraction tier handles audio.
This feature closes that loop: audio becomes a first-class extraction type whose
extracted content is a transcript.

The spine talks to one `/v1` front door (llama-swap) for transcription, identical in
shape to its existing embedding/rerank/OCR/VLM calls (per
`specs/016-remote-inference`). Durability lives in the `extraction_status` column, not
the queue.

## Clarifications

### Session 2026-06-11

- Q: How should transcription statuses reconcile with the existing
  `extraction_status` enum (`pending/done/failed/dark`, no `processing`)? → A: Extend
  the shared enum with `processing` for all extraction types
  (`pending -> processing -> done | failed | dark`); update the existing extraction
  pipeline's state writes and the startup sweep accordingly.
- Q: Where should transcript confirmed/provenance live - the existing
  `attachment_descriptions` table pattern or new `transcript_confirmed` /
  `transcript_source` columns on `capture_attachments`? → A: Reuse the
  `attachment_descriptions` pattern (confirmed, model_id, supersedes history);
  `extracted_text` on `capture_attachments` stays the indexed snapshot.
- Q: Which ASR backend should v1 ship with? → A: NVIDIA NeMo running Parakeet EN
  (still private to the shim and swappable per AS-3).

## User Scenarios

1. **Spoken capture.** Robert records a voice note in Signal (Note to Self) and sends
   it. Within moments the capture appears in the inbox with placeholder text and the
   audio attached. A few minutes later (model load + transcription) the transcript is
   attached, searchable, and an ephemeral completion notification fires per his
   notification posture.
2. **Voice plus text.** He sends a voice note with an accompanying caption. The
   capture carries the caption as its text and the audio as an attachment; the
   transcript later joins it. Neither part is dropped.
3. **AI server is down.** He sends a voice note while the inference box is offline.
   The capture and audio land durably; the transcription job waits and retries with
   backoff. When the server returns, the transcript appears. Nothing is lost, nothing
   nags him.
4. **Spine restarts mid-job.** The spine crashes while a transcription is in flight.
   On startup, reconciliation re-enqueues the interrupted work from `extraction_status`
   and the transcript completes without manual intervention.
5. **Garbage audio.** A zero-length or undecodable attachment arrives. The job fails
   terminally with a persisted reason; the capture survives, and the failure surfaces
   as a recoverable, retryable item in the surface - never a silent drop, never a guilt
   marker.
6. **Edited transcript survives.** He corrects a mis-heard word in the transcript.
   The edit confirms the transcript; later retries, reconciliation, or a model swap
   never overwrite his correction (same semantics as the VLM image-description
   pipeline in spec 017).

## Functional Requirements

### Signal Relay (SR)

Input adapter from Signal into the single ingestion door. Built on signal-cli (existing
relay, `spine/src/signal-relay.ts`, per spec 007).

- **SR-1**: Receive inbound Signal messages and detect voice-note attachments (audio
  container/codec as produced by the Signal client; Opus/AAC).
- **SR-2**: Process only an allowlist of sender identities. Ignore all others with no
  side effects. (Per existing decision in spec 007 FR-002, the relay is Note-to-Self
  only: the allowlist is the single configured self number. This feature keeps that
  posture; generalizing to multiple senders is out of scope.)
- **SR-3**: Persist the raw attachment bytes and submit to the spine ingestion
  endpoint. The relay does not transcribe, classify, or transform; it is a transport
  adapter.
- **SR-4**: A message carrying both a voice note and text yields a capture for the
  audio plus the accompanying text content; neither is dropped.
- **SR-5**: Do not treat a received voice note as handled until the spine has durably
  accepted it. Spool locally and retry if the spine is momentarily unavailable.

### Spine Ingestion (IN)

- **IN-1**: Submit through the same capture-creation path as every other source
  (`POST /api/agent/capture` + attachment upload). No Signal-specific ingestion bypass.
- **IN-2**: Create a capture record and store the audio as a capture attachment with
  the bytes durably persisted, not merely referenced.
- **IN-3**: Set the attachment `extraction_status = pending`. The attachment is
  content-dark until transcription completes (consistent with `attachmentToMarkdown`
  indexing only the sanitized filename today).
- **IN-4**: Enqueue a transcription job. Return ingestion success once the capture,
  attachment, and pending status are durably written. Transcription is never inline or
  blocking. (Note: today the signal-upload route `POST
  /api/agent/capture/:id/attachments` does not enqueue extraction at all; this
  requirement closes that gap for audio.)
- **IN-5**: A capture with no transcript is valid and retained. A voice note that
  never transcribes is still a capture.

### Transcription Job and Durability (TX)

- **TX-1**: The source of truth for outstanding work is `extraction_status`, not the
  in-memory queue (same model as index-time embedding, per spec 016).
- **TX-2**: An in-process queue is sufficient (consistent with `archiveJobs.ts` and
  `extraction-queue.ts`). No external broker. Durability comes from DB-backed status
  plus reconciliation.
- **TX-3**: On spine startup, reconcile: re-enqueue every audio attachment in
  `pending`, in `processing` (crash-interrupted), or in a retryable `failed` state -
  extending the existing `sweepPending` startup sweep.
- **TX-4**: Status lifecycle: `pending -> processing -> done | failed` (plus the
  existing `dark` outcome for image extraction). Per clarification 2026-06-11, the
  shared `extraction_status` enum gains a `processing` state for all extraction
  types; existing extraction state writes and the startup sweep are updated to match.
  Persist a failure reason (`extraction_failure_reason`, new column) on `failed`.
- **TX-5**: Retry transient failures (AI server down, timeout, 5xx) with bounded
  backoff. An AI-server outage delays the transcript; it never drops the capture or
  the job.
- **TX-6**: Separate transient from terminal failures. Terminal failures (undecodable
  or zero-length audio) set failed with a persisted reason and surface as recoverable
  state. Silent drops are the failure mode to prevent.
- **TX-7**: Idempotent. Re-running transcription for an attachment is safe and must
  not overwrite a user-edited transcript (see RH-4).
- **TX-8**: Bound transcription concurrency (single worker, matching the existing
  serial extraction queue) so the spine doesn't flood the GPU. llama-swap arbitrates
  the model lifecycle; the spine bounds request concurrency.

### ASR Shim (AS)

OpenAI-compatible service in front of an English Parakeet model. The only
transcription contract the spine knows.

- **AS-1**: Expose `POST /v1/audio/transcriptions` accepting `multipart/form-data`
  with `file` and `model`.
- **AS-2**: Implement only the subset the spine calls: `file` + `model` in,
  `{ "text": ... }` out. No translations endpoint, no SSE streaming, no timestamp
  granularities until a consumer needs them.
- **AS-3**: Back the endpoint with an English Parakeet model. Per clarification
  2026-06-11, v1 ships with NVIDIA NeMo running Parakeet EN. The backend is private
  to the shim and swappable (e.g., to sherpa-onnx) without spine changes.
- **AS-4**: Load the model at process start and serve statelessly. The shim does not
  manage its own idle eviction; process start/stop and idle TTL are owned by
  llama-swap.
- **AS-5**: Provide a health endpoint for llama-swap readiness checks.
- **AS-6**: Return OpenAI-shaped error responses so the spine's retry logic
  (TX-5/TX-6) treats failures uniformly.
- **AS-7**: The `text` response drops confidence and word-level timestamps. If
  transcript-confidence flagging is later wanted, extend via `verbose_json` or an
  added field. Not required for v1.

#### Contract

```http
POST /v1/audio/transcriptions
Content-Type: multipart/form-data

file=<raw Signal attachment bytes>
model=<parakeet model id>
```

```json
{ "text": "transcribed content" }
```

### Audio Conversion (AC)

- **AC-1**: Conversion lives inside the shim. The spine POSTs the raw Signal
  attachment as received; it does no audio processing.
- **AC-2**: Accept arbitrary input containers/codecs (Opus, AAC, M4A, OGG, WAV) and
  normalize via ffmpeg to the model's required format: mono, 16 kHz, 16-bit PCM.
- **AC-3**: ffmpeg must be present in the shim runtime. Its absence is a startup
  failure, not a per-request surprise.
- **AC-4**: Reject undecodable or zero-length audio as a terminal (non-retryable)
  error with a clear reason (feeds TX-6).

### Result Handling and Data Model (RH)

- **RH-1**: On success, store the transcript as the attachment's extracted content.
  It becomes the capture's searchable text and is indexed through the existing
  `writeAttachmentIndex` path.
- **RH-2**: Set `extraction_status = done`.
- **RH-3**: Mark the transcript as system-generated and unconfirmed. The system never
  rewrites, summarizes, or acts on it.
- **RH-4**: A `confirmed` flag protects user edits. Once the user edits the
  transcript it is confirmed; idempotent retries, reconciliation, or a model change
  must never overwrite a confirmed transcript (same semantics as the VLM
  image-description pipeline, spec 017 FR-012/FR-013). Per clarification 2026-06-11,
  transcripts reuse the existing `attachment_descriptions` provenance pattern
  (produced_text, final_text, confirmed, model_id, supersedes history); the indexed
  snapshot remains `extracted_text` on `capture_attachments`. A re-run on an
  unconfirmed transcript supersedes the old row; a confirmed transcript blocks
  re-generation entirely.
- **RH-5**: Retain the original audio and keep it attached to the capture after
  transcription. Transcript and source coexist.
- **RH-6**: The pipeline detects (produces a transcript) and may flag (low
  confidence, future), but never prioritizes, mutates, or acts on the capture beyond
  filling the transcript. Editorial judgment stays with the user.

#### Schema delta

Reuses the `extraction_status` machinery from spec 017; transcription is one
extraction type. Per clarifications 2026-06-11:

| Field | Where | Purpose |
|-------|-------|---------|
| `extraction_status` | `capture_attachments` | extended enum: `pending` / `processing` (NEW) / `done` / `failed` / `dark` |
| `extraction_failure_reason` | `capture_attachments` | NEW column: terminal/transient reason on `failed` |
| transcript (indexed snapshot) | `capture_attachments.extracted_text` | searchable text, indexed via attachment-index |
| transcript provenance/history | `attachment_descriptions` row (existing pattern) | `confirmed` blocks overwrite; `model_id` provenance; `supersedes` history |

### Notification (NT)

- **NT-1**: Completion emits an ephemeral notification through the existing
  relay/posture system (Signal reply via `shouldSendSignalReply`, surface event).
- **NT-2**: Respect the Quiet / Standard / Active posture toggle.
- **NT-3**: The notification carries no actionable or overdue state. Dismissal is
  positive (verbs; Skip as a deferred non-decision), never an "X".
- **NT-4**: A terminal failure surfaces as a recoverable, retryable item in the
  surface, not as a guilt or overdue marker.

### Cross-Cutting (NF)

- **NF-1**: English-only, single-speaker, asynchronous batch. No real-time or
  streaming requirement on any leg.
- **NF-2**: The spine and AI server are independent. AI-server unavailability delays
  transcripts without affecting capture ingestion or other spine function (per spec
  016's degradation model).
- **NF-3**: Sender allowlist at the relay (SR-2). Transcription traffic stays within
  the Tailscale/WireGuard mesh, reaching the shim through llama-swap's `/v1` front
  door like other inference. The spine orchestrates the call; there is no
  agent-facing AI-server surface.
- **NF-4**: Deleting a capture removes its audio and transcript together. (Note:
  today capture deletion removes `capture_attachments` rows but orphans attachment
  files on disk and attachment-index markdown; for voice captures this feature must
  remove the audio file, transcript content, and index entry together.)

## Success Criteria

- A Signal voice note sent while all services are healthy produces a searchable
  transcript without any manual step; searching a distinctive phrase spoken in the
  note returns the capture.
- A voice note sent during a 30-minute AI-server outage still produces a transcript
  after the server returns, with zero captures or jobs lost.
- Killing the spine mid-transcription and restarting it completes the transcript
  without manual intervention.
- A zero-length or corrupt audio attachment ends in a failed state with a
  human-readable reason visible in the surface, and can be retried from there.
- A user-edited transcript survives a forced re-run of transcription unchanged.
- A message with voice note + caption yields one capture containing both the caption
  text and (later) the transcript; neither is lost.
- Non-allowlisted senders produce no captures, no files, and no notifications.
- Deleting a voice capture leaves no orphaned audio bytes, transcript content, or
  index entries for it.

## Key Entities

- **Capture**: existing record (`captures` table); voice notes arrive as source
  `signal` with placeholder or caption text.
- **Capture attachment**: existing record (`capture_attachments`); the audio bytes,
  `extraction_status`, and (new) `extraction_failure_reason` live here.
- **Transcript**: the attachment's extracted content; searchable via the
  attachment-index path; carries confirmed/provenance semantics per RH-3/RH-4.
- **Transcription job**: in-process queue entry derived from `extraction_status`;
  never the source of truth.
- **ASR shim**: new OpenAI-compatible service (one endpoint + health) wrapping
  NeMo Parakeet EN + ffmpeg normalization, fronted by llama-swap.

## Assumptions

- The existing relay's Note-to-Self restriction satisfies SR-2; no multi-sender
  allowlist is introduced.
- The existing base64-JSON attachment upload from relay to spine
  (`POST /api/agent/capture/:id/attachments`) remains the transport; "persist raw
  bytes" (SR-3) is satisfied by signal-cli's attachment directory plus the spine's
  durable copy.
- Audio attachments are identified by `content_type` prefix `audio/` (Signal
  produces e.g. `audio/aac`, `audio/ogg; codecs=opus`).
- The shim is configured in llama-swap alongside existing models; the spine reaches
  it through the same `/v1` base URL and bearer key it already uses for OCR/VLM
  (`getQmdBaseUrl()`), with a new configured ASR model id.
- Transcription requests use a generous timeout (audio is minutes long and the model
  may cold-start behind llama-swap); the existing 30 s fetch timeout used for OCR/VLM
  is insufficient and will be raised for this call type.
- Existing non-audio extraction behavior (Tier 0 subprocess, OCR, VLM) is unchanged.
- v1 surface scope: transcript visible/editable and failures retryable through the
  existing attachment/description UI affordances; no new dedicated audio player UI is
  required for transcription to ship.

## Sources

This spec was generated by consulting the following references (per
`.specswarm/references.md`):

| Source | Sections informing this spec |
|--------|------------------------------|
| `specs/007-signal-relay/spec.md` | FR-002 Note-to-Self only (SR-2), FR-006 attachment upload contract (SR-3), FR-009 best-effort acks (NT), FR-010 single socket + capped backoff (SR-5) |
| `specs/017-attachment-extraction/spec.md` | `extraction_status` lifecycle pending/done/failed/dark (TX-1, TX-4), startup sweep FR-002 (TX-3), `attachment_descriptions` confirmed/supersedes semantics FR-010/012/013 (RH-3, RH-4), async extraction FR-017 (IN-4) |
| `specs/016-remote-inference/spec.md` | remote-only inference with graceful degradation and durable backfill (TX-5, NF-2), single `/v1` front door (AS, NF-3) |
| `spine/src/extraction-queue.ts`, `spine/src/extract.ts`, `spine/src/describe.ts`, `spine/src/search.ts`, `spine/src/routes/agent.ts`, `spine/src/signal-relay.ts` | current behavior cited in IN-4 gap note, TX-8 serial queue, RH-1 `writeAttachmentIndex`, NF-4 deletion gap |
| memory: `project_remote_inference_fallback.md` | remote-only QMD posture; backfill via state + retry loop (TX-5) |

No section was fabricated without a corresponding source citation or
`[NEEDS CLARIFICATION]` marker.
