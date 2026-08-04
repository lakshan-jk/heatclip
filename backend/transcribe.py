"""Whisper transcription fallback (faster-whisper) — used when a video has no
YouTube captions, so captions still work on any video.

Transcribes a short audio/video file into caption segments. The model is
lazy-loaded and cached process-wide; any failure degrades to no captions.
"""
from __future__ import annotations

import os
import threading

_MODEL = None
_LOCK = threading.Lock()
_MODEL_SIZE = os.environ.get("WHISPER_MODEL", "base")  # tiny|base|small|medium
_ENABLED = os.environ.get("WHISPER_ENABLED", "1") != "0"


def available() -> bool:
    return _ENABLED


def _get_model():
    global _MODEL
    if _MODEL is None:
        with _LOCK:
            if _MODEL is None:
                from faster_whisper import WhisperModel

                _MODEL = WhisperModel(_MODEL_SIZE, device="cpu", compute_type="int8")
    return _MODEL


def transcribe(path) -> list[tuple[float, float, str]]:
    """Return WORD-level [(start, end, word)] relative to the file's own timeline
    (for karaoke captions). Falls back to segment text if word timing is absent."""
    if not _ENABLED:
        return []
    try:
        model = _get_model()
        segments, _info = model.transcribe(
            str(path), vad_filter=True, word_timestamps=True
        )
        words: list[tuple[float, float, str]] = []
        for seg in segments:
            segwords = getattr(seg, "words", None)
            if segwords:
                for w in segwords:
                    if w.word and w.word.strip():
                        words.append((float(w.start), float(w.end), w.word.strip()))
            elif seg.text and seg.text.strip():
                words.append((float(seg.start), float(seg.end), seg.text.strip()))
        return words
    except Exception:  # noqa: BLE001 - never fail a render over transcription
        return []
