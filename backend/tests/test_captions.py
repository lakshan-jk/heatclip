from pathlib import Path

import captions


def test_build_ass_structure(tmp_path):
    caps = [(0.0, 3.0, "hello world this is a test"), (3.2, 4.0, "of captions")]
    out = captions.build_ass(caps, 1080, 1920, tmp_path / "s.ass")
    txt = out.read_text()
    assert "[Script Info]" in txt
    assert "PlayResX: 1080" in txt and "PlayResY: 1920" in txt
    assert "Style: Pop" in txt
    # 6 words -> 2 chunks (3 each) for first line, "of captions" -> 1 chunk
    assert txt.count("Dialogue:") == 3
    assert "\\fad(" in txt  # pop animation


def test_chunks_uppercased_and_timed(tmp_path):
    out = captions.build_ass([(0.0, 2.0, "one two three four")], 1080, 1920, tmp_path / "s.ass")
    txt = out.read_text()
    assert "ONE TWO THREE" in txt and "FOUR" in txt
    # first chunk starts at 0
    assert "0:00:00.00" in txt


def test_empty_and_whitespace(tmp_path):
    out = captions.build_ass([(0.0, 1.0, "   "), (1.0, 2.0, "")], 1080, 1920, tmp_path / "s.ass")
    assert out.read_text().count("Dialogue:") == 0
