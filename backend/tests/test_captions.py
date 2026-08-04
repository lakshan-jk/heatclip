import captions


def test_words_from_lines():
    words = captions.words_from_lines([(0.0, 2.0, "one two three four")])
    assert len(words) == 4
    assert words[0][2] == "one" and words[0][0] == 0.0
    assert words[-1][2] == "four"


def test_build_ass_karaoke(tmp_path):
    words = [
        (0.0, 0.5, "hello"), (0.5, 1.0, "world"), (1.0, 1.5, "this"),
        (1.5, 2.0, "is"), (2.0, 2.5, "a"), (2.5, 3.0, "test"),
    ]
    out = captions.build_ass(words, 1080, 1920, tmp_path / "s.ass", theme="karaoke")
    txt = out.read_text()
    assert "[Script Info]" in txt and "Style: Cap" in txt
    assert "\\k" in txt  # per-word karaoke timing tags
    assert "HELLO" in txt and "TEST" in txt


def test_build_ass_classic_is_line_pop(tmp_path):
    words = [(0.0, 0.5, "hello"), (0.5, 1.0, "world")]
    out = captions.build_ass(words, 1080, 1920, tmp_path / "s.ass", theme="classic")
    txt = out.read_text()
    assert "\\fad(" in txt  # line pop
    assert "\\k" not in txt


def test_all_themes_present():
    for t in ["classic", "karaoke", "hormozi", "neon", "minimal"]:
        assert t in captions.THEMES


def test_empty_words(tmp_path):
    out = captions.build_ass([], 1080, 1920, tmp_path / "s.ass", theme="karaoke")
    assert out.read_text().count("Dialogue:") == 0
