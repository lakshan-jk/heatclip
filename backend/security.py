"""Production validation + security helpers: YouTube-only URL checks (SSRF guard),
clip/input bounds, per-IP rate limiting, and subscription/plan enforcement.
"""
from __future__ import annotations

import threading
import time
from collections import defaultdict, deque
from urllib.parse import urlparse

from fastapi import Request

import config

# ---------------- URL validation (SSRF guard) ----------------

_YT_HOSTS = {
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "music.youtube.com",
    "youtu.be",
    "www.youtu.be",
}
MAX_URL_LEN = 300


class ValidationError(Exception):
    pass


def validate_youtube_url(url: str) -> str:
    """Only allow real YouTube links — prevents pointing yt-dlp at internal/arbitrary
    hosts (SSRF) and non-YouTube abuse."""
    url = (url or "").strip()
    if not url or len(url) > MAX_URL_LEN:
        raise ValidationError("Please provide a valid YouTube link.")
    parsed = urlparse(url if "://" in url else "https://" + url)
    if parsed.scheme not in ("http", "https"):
        raise ValidationError("Only http/https links are supported.")
    host = (parsed.hostname or "").lower()
    if host not in _YT_HOSTS:
        raise ValidationError("Only YouTube links are supported.")
    return url


# ---------------- Clip / input bounds ----------------

ABS_MAX_CLIP_LEN = 600.0  # hard ceiling (10 min) regardless of plan
MIN_CLIP_LEN = 1.0


def validate_clips(clips: list, max_clips: int) -> None:
    if not clips:
        raise ValidationError("No clips to render.")
    if len(clips) > max_clips:
        raise ValidationError(f"Too many clips for your plan (max {max_clips}).")
    for c in clips:
        start = float(getattr(c, "start", c["start"] if isinstance(c, dict) else 0))
        end = float(getattr(c, "end", c["end"] if isinstance(c, dict) else 0))
        if start < 0 or end <= start:
            raise ValidationError("Each clip needs a valid start/end.")
        length = end - start
        if length < MIN_CLIP_LEN:
            raise ValidationError("Clips must be at least 1 second.")
        if length > ABS_MAX_CLIP_LEN:
            raise ValidationError("A clip is too long.")


# ---------------- Rate limiting (per IP, in-memory, fixed window) ----------------

_buckets: dict[str, deque] = defaultdict(deque)
_lock = threading.Lock()


def client_ip(request: Request) -> str:
    # Behind Caddy the real client is the first hop of X-Forwarded-For.
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def rate_limit(request: Request, name: str, limit: int, window: int) -> bool:
    """Return True if allowed; False if the caller has exceeded limit/window seconds."""
    key = f"{name}:{client_ip(request)}"
    now = time.time()
    with _lock:
        dq = _buckets[key]
        while dq and dq[0] <= now - window:
            dq.popleft()
        if len(dq) >= limit:
            return False
        dq.append(now)
        return True


# ---------------- Subscription / plan enforcement ----------------

def enforce_plan(plan: str, quality: str, auto_frame: bool) -> tuple[str, bool, int]:
    """Clamp requested features to what the plan allows. Returns
    (allowed_quality, allowed_auto_frame, max_clips)."""
    plan = plan if plan in config.PLAN_MAX_QUALITY else "free"
    order = config.QUALITY_ORDER
    want = quality if quality in order else "1080p"
    cap = config.PLAN_MAX_QUALITY[plan]
    allowed_quality = want if order.index(want) <= order.index(cap) else cap
    allowed_auto = bool(auto_frame) and config.PLAN_AUTOFRAME[plan]
    return allowed_quality, allowed_auto, config.PLAN_MAX_CLIPS[plan]
