"""FastAPI app: OpenAI-compatible transcription subset (contracts/asr-shim.md).

Routes:
- POST /v1/audio/transcriptions: multipart `file` + `model` -> {"text": ...}
- GET /health: 200 {"status":"ok"} once ffmpeg is verified and the model loaded

Startup fails hard (process exits non-zero) if ffmpeg is missing (AC-3) or the
model cannot load (AS-4); uvicorn only starts accepting requests after the
lifespan startup block completes.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, Form, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, Response

from . import convert, errors
from .transcriber import Transcriber, build_transcriber


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    convert.ensure_ffmpeg()
    app.state.transcriber = build_transcriber()
    app.state.ready = True
    yield


app = FastAPI(title="asr-shim", lifespan=lifespan)


@app.exception_handler(RequestValidationError)
async def on_validation_error(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    # Contract: malformed multipart / missing field -> 400 invalid_request_error
    # (FastAPI's default would be 422 with a different shape).
    detail = "; ".join(
        f"{'.'.join(str(part) for part in err['loc'])}: {err['msg']}"
        for err in exc.errors()
    )
    return errors.invalid_request(detail or "invalid request")


@app.get("/health")
def health(request: Request) -> JSONResponse:
    if not getattr(request.app.state, "ready", False):
        return JSONResponse(status_code=503, content={"status": "loading"})
    return JSONResponse(content={"status": "ok"})


@app.post("/v1/audio/transcriptions")
def create_transcription(
    request: Request,
    file: UploadFile = File(...),
    # Required by the contract; llama-swap routes on it, the shim ignores it.
    model: str = Form(...),
) -> Response:
    transcriber: Transcriber = request.app.state.transcriber
    data = file.file.read()

    try:
        wav_path = convert.normalize(data)
    except convert.AudioUndecodable as exc:
        return errors.invalid_request(str(exc), code="audio_undecodable")
    except convert.AudioEmpty as exc:
        return errors.invalid_request(str(exc), code="audio_empty")
    except Exception as exc:
        return errors.server_error(f"audio conversion failed: {exc}")

    try:
        text = transcriber.transcribe(wav_path)
    except Exception as exc:
        return errors.server_error(f"transcription failed: {exc}")
    finally:
        convert.cleanup(wav_path)

    return JSONResponse(content={"text": text})
