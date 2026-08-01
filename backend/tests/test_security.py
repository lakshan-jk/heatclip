import pytest

import security


@pytest.mark.parametrize(
    "url",
    [
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "https://youtu.be/dQw4w9WgXcQ",
        "http://m.youtube.com/watch?v=x",
        "music.youtube.com/watch?v=x",
    ],
)
def test_valid_youtube_urls(url):
    assert "youtu" in security.validate_youtube_url(url)


@pytest.mark.parametrize(
    "url",
    [
        "http://169.254.169.254/latest/meta-data/",  # SSRF cloud metadata
        "https://evil.com/watch?v=x",
        "file:///etc/passwd",
        "ftp://youtube.com/x",
        "",
        "x" * 400,
        "http://localhost:8009/",
    ],
)
def test_rejects_non_youtube(url):
    with pytest.raises(security.ValidationError):
        security.validate_youtube_url(url)


class _C:
    def __init__(self, s, e):
        self.start, self.end = s, e


def test_validate_clips_ok():
    security.validate_clips([_C(0, 20), _C(30, 45)], max_clips=6)


def test_validate_clips_rejects():
    with pytest.raises(security.ValidationError):
        security.validate_clips([], 6)
    with pytest.raises(security.ValidationError):
        security.validate_clips([_C(0, 20)] * 8, 6)  # too many
    with pytest.raises(security.ValidationError):
        security.validate_clips([_C(10, 5)], 6)  # end<=start
    with pytest.raises(security.ValidationError):
        security.validate_clips([_C(0, 700)], 6)  # too long


def test_enforce_plan_clamps():
    assert security.enforce_plan("free", "4k", True) == ("1080p", False, 6)
    assert security.enforce_plan("creator", "4k", True) == ("2k", True, 20)
    assert security.enforce_plan("admin", "4k", True) == ("4k", True, 50)
    # requesting below the cap is preserved
    assert security.enforce_plan("studio", "720p", False)[0] == "720p"


def test_rate_limiter():
    from collections import deque

    class Req:
        headers = {}

        class client:
            host = "1.2.3.9"

    r = Req()
    # limit 3 in a big window: first 3 allowed, 4th blocked
    security._buckets.clear()
    assert [security.rate_limit(r, "t", 3, 100) for _ in range(4)] == [
        True,
        True,
        True,
        False,
    ]
