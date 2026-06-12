# Tasks: Signal Voice Capture Pipeline

**Feature**: 020-signal-voice-capture
**Inputs**: [spec.md](./spec.md), [plan.md](./plan.md), [data-model.md](./data-model.md), [contracts/](./contracts/)

<!-- Tech Stack Validation: PASSED -->
<!-- Validated against: .specswarm/tech-stack.md (asr-shim additions recorded 2026-06-11) -->
<!-- No prohibited technologies found -->

Tests accompany every phase (constitution P5). Spine: `bun test`. Shim: `uv run pytest`
with `FakeTranscriber` (never installs NeMo in CI). Surface: Vitest where practical.

## Phase 1: Setup

- [ ] T001 [US1] Create migration adding `extraction_failure_reason TEXT NOT NULL DEFAULT ''` to `capture_attachments` and `working_attachments`; verify it applies on a fresh and existing dev DB — spine/migrations/018_audio_transcription.sql
- [ ] T002 [P] [US1] Add `asr_model` / `asr_timeout_s` config keys (`[spine.qmd]`) with `getAsrModel()` and `getAsrTimeoutMs()` (default 300 s) beside `getOcrModel()`; document both in config.toml.example with the quickstart values — spine/src/config.ts
- [ ] T003 [P] [US1] Scaffold the asr-shim component: `pyproject.toml` (fastapi, uvicorn, python-multipart; `[nemo]` extra for `nemo_toolkit[asr]`), package skeleton `asr_shim/__init__.py`, README with install + llama-swap model entry from quickstart.md — asr-shim/

## Phase 2: Foundational

- [ ] T004 [US2] Extend the extraction queue lifecycle: `processOne()` sets `extraction_status = 'processing'` (clearing `extraction_failure_reason`) before extracting for ALL kinds; failure writes persist a reason; widen `sweepPending()` to re-enqueue `pending`, `processing` (crash-interrupted), and `failed` rows whose reason starts `transient:`; update existing extraction tests for the new intermediate state — spine/src/extraction-queue.ts
- [ ] T005 [P] [US3] Create posture-gated transcription event emitter mirroring archiveEvents.ts: `emitTranscriptionAttention(posture, { captureId, attachmentId, kind, excerpt })`, posture from `TRANSCRIPTION_NOTIFICATION_POSTURE` (quiet drops all; standard passes complete + failed_terminal; active passes everything), `onTranscriptionAttention` listener registry; unit tests — spine/src/transcriptionEvents.ts

## Phase 3: US1 - Spoken capture becomes a searchable transcript (P1, MVP)

Goal: a healthy-path voice note ends `done` with an indexed transcript (IN-1..4, AS-*, AC-*, RH-1/2/3/5, TX-8).
Independent test: send multipart audio through the fake-backed shim and a fake-fetch spine; phrase search returns the capture.

- [ ] T006 [P] [US1] Implement shim audio conversion: startup ffmpeg presence check (process exits non-zero if missing, AC-3); `normalize(bytes) -> wav path` via ffmpeg to mono 16 kHz s16 WAV; raise typed terminal errors `audio_undecodable` / `audio_empty` (AC-2/AC-4); pytest with a generated tone fixture plus garbage and empty inputs — asr-shim/asr_shim/convert.py, asr-shim/tests/test_convert.py
- [ ] T007 [P] [US1] Implement transcriber backends: `Transcriber` protocol; `NemoTranscriber` loading `nvidia/parakeet-tdt-0.6b-v2` at construction via `ASRModel.from_pretrained` and transcribing with `model.transcribe([wav])[0].text`; `FakeTranscriber` selected by `ASR_SHIM_FAKE=1` returning deterministic text — asr-shim/asr_shim/transcriber.py
- [ ] T008 [US1] Implement the FastAPI app per contracts/asr-shim.md: `POST /v1/audio/transcriptions` (multipart `file` + `model`, returns `{ "text": ... }`), `GET /health` (200 only after model load + ffmpeg check), OpenAI-shaped error responses with the contract's status table (AS-1/2/5/6); pytest contract tests via FakeTranscriber covering success, empty-audio 400, undecodable 400, missing-field 400 — asr-shim/asr_shim/main.py, asr-shim/asr_shim/errors.py, asr-shim/tests/test_api.py
- [ ] T009 [P] [US1] Implement the spine ASR client: multipart POST to `${getQmdBaseUrl()}/audio/transcriptions` with bearer key, `AbortSignal.timeout(getAsrTimeoutMs())`, error classification (network/timeout/408/429/5xx -> transient, other 4xx -> terminal), bounded in-job retries 3x with 2s/8s/30s backoff for transient; unit tests with a stubbed fetch — spine/src/transcribe.ts
- [ ] T010 [US1] Add the audio branch to `processOne()`: route `content_type` starting `audio/` to `transcribeAudio()` when `getAsrModel()` is set (else current behavior); on success insert `attachment_descriptions` row (kind/attachment_id, produced_text = final_text = transcript, model_id = asr model, supersedes prior unconfirmed head), snapshot `final_text` into `extracted_text`, set `done`, `writeAttachmentIndex` + `refreshIndex`, emit completion event; confirmed head row short-circuits with no ASR call (TX-7) — spine/src/extraction-queue.ts
- [ ] T011 [US1] Enqueue extraction from the signal attachment upload route after the durable write (`queueAttachment` with stored full path), closing the IN-4 gap; response still returns immediately after pending status is durable; route test asserts a signal-uploaded audio attachment reaches the queue — spine/src/routes/agent.ts
- [ ] T012 [US1] Integration test for the healthy path: signal-style upload -> `pending` -> `processing` -> `done` with stubbed transcribe; `attachment_descriptions` head row has model_id and confirmed = 0; `extracted_text` snapshot set; attachment-index markdown contains the transcript; SR-4 regression: capture with caption text + audio keeps both — spine/src/extraction-queue.test.ts (or spine/tests/)

**Checkpoint**: MVP - voice notes transcribe and search end-to-end.

## Phase 4: US2 - Durability under outage and crash (P2)

Goal: outages delay, never drop (TX-1..6, NF-2, IN-5).
Independent test: kill the fake AI server / the queue mid-job; everything reconciles.

- [ ] T013 [US2] Persist failure classes from the audio branch: transient exhaustion -> `failed` + `extraction_failure_reason = 'transient: ...'`; terminal -> `'terminal: ...'`; capture and prior extraction state untouched (IN-5); tests cover both classes and verify a terminal row is NOT re-enqueued by `sweepPending` — spine/src/extraction-queue.ts
- [ ] T014 [US2] Add `startTranscriptRetryLoop(db, attachmentsDir, intervalMs = 600_000)` re-enqueueing audio rows in `failed` with `transient:` reason; wire it in startup after `sweepPending`; test that a transient-failed row is retried and completes when the stub recovers — spine/src/extraction-queue.ts, spine/src/index.ts
- [ ] T015 [P] [US2] Crash-recovery test: seed a row stuck in `processing` (and one `pending`), run `sweepPending`, assert both re-enqueue and finish `done`; assert reason cleared on re-entry — spine/src/extraction-queue.test.ts

**Checkpoint**: durability semantics provable without real services.

## Phase 5: US3 - Failures surface as recoverable; completion notifies (P3)

Goal: NT-1..4, TX-6 surfacing.
Independent test: terminal-failed attachment shows reason + Retry in surface; completion toast appears and dismisses positively.

- [ ] T016 [US3] Add `POST /api/captures/:id/attachments/:attId/retry-extraction` per contracts/spine-api.md (404 unknown, 409 not-failed, resets to pending + clears reason + enqueues); include `extraction_status` and `extraction_failure_reason` in capture attachment list payloads where missing; route tests — spine/src/routes/attachments.ts
- [ ] T017 [US3] Bridge transcription events onto the existing capture SSE stream as `attachment_transcribed` / `attachment_extraction_failed` events (subscribe via `onTranscriptionAttention` in the stream handler, same teardown pattern as capture events); test event delivery shape — spine/src/routes/captures.ts
- [ ] T018 [P] [US3] Surface inbox attachment state: render pending/processing hint, transcript text when done, and failed state with human-readable reason plus a "Retry" action calling the retry endpoint (NT-4: recoverable, no guilt/overdue styling) — surface/src/components/home/InboxList.svelte (+ surface/src/lib/api/attachments.ts)
- [ ] T019 [P] [US3] Surface ephemeral completion toast from the `attachment_transcribed` SSE event: excerpt + positive dismissal verbs ("Open" / "Skip"), no "X", auto-expires, no persistent badge (NT-3); respects nothing arriving when spine posture is quiet — surface/src/components/home/HomeView.svelte (or shared toast component)

**Checkpoint**: failures and completions visible, retryable, posture-aware.

## Phase 6: US4 - User edits are protected (P4)

Goal: RH-4, TX-7 end-to-end.
Independent test: edit -> confirm -> forced retry leaves text unchanged.

- [ ] T020 [US4] Relax the description GET/PATCH gate to also accept audio attachments with a transcript row (keep `dark` behavior for images); PATCH on an audio transcript additionally refreshes the `extracted_text` snapshot and the index file; tests cover gate (audio done OK, image done still 409) and snapshot refresh — spine/src/routes/attachments.ts
- [ ] T021 [US4] Protection test: PATCH `confirmed: true`, then run retry-extraction and a re-queue; assert no new ASR call, no superseding row, text unchanged, status `done`; also assert unconfirmed re-run supersedes the old row preserving history — spine/src/routes/attachments.test.ts (or extraction queue tests)
- [ ] T022 [P] [US4] Surface transcript editing for audio attachments through the existing description edit affordance (edit final_text, confirm on save) labeled as a transcript — surface/src/components/home/InboxList.svelte (+ surface/src/lib/api/attachments.ts)

## Phase 7: Polish and cross-cutting

- [ ] T023 [US1] Capture deletion cleanup (NF-4): deleting a capture removes attachment files under the attachments dir, attachment-index markdown files, and `attachment_descriptions` rows, then `refreshIndex()`; test asserts no orphans remain — spine/src/routes/tasks.ts
- [ ] T024 [P] [US2] Relay bounded retry (SR-5): wrap `postCapture` / `postAttachment` with 3 attempts at 5s/15s/45s backoff for connection errors / 5xx; failure after retries keeps existing posture-gated failure reply; unit tests with a flaky stub server — spine/src/signal-relay.ts
- [ ] T025 [P] [US1] Docs: add `TRANSCRIPTION_NOTIFICATION_POSTURE` to the spine CLAUDE.md env table; verify quickstart.md commands against the implemented shim and config keys — spine/CLAUDE.md, specs/020-signal-voice-capture/quickstart.md

## Dependencies

```
T001 ──► T004 ──► T010 ──► T012,T013 ──► T014,T015
T002 ──► T009 ──► T010
T003 ──► T006,T007 ──► T008            (shim track: independent of spine track)
T005 ──► T010(emit), T017
T011 ──► T012
T016,T017 ──► T018,T019
T010 ──► T020 ──► T021,T022
T023,T024,T025: after their story phases; independent of each other
```

Story order: US1 (MVP) -> US2 -> US3 -> US4 -> polish. The shim track
(T003/T006/T007/T008) and the spine track (T001/T002/T004/T009...) run in
parallel until T012's integration test.

## Implementation strategy

MVP = Phase 1-3 (US1): voice note to searchable transcript on the happy path.
Each later phase is an independently testable increment; ship order matches
priority. Parallel opportunities: T002/T003 vs T001; T006/T007/T009 concurrently;
T018/T019 and T022 (surface) parallel to spine polish.
