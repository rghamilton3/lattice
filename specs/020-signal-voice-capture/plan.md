# Implementation Plan: Signal Voice Capture Pipeline

**Feature**: 020-signal-voice-capture
**Spec**: [spec.md](./spec.md)
**Inputs**: [research.md](./research.md), [data-model.md](./data-model.md),
[contracts/asr-shim.md](./contracts/asr-shim.md),
[contracts/spine-api.md](./contracts/spine-api.md)

## Summary

Signal voice notes already arrive as captures with audio attachments (spec 007) but
stay content-dark forever. This feature: (1) makes the signal-upload route enqueue
extraction, (2) adds an audio branch to the existing extraction queue that calls a
new OpenAI-compatible ASR shim through llama-swap's `/v1` front door, (3) stores
the transcript with the spec-017 `attachment_descriptions` confirmed/provenance
pattern and indexes it, (4) adds durable retry semantics
(`processing` state + `extraction_failure_reason` + transient retry loop),
(5) surfaces completion/failure as posture-gated ephemeral events with a manual
retry endpoint, and (6) closes the capture-deletion orphan gap (NF-4).

## Technical Context

| Aspect | Value |
|--------|-------|
| Spine | TypeScript 6 / Bun 1.3 / Elysia 1.4, `bun:sqlite`, migrations in `spine/migrations/` |
| Surface | SvelteKit 2.57 / Svelte 5 runes / Tailwind 4 |
| New component | `asr-shim/` - Python 3.12, FastAPI + uvicorn + python-multipart, NeMo `nemo_toolkit['asr']` 2.7.x, ffmpeg binary |
| ASR model | `nvidia/parakeet-tdt-0.6b-v2` (research D1), id configurable via `asr_model` |
| Front door | llama-swap `/v1` (`getQmdBaseUrl()`); llama-swap proxies `/v1/audio/transcriptions` with multipart model routing (research D4) |
| Tests | `bun test` (spine), pytest with fake transcriber (shim), existing relay tests extended |

## Constitution Check

- **P1 (TypeScript for web source)**: PASS - all spine/surface changes are TS; the
  shim is Python in a new top-level `asr-shim/` component, outside `spine/src` /
  `surface/src` (same standing as the Rust agent).
- **P2 (QMD normalization)**: PASS - transcripts enter search through
  `writeAttachmentIndex` + `refreshIndex`, the existing normalized chokepoint; no
  new `structuredSearch` call sites.
- **P3 (spine localhost only)**: PASS - spine makes an outbound call to llama-swap
  inside the mesh; no new listener, no agent-facing AI surface (NF-3).
- **P4 (capture is one motion)**: PASS - ingestion returns before transcription;
  no decision is ever demanded of the user (IN-4, RH-6).
- **P5 (tests accompany features)**: planned per phase below.
- **P6 (no em dashes)**: applies to all authored output.

## Tech Stack Compliance Report

### Approved (already in stack)
Elysia, bun:sqlite, Bun test, SvelteKit/Svelte 5, Tailwind, existing spine fetch
patterns to the `/v1` front door.

### New technologies (added to tech-stack.md user-additions)
- **Python 3.12 + FastAPI + uvicorn + python-multipart** - `asr-shim/` only; new
  monorepo component, never imported by spine/surface.
- **nemo_toolkit['asr'] 2.7.x (NVIDIA NeMo) + torch** - shim backend (clarified
  2026-06-11); deployed on the GPU host, not in spine CI. Install torch first;
  watch the `numpy<2` pin (research D2).
- **ffmpeg (binary)** - shim runtime requirement, startup-verified (AC-3).

No conflicts: nothing else in the stack serves ASR. No prohibited technologies
touched (no new JS source, no non-localhost spine binding, no un-normalized
structuredSearch).

## Structure of Changes

### New component: `asr-shim/`

```
asr-shim/
  pyproject.toml            # fastapi, uvicorn, python-multipart; [nemo] extra: nemo_toolkit[asr]
  README.md                 # install, llama-swap entry, GPU-host deploy notes
  asr_shim/
    __init__.py
    main.py                 # FastAPI app: POST /v1/audio/transcriptions, GET /health
    convert.py              # ffmpeg presence check + normalize to mono 16k s16 WAV
    transcriber.py          # Transcriber protocol; NemoTranscriber; FakeTranscriber (ASR_SHIM_FAKE)
    errors.py               # OpenAI-shaped error responses (audio_undecodable, audio_empty, server_error)
  tests/
    test_convert.py         # ffmpeg normalize on a generated tone; undecodable/empty -> terminal errors
    test_api.py             # multipart contract via FakeTranscriber; health; error shapes
```

Behavior per contracts/asr-shim.md: model loads at startup (AS-4), ffmpeg absence
is a startup failure (AC-3), terminal vs transient statuses per the table (AS-6,
AC-4). NeMo call: `model.transcribe([wav_path])[0].text` (research D2).

### Spine changes (`spine/`)

| File | Change |
|------|--------|
| `migrations/018_audio_transcription.sql` | NEW: `extraction_failure_reason` on `capture_attachments` + `working_attachments` (data-model.md) |
| `src/config.ts` | `asr_model` / `asr_timeout_s` config keys; `getAsrModel()`, `getAsrTimeoutMs()` beside `getOcrModel()` |
| `src/transcribe.ts` | NEW: multipart POST to `${getQmdBaseUrl()}/audio/transcriptions`; classify errors transient/terminal per contract; bounded in-job retries 3x (2s/8s/30s) |
| `src/extraction-queue.ts` | set `processing` at start of `processOne` (all kinds); audio branch -> `transcribeAudio()`: confirmed-transcript short-circuit (TX-7), insert `attachment_descriptions` row with supersedes chain, snapshot `extracted_text`, mark `done`, index, emit event; failure writes `extraction_failure_reason`; `sweepPending` widened to `pending` + `processing` + `failed` with `transient:` reason; export `startTranscriptRetryLoop()` (10 min interval) |
| `src/transcriptionEvents.ts` | NEW: posture-gated emitter mirroring `archiveEvents.ts` (`TRANSCRIPTION_NOTIFICATION_POSTURE`) |
| `src/routes/agent.ts` | signal attachment upload now calls `queueAttachment(...)` after durable write (IN-4 gap) |
| `src/routes/attachments.ts` | relax description GET/PATCH gate for audio attachments (transcript view/edit/confirm); PATCH refreshes `extracted_text` snapshot for audio; NEW `POST /api/captures/:id/attachments/:attId/retry-extraction` |
| `src/routes/captures.ts` (SSE) | bridge transcription events onto `GET /api/captures/stream` |
| capture delete path (`src/routes/tasks.ts`) | delete attachment files, attachment-index md, `attachment_descriptions` rows (NF-4) |
| `src/index.ts` | start transient-retry loop after `sweepPending` |
| `src/signal-relay.ts` | bounded retry (3x, 5s/15s/45s) around `postCapture` / `postAttachment` (SR-5, research D8) |

### Surface changes (`surface/`)

Minimal v1 (spec assumption): inbox attachment view renders transcription state
(`pending`/`processing` spinner-less hint, transcript text when `done`, failure
reason + "Retry" verb when `failed`), transcript editing via the existing
description edit affordance (PATCH confirms), ephemeral toast on
`attachment_transcribed` SSE event with positive dismissal verbs (NT-3). No audio
player UI.

### Config / docs

- `config.toml.example`: `asr_model`, `asr_timeout_s` under `[spine.qmd]`.
- `Justfile`: no change required (shim is GPU-host deployed); shim tests runnable
  via `cd asr-shim && uv run pytest`.
- `spine/CLAUDE.md` env table: `TRANSCRIPTION_NOTIFICATION_POSTURE`.

## Phases

1. **Schema + config**: migration 018, config keys, `getAsrModel()` (tests:
   migration applies, config parse).
2. **ASR shim**: convert.py -> transcriber.py -> main.py + pytest suite (fake
   transcriber; ffmpeg tone fixture). Independent of spine phases.
3. **Spine transcription core**: transcribe.ts client + extraction-queue audio
   branch + processing state + sweep widening + retry loop (tests: fake fetch shim;
   lifecycle pending->processing->done; transient vs terminal; confirmed
   short-circuit; crash-sweep).
4. **Ingestion + routes**: agent.ts enqueue, description gate relaxation, retry
   endpoint, deletion cleanup, SSE bridge + transcriptionEvents (route tests).
5. **Relay retry**: bounded backoff in signal-relay.ts (unit tests).
6. **Surface**: attachment transcription state + edit/confirm + retry + toast
   (Vitest where practical).
7. **Docs/config examples + quickstart verification.**

Parallelizable: phase 2 (shim, Python) is fully independent of phases 3-6 (spine
TS); phase 1 blocks 3-4; phase 5 and 6 only depend on contracts.

## Risks

- NeMo dependency weight / numpy pin: contained to GPU host; shim CI uses the fake
  transcriber so repo CI never installs NeMo.
- llama-swap cold start can exceed naive timeouts: spine uses `asr_timeout_s`
  (default 300 s) for this call type only.
- Widening `sweepPending` to retry `transient:` failures must not re-run terminal
  failures (guard on reason prefix; tested).
- Relaxing the description-route gate must not regress image-description flows
  (gate change is additive: `dark` OR audio; tested).
