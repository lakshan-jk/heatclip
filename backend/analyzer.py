"""Analyze a YouTube video: metadata, the 'most replayed' heatmap, and transcript.

Everything here is read-only (no download) so /analyze stays fast. The heatmap is
the core signal — yt-dlp exposes it as info['heatmap'] = [{start_time,end_time,value}]
with value normalized 0..1. It's None on videos YouTube hasn't computed it for.
"""
from __future__ import annotations

import json
import urllib.request
from dataclasses import dataclass, field
from typing import Optional

import yt_dlp


@dataclass
class HeatMarker:
    start: float
    end: float
    value: float  # 0..1, higher = more replayed

    def as_dict(self) -> dict:
        return {"start": self.start, "end": self.end, "value": self.value}


@dataclass
class Caption:
    start: float
    end: float
    text: str

    def as_dict(self) -> dict:
        return {"start": self.start, "end": self.end, "text": self.text}


@dataclass
class VideoAnalysis:
    video_id: str
    title: str
    duration: float
    thumbnail: Optional[str]
    channel: Optional[str]
    webpage_url: str
    max_height: int = 0  # tallest available source video (px) — for quality labeling
    heatmap: list[HeatMarker] = field(default_factory=list)
    captions: list[Caption] = field(default_factory=list)

    @property
    def has_heatmap(self) -> bool:
        return len(self.heatmap) > 0

    def as_dict(self) -> dict:
        return {
            "videoId": self.video_id,
            "title": self.title,
            "duration": self.duration,
            "thumbnail": self.thumbnail,
            "channel": self.channel,
            "webpageUrl": self.webpage_url,
            "maxHeight": self.max_height,
            "hasHeatmap": self.has_heatmap,
            "heatmap": [m.as_dict() for m in self.heatmap],
            # captions intentionally omitted from the API payload — they can be large
            # and are only needed server-side for hook detection.
        }


class AnalyzeError(Exception):
    """Raised for user-facing failures (private/age-gated/region-locked/invalid)."""


def _friendly_error(exc: Exception) -> AnalyzeError:
    msg = str(exc).lower()
    if "private" in msg:
        return AnalyzeError("This video is private.")
    if "age" in msg and "confirm" in msg:
        return AnalyzeError("This video is age-restricted and can't be analyzed.")
    if "not available in your country" in msg or "geo" in msg:
        return AnalyzeError("This video isn't available in this region.")
    if "unavailable" in msg or "removed" in msg:
        return AnalyzeError("This video is unavailable or has been removed.")
    return AnalyzeError("Couldn't analyze this video. Check the link and try again.")


def _pick_caption_track(automatic_captions: dict, subtitles: dict) -> Optional[list[dict]]:
    """Prefer manual English subs, then auto English, then any track."""
    for source in (subtitles, automatic_captions):
        if not source:
            continue
        for lang in ("en", "en-US", "en-GB", "en-orig"):
            if lang in source:
                return source[lang]
        # fall back to the first available language
        first = next(iter(source.values()), None)
        if first:
            return first
    return None


def _fetch_captions(tracks: list[dict]) -> list[Caption]:
    """Download and parse a caption track. Prefers json3 (easy, exact timing)."""
    fmt = next((t for t in tracks if t.get("ext") == "json3"), None)
    if fmt:
        return _parse_json3(_http_get(fmt["url"]))
    fmt = next((t for t in tracks if t.get("ext") in ("vtt", "srv3", "ttml")), tracks[0])
    return _parse_vtt(_http_get(fmt["url"]))


def _http_get(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=20) as resp:
        return resp.read().decode("utf-8", errors="replace")


def _parse_json3(raw: str) -> list[Caption]:
    data = json.loads(raw)
    out: list[Caption] = []
    for ev in data.get("events", []):
        segs = ev.get("segs")
        start_ms = ev.get("tStartMs")
        if segs is None or start_ms is None:
            continue
        text = "".join(s.get("utf8", "") for s in segs).strip()
        if not text:
            continue
        dur_ms = ev.get("dDurationMs", 0)
        out.append(Caption(start_ms / 1000.0, (start_ms + dur_ms) / 1000.0, text))
    return out


def _ts_to_sec(ts: str) -> float:
    ts = ts.replace(",", ".").strip()
    parts = ts.split(":")
    parts = [float(p) for p in parts]
    while len(parts) < 3:
        parts.insert(0, 0.0)
    h, m, s = parts[-3], parts[-2], parts[-1]
    return h * 3600 + m * 60 + s


def _parse_vtt(raw: str) -> list[Caption]:
    out: list[Caption] = []
    cur_start = cur_end = None
    buf: list[str] = []
    for line in raw.splitlines():
        line = line.strip()
        if "-->" in line:
            if cur_start is not None and buf:
                out.append(Caption(cur_start, cur_end, " ".join(buf).strip()))
            a, _, b = line.partition("-->")
            cur_start = _ts_to_sec(a)
            cur_end = _ts_to_sec(b.split()[0]) if b.split() else cur_start
            buf = []
        elif line and not line.isdigit() and line not in ("WEBVTT",):
            # strip inline tags like <00:00:01.000> and <c>
            import re

            clean = re.sub(r"<[^>]+>", "", line)
            if clean.strip():
                buf.append(clean.strip())
    if cur_start is not None and buf:
        out.append(Caption(cur_start, cur_end, " ".join(buf).strip()))
    # de-dupe consecutive identical lines (common in auto-captions)
    deduped: list[Caption] = []
    for c in out:
        if deduped and deduped[-1].text == c.text:
            deduped[-1].end = c.end
        else:
            deduped.append(c)
    return deduped


# YouTube periodically breaks individual player clients ("The page needs to be
# reloaded", "Requested format is not available"). We try a chain until one works.
# 'android_vr' exposes heatmap + captions AND the full resolution ladder (so the
# reported source height is accurate); 'android' is the reliable fallback.
PLAYER_CLIENTS: list[list[str]] = [["android_vr"], ["android"], ["web"], ["tv"]]


def _extract(url: str) -> dict:
    last_exc: Optional[Exception] = None
    for clients in PLAYER_CLIENTS:
        opts = {
            "skip_download": True,
            "quiet": True,
            "no_warnings": True,
            "extractor_args": {"youtube": {"player_client": clients}},
        }
        try:
            with yt_dlp.YoutubeDL(opts) as ydl:
                return ydl.extract_info(url, download=False)
        except Exception as exc:  # noqa: BLE001 - try the next client
            last_exc = exc
            continue
    raise _friendly_error(last_exc or Exception("extraction failed"))


def analyze(url: str, with_captions: bool = True) -> VideoAnalysis:
    info = _extract(url)

    if info.get("_type") == "playlist":
        entries = info.get("entries") or []
        if not entries:
            raise AnalyzeError("No playable video found at that link.")
        info = entries[0]

    heatmap = [
        HeatMarker(m["start_time"], m["end_time"], m["value"])
        for m in (info.get("heatmap") or [])
    ]

    heights = [
        f.get("height")
        for f in (info.get("formats") or [])
        if isinstance(f.get("height"), int)
    ]
    max_height = max(heights) if heights else int(info.get("height") or 0)

    captions: list[Caption] = []
    if with_captions:
        try:
            tracks = _pick_caption_track(
                info.get("automatic_captions") or {}, info.get("subtitles") or {}
            )
            if tracks:
                captions = _fetch_captions(tracks)
        except Exception:  # noqa: BLE001 - captions are best-effort
            captions = []

    return VideoAnalysis(
        video_id=info.get("id", ""),
        title=info.get("title", "Untitled"),
        duration=float(info.get("duration") or 0),
        thumbnail=info.get("thumbnail"),
        channel=info.get("channel") or info.get("uploader"),
        webpage_url=info.get("webpage_url", url),
        max_height=max_height,
        heatmap=heatmap,
        captions=captions,
    )
