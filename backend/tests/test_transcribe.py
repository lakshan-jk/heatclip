import transcribe


def test_disabled_returns_empty(monkeypatch):
    # With Whisper disabled, transcribe is a no-op (no model download).
    monkeypatch.setattr(transcribe, "_ENABLED", False)
    assert transcribe.available() is False
    assert transcribe.transcribe("/does/not/exist.wav") == []
