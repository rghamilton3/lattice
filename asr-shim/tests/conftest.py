from __future__ import annotations

import io
import math
import struct
import wave


def tone_wav_bytes(
    seconds: float = 1.0,
    rate: int = 8000,
    channels: int = 2,
    freq: float = 440.0,
) -> bytes:
    """Generate a WAV file in memory: a sine tone, stereo 8 kHz by default so
    that normalization to mono 16 kHz is observable."""
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wav:
        wav.setnchannels(channels)
        wav.setsampwidth(2)
        wav.setframerate(rate)
        frame_count = int(seconds * rate)
        samples = (
            int(20000 * math.sin(2 * math.pi * freq * i / rate))
            for i in range(frame_count)
        )
        wav.writeframes(
            b"".join(struct.pack("<h", value) * channels for value in samples)
        )
    return buf.getvalue()
