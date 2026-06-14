from __future__ import annotations

import shutil
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from tests.conftest import tone_wav_bytes

# App startup runs ensure_ffmpeg(), so every API test needs the binary.
pytestmark = pytest.mark.skipif(
    shutil.which("ffmpeg") is None, reason="ffmpeg not on PATH"
)


@pytest.fixture()
def client(monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    monkeypatch.setenv("ASR_SHIM_FAKE", "1")
    from asr_shim.main import app

    # Context entry runs the lifespan startup (ffmpeg check + fake transcriber).
    with TestClient(app) as test_client:
        yield test_client


def test_health_ok_after_startup(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_transcription_success(client: TestClient) -> None:
    response = client.post(
        "/v1/audio/transcriptions",
        files={"file": ("note.wav", tone_wav_bytes(), "audio/wav")},
        data={"model": "parakeet-tdt-0.6b-v3"},
    )
    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"text"}
    # FakeTranscriber: 1 s mono 16 kHz s16 = 32000 PCM bytes.
    assert body["text"] == "fake transcript (32000 bytes)"


def test_empty_file_returns_audio_empty(client: TestClient) -> None:
    response = client.post(
        "/v1/audio/transcriptions",
        files={"file": ("note.ogg", b"", "audio/ogg")},
        data={"model": "parakeet-tdt-0.6b-v3"},
    )
    assert response.status_code == 400
    error = response.json()["error"]
    assert error["type"] == "invalid_request_error"
    assert error["code"] == "audio_empty"
    assert isinstance(error["message"], str)


def test_garbage_bytes_return_audio_undecodable(client: TestClient) -> None:
    response = client.post(
        "/v1/audio/transcriptions",
        files={"file": ("note.m4a", b"\x00\x01not audio\xff" * 64, "audio/mp4")},
        data={"model": "parakeet-tdt-0.6b-v3"},
    )
    assert response.status_code == 400
    error = response.json()["error"]
    assert error["type"] == "invalid_request_error"
    assert error["code"] == "audio_undecodable"


def test_missing_model_field_returns_invalid_request(client: TestClient) -> None:
    response = client.post(
        "/v1/audio/transcriptions",
        files={"file": ("note.wav", tone_wav_bytes(), "audio/wav")},
    )
    assert response.status_code == 400
    error = response.json()["error"]
    assert error["type"] == "invalid_request_error"
    assert error["code"] is None
    assert "model" in error["message"]


def test_missing_file_field_returns_invalid_request(client: TestClient) -> None:
    response = client.post(
        "/v1/audio/transcriptions",
        data={"model": "parakeet-tdt-0.6b-v3"},
    )
    assert response.status_code == 400
    error = response.json()["error"]
    assert error["type"] == "invalid_request_error"
    assert "file" in error["message"]
