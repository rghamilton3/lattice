# Research: Signal Voice Capture Pipeline

## D1. ASR checkpoint

- **Decision**: `nvidia/parakeet-tdt-0.6b-v2` (English-only, 600M FastConformer-TDT).
- **Rationale**: canonical English checkpoint in NeMo docs; outputs punctuation and
  capitalization automatically; model card input contract is exactly what the shim
  normalizes to (16 kHz mono WAV). Spec scope is English-only (NF-1), so the
  multilingual v3 buys nothing.
- **Alternatives**: `parakeet-tdt-0.6b-v3` (multilingual, swap-in later via config -
  same id plumbing); `parakeet-unified-en-0.6b` (adds streaming, out of scope per
  NF-1).

## D2. ASR backend

- **Decision**: NVIDIA NeMo (`nemo_toolkit['asr']`, 2.7.x) per clarification
  2026-06-11.
- **Rationale**: first-party Parakeet support, simplest correct loading
  (`ASRModel.from_pretrained`), and llama-swap owns start/stop so cold-start cost
  (multi-GB venv, ~10-30 s model init) is paid only when transcription is actually
  requested (`healthCheckTimeout` accommodates it).
- **Constraints found**: Python 3.10+ (3.12 recommended); install torch first to pin
  the CUDA runtime; `nemo-toolkit[asr]` may pin `numpy<2.0` (NeMo issue #14505) -
  verify at install time. ~24 min single-pass audio limit on large GPUs; Signal
  voice notes are minutes long, so no chunking in v1 (AC-4 covers garbage input,
  not length).
- **API**: `model.transcribe([wav_path])[0].text` (NeMo 2.x returns Hypothesis
  objects with `.text`).
- **Alternatives**: sherpa-onnx (lighter, faster cold start) - rejected by
  clarification; remains the designated swap target behind the unchanged contract
  (AS-3).

## D3. Shim HTTP framework

- **Decision**: FastAPI + uvicorn + python-multipart, in a new top-level
  `asr-shim/` directory with `pyproject.toml` (uv-compatible).
- **Rationale**: smallest mainstream stack for one multipart endpoint plus a health
  route; trivially testable with a fake transcriber injected in place of NeMo (keeps
  CI free of the multi-GB dependency). The shim is a fourth monorepo component, not
  part of spine (constitution P1 applies only to `spine/src` / `surface/src`).
- **Alternatives**: plain `http.server` (multipart parsing by hand - error-prone);
  Flask (no async, no typed validation).

## D4. llama-swap integration

- **Decision**: register the shim as a llama-swap model entry; spine keeps calling
  the single `/v1` front door (`getQmdBaseUrl()`).
- **Facts confirmed** (README + config.example.yaml, current releases v211+):
  - llama-swap manages arbitrary OpenAI-compatible upstreams: per-model keys `cmd`,
    `proxy` (default `http://localhost:${PORT}`), `checkEndpoint` (default
    `/health`, polled until HTTP 200), `ttl` (idle eviction seconds), `aliases`,
    `env`, `concurrencyLimit`; global `healthCheckTimeout` (default 120 s),
    `startPort`, `globalTTL`.
  - `/v1/audio/transcriptions` is proxied with the `model` extracted from the
    multipart form (`proxyOAIPostFormHandler`), so routing-by-model works for this
    endpoint exactly like chat/embeddings (AS shim reachable through the same door,
    NF-3).
- **Example entry** (documented in quickstart, deployed on the GPU host):

  ```yaml
  models:
    "parakeet-tdt-0.6b-v2":
      cmd: |
        /opt/asr-shim/.venv/bin/uvicorn asr_shim.main:app --host 127.0.0.1 --port ${PORT}
      checkEndpoint: /health
      ttl: 600
  ```

## D5. ffmpeg normalization

- **Decision**: shim shells out to ffmpeg:
  `ffmpeg -i <input> -ac 1 -ar 16000 -sample_fmt s16 -f wav <tmp.wav>` with stdin
  bytes or temp input file; startup verifies `ffmpeg -version` exits 0 (AC-3).
- **Terminal classification** (AC-4): ffmpeg non-zero exit -> 400
  `audio_undecodable`; decoded duration 0 or empty input -> 400 `audio_empty`.
- **Alternatives**: pyAV/librosa decoding in-process - heavier wheels, worse codec
  coverage than the ffmpeg binary that llama-swap hosts already carry.

## D6. Spine retry/durability model

- **Decision**: extend `extraction-queue.ts` rather than add a new queue: audio
  branches to a `transcribeAudio()` path inside `processOne()`; serial promise-chain
  concurrency (= 1) satisfies TX-8. Transient failures retry in-job 3x
  (2s/8s/30s), then persist `failed` + `transient: <reason>`; a 10-minute interval
  loop re-enqueues transient-failed audio rows (mirrors the embedding backfill loop
  from spec 016); startup sweep re-enqueues `pending`, `processing`, and
  `transient:`-failed rows (TX-3/TX-5).
- **Rationale**: keeps one extraction model (TX-1/TX-2), reuses the startup-drain
  guarantee, and the `processing` state (clarification 2026-06-11) makes
  crash-interrupt visible across all extraction types.
- **Alternatives**: separate audio queue (second mechanism, rejected); broker
  (explicitly out per TX-2).

## D7. Notification path

- **Decision**: new `transcriptionEvents.ts` mirroring `archiveEvents.ts`
  (posture-gated emitter), bridged onto the existing capture SSE stream for an
  ephemeral surface toast. Signal-reply on completion is NOT in v1: the relay is a
  separate process holding the signal-cli socket, and the spine cannot send Signal
  messages; posture-aware notification therefore lives spine/surface-side (NT-1/NT-2
  satisfied through the existing posture pattern, not a new channel).
- **Alternatives**: spine->relay callback channel for Signal replies - new IPC
  surface for marginal value; revisit if ephemeral surface toasts prove
  insufficient.

## D8. Relay spooling (SR-5)

- **Decision**: bounded in-memory retry (3 attempts, 5s/15s/45s backoff) around
  `postCapture`/`postAttachment` in the relay; signal-cli's attachment directory is
  the durable byte store. A failure after retries logs loudly and sends a
  posture-gated failure reply (existing behavior).
- **Rationale**: "momentarily unavailable" (SR-5) is covered by bounded retry;
  a durable on-disk envelope spool is real scope (crash-safe journal, replay
  ordering) disproportionate to a self-hosted single-user relay whose spine sits on
  the same host. Documented as a known limit.

## All NEEDS CLARIFICATION resolved

Spec clarifications (session 2026-06-11) resolved status enum, transcript
provenance, and backend choice; this document resolves the remaining technical
unknowns (D1-D8). None outstanding.
