# asr-shim

OpenAI-compatible audio transcription shim for Lattice (spec 020). Exposes the
`/v1/audio/transcriptions` subset plus `/health`, normalizes any audio Signal
produces to mono 16 kHz s16 WAV via ffmpeg, and transcribes with NVIDIA NeMo
Parakeet. It sits behind llama-swap's `/v1` front door; the spine never talks
to it directly.

## Requirements

- Python 3.12+
- `ffmpeg` on PATH: the process exits non-zero at startup if it is missing
- For real transcription: a GPU host and the `nemo` extra (multi-GB install)

## Install and run

```bash
cd asr-shim
uv sync                      # fastapi, uvicorn, python-multipart (+ dev: pytest, httpx)
uv run uvicorn asr_shim.main:app --port 8090
```

For real ASR, install the NeMo extra (GPU host only; install torch first to
pin the CUDA runtime, see research D2):

```bash
uv sync --extra nemo
```

Smoke test:

```bash
curl -s http://127.0.0.1:8090/health
curl -s -F file=@note.m4a -F model=parakeet-tdt-0.6b-v3 \
  http://127.0.0.1:8090/v1/audio/transcriptions
# -> { "text": "..." }
```

## Dev mode without a GPU

`ASR_SHIM_FAKE=1` swaps in a deterministic fake transcriber so the endpoint
shape can be exercised without NeMo installed (this is what the tests use):

```bash
ASR_SHIM_FAKE=1 uv run uvicorn asr_shim.main:app --port 8090
```

The real model id defaults to `nvidia/parakeet-tdt-0.6b-v3` and can be
overridden with `ASR_SHIM_MODEL`.

## Tests

```bash
uv run pytest
```

Tests never install NeMo; ffmpeg-dependent tests skip when ffmpeg is absent.

## llama-swap model entry (GPU host)

The shim is deployed on the GPU host (e.g. under `/opt/asr-shim`) and
registered as a llama-swap model; llama-swap owns start/stop and idle
eviction (TTL), and routes on the multipart `model` field:

```yaml
models:
  "parakeet-tdt-0.6b-v3":
    cmd: |
      /opt/asr-shim/.venv/bin/uvicorn asr_shim.main:app --host 127.0.0.1 --port ${PORT}
    checkEndpoint: /health
    ttl: 600
```

`/health` returns 200 only after ffmpeg is verified and the model is loaded,
so llama-swap's `checkEndpoint` doubles as the readiness gate. Model load can
take 10-30 s plus checkpoint download on first run; raise llama-swap's global
`healthCheckTimeout` if needed.

## Errors

Errors use the OpenAI shape `{"error": {"message", "type", "code"}}`:

| Status | type | code | Meaning |
|--------|------|------|---------|
| 400 | `invalid_request_error` | `audio_undecodable` | ffmpeg could not decode the payload |
| 400 | `invalid_request_error` | `audio_empty` | empty file or zero-duration audio |
| 400 | `invalid_request_error` | null | malformed multipart, missing field |
| 500 | `server_error` | null | conversion/transcription crashed |
