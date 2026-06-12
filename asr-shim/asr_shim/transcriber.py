"""Transcriber backends: real NeMo Parakeet and a deterministic fake.

The fake (ASR_SHIM_FAKE=1) keeps CI and local dev free of the multi-GB NeMo
dependency while exercising the full HTTP contract (research D3).
"""

from __future__ import annotations

import os
import wave
from typing import Protocol

DEFAULT_MODEL_ID = "nvidia/parakeet-tdt-0.6b-v2"


class Transcriber(Protocol):
    def transcribe(self, wav_path: str) -> str: ...


class NemoTranscriber:
    """Loads the Parakeet checkpoint at construction (AS-4, process start)."""

    def __init__(self, model_id: str | None = None) -> None:
        # Lazy import: the fake path must never need nemo installed.
        import nemo.collections.asr as nemo_asr

        resolved = model_id or os.environ.get("ASR_SHIM_MODEL", DEFAULT_MODEL_ID)
        self._model = nemo_asr.models.ASRModel.from_pretrained(model_name=resolved)

    def transcribe(self, wav_path: str) -> str:
        # NeMo 2.x returns Hypothesis objects with .text (research D2).
        return self._model.transcribe([wav_path])[0].text


class FakeTranscriber:
    """Deterministic transcript derived from the normalized WAV's PCM size."""

    def transcribe(self, wav_path: str) -> str:
        with wave.open(wav_path, "rb") as wav:
            pcm_bytes = wav.getnframes() * wav.getnchannels() * wav.getsampwidth()
        return f"fake transcript ({pcm_bytes} bytes)"


def build_transcriber() -> Transcriber:
    if os.environ.get("ASR_SHIM_FAKE") == "1":
        return FakeTranscriber()
    return NemoTranscriber()
