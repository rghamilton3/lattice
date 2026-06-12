"""Audio normalization via the ffmpeg binary.

Input bytes in any container/codec Signal produces (Opus/AAC/M4A/OGG/WAV) are
converted to mono 16 kHz 16-bit PCM WAV, the input contract for Parakeet
(research D1/D5). Format detection is left entirely to ffmpeg; filenames and
content types from the request are advisory only.
"""

from __future__ import annotations

import contextlib
import os
import subprocess
import tempfile
import wave
from collections.abc import Iterator


class AudioUndecodable(Exception):
    """ffmpeg could not decode the payload (terminal, AC-4)."""


class AudioEmpty(Exception):
    """Zero-length input or zero-duration decoded audio (terminal, AC-4)."""


def ensure_ffmpeg() -> None:
    """Verify ffmpeg is on PATH and runs; raise RuntimeError otherwise (AC-3)."""
    try:
        result = subprocess.run(
            ["ffmpeg", "-version"], capture_output=True, check=False
        )
    except OSError as exc:
        raise RuntimeError(f"ffmpeg not found on PATH: {exc}") from exc
    if result.returncode != 0:
        raise RuntimeError(f"'ffmpeg -version' exited with {result.returncode}")


def cleanup(path: str) -> None:
    """Best-effort removal of a temp file produced by normalize()."""
    with contextlib.suppress(FileNotFoundError):
        os.unlink(path)


def normalize(data: bytes) -> str:
    """Convert raw audio bytes to a mono 16 kHz s16 WAV temp file.

    Returns the path to the output WAV. The caller owns deletion of the
    returned file (use cleanup() or the normalized() context manager).

    Raises AudioEmpty for empty input or zero-duration decoded audio, and
    AudioUndecodable when ffmpeg cannot decode the payload.
    """
    if not data:
        raise AudioEmpty("input file is empty")

    in_fd, in_path = tempfile.mkstemp(prefix="asr-shim-in-")
    out_fd, out_path = tempfile.mkstemp(prefix="asr-shim-out-", suffix=".wav")
    os.close(out_fd)
    try:
        with os.fdopen(in_fd, "wb") as in_file:
            in_file.write(data)

        result = subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-i",
                in_path,
                "-ac",
                "1",
                "-ar",
                "16000",
                "-sample_fmt",
                "s16",
                "-f",
                "wav",
                out_path,
            ],
            capture_output=True,
            check=False,
        )
        if result.returncode != 0:
            stderr = result.stderr.decode("utf-8", errors="replace").strip()
            # Keep only the last line: ffmpeg's final error summary.
            detail = stderr.splitlines()[-1] if stderr else "unknown ffmpeg error"
            raise AudioUndecodable(f"ffmpeg could not decode the audio: {detail}")

        if os.path.getsize(out_path) == 0:
            raise AudioEmpty("decoded audio has zero duration")
        with wave.open(out_path, "rb") as wav:
            if wav.getnframes() == 0:
                raise AudioEmpty("decoded audio has zero duration")

        return out_path
    except BaseException:
        cleanup(out_path)
        raise
    finally:
        cleanup(in_path)


@contextlib.contextmanager
def normalized(data: bytes) -> Iterator[str]:
    """Context-managed normalize(): yields the WAV path, deletes it on exit."""
    path = normalize(data)
    try:
        yield path
    finally:
        cleanup(path)
