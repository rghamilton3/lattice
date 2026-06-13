# Quickstart: Signal Voice Capture Pipeline

## Run the shim locally

```bash
cd asr-shim
uv sync                      # installs fastapi/uvicorn/python-multipart (+ nemo extra for real use)
uv run uvicorn asr_shim.main:app --port 8090
# requires ffmpeg on PATH; exits non-zero at startup if missing
```

Smoke test:

```bash
curl -s http://127.0.0.1:8090/health
curl -s -F file=@note.m4a -F model=parakeet-tdt-0.6b-v2 \
  http://127.0.0.1:8090/v1/audio/transcriptions
# -> { "text": "..." }
```

Dev mode without a GPU: `ASR_SHIM_FAKE=1` serves a deterministic fake transcriber
(used by tests) so the endpoint shape can be exercised without NeMo installed.

## Register with llama-swap (GPU host)

```yaml
models:
  "parakeet-tdt-0.6b-v2":
    cmd: |
      /opt/asr-shim/.venv/bin/uvicorn asr_shim.main:app --host 127.0.0.1 --port ${PORT}
    checkEndpoint: /health
    ttl: 600
```

## Configure the spine

`~/.config/lattice/config.toml`:

```toml
[spine.qmd]
embed_api_url   = "http://gpu-host:8080/v1"   # existing front door
# ...existing embed/rerank/expand keys...
asr_model       = "parakeet-tdt-0.6b-v2"
asr_timeout_s   = 300
```

Transcription is off until `asr_model` is set; audio attachments then index
filename-only as before.

## End-to-end check

1. `bun run relay` + `bun run dev` (spine) with Signal configured per spec 007.
2. Send a Note-to-Self voice note.
3. Inbox shows the capture with `[voice note]` placeholder; attachment status
   `pending` -> `processing` -> `done`.
4. Search a phrase you spoke; the capture is returned.
5. Edit the transcript in the inbox attachment view; PATCH sets `confirmed`;
   `POST .../retry-extraction` afterwards must NOT change the text (TX-7/RH-4).
6. Stop llama-swap, send another voice note: capture lands, status eventually
   `failed` with `transient: ...`; restart llama-swap; the 10-minute retry loop (or
   spine restart) completes it.
