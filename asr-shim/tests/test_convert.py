from __future__ import annotations

import os
import shutil
import wave

import pytest

from asr_shim.convert import (
    AudioEmpty,
    AudioUndecodable,
    cleanup,
    normalize,
    normalized,
)
from tests.conftest import tone_wav_bytes

requires_ffmpeg = pytest.mark.skipif(
    shutil.which("ffmpeg") is None, reason="ffmpeg not on PATH"
)


@requires_ffmpeg
def test_normalize_produces_mono_16k_s16_wav() -> None:
    out_path = normalize(tone_wav_bytes(seconds=1.0, rate=8000, channels=2))
    try:
        with wave.open(out_path, "rb") as wav:
            assert wav.getnchannels() == 1
            assert wav.getframerate() == 16000
            assert wav.getsampwidth() == 2
            # 1 second of audio resampled to 16 kHz, allow codec padding slack.
            assert abs(wav.getnframes() - 16000) < 1600
    finally:
        cleanup(out_path)
    assert not os.path.exists(out_path)


@requires_ffmpeg
def test_normalized_context_manager_deletes_output() -> None:
    with normalized(tone_wav_bytes()) as out_path:
        assert os.path.exists(out_path)
    assert not os.path.exists(out_path)


@requires_ffmpeg
def test_garbage_bytes_raise_audio_undecodable() -> None:
    with pytest.raises(AudioUndecodable):
        normalize(b"\x00\x01definitely not audio\xff\xfe" * 64)


def test_empty_bytes_raise_audio_empty() -> None:
    with pytest.raises(AudioEmpty):
        normalize(b"")


@requires_ffmpeg
def test_zero_duration_wav_raises_audio_empty() -> None:
    with pytest.raises(AudioEmpty):
        normalize(tone_wav_bytes(seconds=0.0))
