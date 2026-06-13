# Contract: ASR Shim (OpenAI-compatible transcription subset)

The only transcription contract the spine knows (AS-1, AS-2). The shim sits behind
llama-swap's `/v1` front door; the spine never addresses it directly.

## POST /v1/audio/transcriptions

Request: `multipart/form-data`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `file` | binary part | yes | raw attachment bytes as received from Signal (Opus/AAC/M4A/OGG/WAV); filename and part content-type are advisory only - the shim sniffs via ffmpeg |
| `model` | text part | yes | ASR model id; llama-swap routes on this field |

Success response: `200 application/json`

```json
{ "text": "transcribed content" }
```

- `text` is the full transcript, plain UTF-8. No confidence, no timestamps (AS-7).
- Empty/silence audio that decodes successfully returns `200` with `{ "text": "" }`.

Error responses (OpenAI error shape, AS-6):

```json
{ "error": { "message": "<detail>", "type": "<type>", "code": "<code>" } }
```

| Status | Meaning | Spine classification (TX-6) |
|--------|---------|------------------------------|
| 400 `invalid_request_error`, code `audio_undecodable` | ffmpeg could not decode the payload | terminal |
| 400 `invalid_request_error`, code `audio_empty` | zero-length file or zero-duration audio | terminal |
| 400 `invalid_request_error` (other) | malformed multipart, missing field | terminal |
| 429 | backpressure | transient |
| 500 `server_error` | transcription/conversion crashed | transient |
| 503 | model not ready | transient |

Spine-side classification rule: network error, timeout, 408, 429, and all 5xx are
`transient:`; every other 4xx is `terminal:`.

## GET /health

- `200 {"status":"ok"}` once the NeMo model is loaded and ffmpeg verified.
- Non-200 / connection refused while loading. llama-swap uses this as its
  readiness check (`checkEndpoint`, AS-5).

## Behavior requirements

- Model loads at process start (AS-4); the process exits non-zero at startup if
  ffmpeg is absent (AC-3) or the model cannot load.
- Conversion: input bytes -> ffmpeg -> mono 16 kHz 16-bit PCM WAV -> NeMo
  Parakeet EN -> text (AC-1, AC-2).
- Stateless per request; no idle eviction logic in the shim - llama-swap owns
  start/stop and TTL (AS-4).
- Not implemented (out of contract): `/v1/audio/translations`, streaming,
  `response_format` other than default json, timestamp granularities (AS-2).

## Spine call site

`spine/src/transcribe.ts` (new): `POST ${getQmdBaseUrl()}/audio/transcriptions`
with bearer key, multipart body, `AbortSignal.timeout(asr_timeout_s * 1000)`
(default 300 s - audio is minutes long and llama-swap may cold-start the shim).
