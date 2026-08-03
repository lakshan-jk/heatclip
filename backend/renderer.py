"""Download a single clip range and reframe it to a vertical Short.

Two steps, both shelling out to tools we already validated:
  1. yt-dlp downloads ONLY the requested [start,end] section (not the whole video).
  2. ffmpeg center-crops 16:9 -> 9:16 and scales to the requested output size.
"""
from __future__ import annotations

import subprocess
import tempfile
from pathlib import Path
from typing import Callable, Optional

import yt_dlp

import autoframe
import captions as captions_mod

# 'android_vr' currently exposes the FULL format ladder (up to 2160p/4K), while the
# plain 'android'/'web' clients are throttled to ~360p — so it's essential for real
# 1080p/2K/4K output. Fallbacks kept for resilience.
DOWNLOAD_CLIENTS: list[list[str]] = [["android_vr"], ["android"], ["web"], ["tv"]]

# Export quality → (out_width, out_height, max source height to download).
# 9:16 vertical. Higher tiers pull higher-res source and encode at higher bitrate.
QUALITY: dict[str, tuple[int, int, int]] = {
    "preview": (405, 720, 480),  # fast, low-res framing check
    "720p": (720, 1280, 720),
    "1080p": (1080, 1920, 1080),
    "2k": (1440, 2560, 1440),
    "4k": (2160, 3840, 2160),
}
DEFAULT_QUALITY = "1080p"

# CRF per tier — lower = higher quality/bigger file. Higher resolutions get a
# slightly lower CRF so detail holds up.
_CRF = {"preview": "28", "720p": "22", "1080p": "20", "2k": "19", "4k": "18"}


class RenderError(Exception):
    pass


def _has_ass_filter() -> bool:
    """True if this ffmpeg build can burn subtitles (libass). Minimal builds can't."""
    try:
        out = subprocess.run(
            ["ffmpeg", "-hide_banner", "-filters"], capture_output=True, text=True
        ).stdout
        for line in out.splitlines():
            parts = line.split()
            if len(parts) >= 2 and parts[1] == "ass":
                return True
    except Exception:  # noqa: BLE001
        pass
    return False


HAS_SUBTITLES = _has_ass_filter()


def _reframe_filter(w: int, h: int) -> str:
    # scale to COVER the frame, then center-crop. Works for any source aspect and
    # avoids commas inside filter expressions (ffmpeg misparses those).
    return (
        f"scale={w}:{h}:force_original_aspect_ratio=increase,"
        f"crop={w}:{h},setsar=1,fps=30"
    )


def _download_section(
    url: str, start: float, end: float, workdir: Path, src_cap: int
) -> Path:
    out_tmpl = str(workdir / "src.%(ext)s")
    # Always end up with an audio track: prefer video+audio merge, and every
    # fallback explicitly requires audio (acodec!=none) so we never grab a
    # video-only high-res stream and silently drop the sound.
    fmt = (
        f"bestvideo[height<={src_cap}]+bestaudio/"
        f"best[height<={src_cap}][acodec!=none]/"
        f"bestvideo[height<={src_cap}]+bestaudio/"
        f"best[acodec!=none]/best"
    )
    last_exc: Optional[Exception] = None
    for clients in DOWNLOAD_CLIENTS:
        opts = {
            "quiet": True,
            "no_warnings": True,
            "outtmpl": out_tmpl,
            "format": fmt,
            "download_ranges": yt_dlp.utils.download_range_func(None, [(start, end)]),
            "force_keyframes_at_cuts": True,
            "merge_output_format": "mp4",
            "extractor_args": {"youtube": {"player_client": clients}},
        }
        try:
            with yt_dlp.YoutubeDL(opts) as ydl:
                ydl.download([url])
            files = list(workdir.glob("src.*"))
            if files:
                return files[0]
        except Exception as exc:  # noqa: BLE001 - try next client
            last_exc = exc
            continue
    raise RenderError(f"Could not download clip section: {last_exc}")


def _reframe(src: Path, dst: Path, w: int, h: int, crf: str, vf: Optional[str] = None) -> None:
    cmd = [
        "ffmpeg", "-y", "-i", str(src),
        "-map", "0:v:0", "-map", "0:a:0?",  # take video + audio (if present)
        "-vf", vf or _reframe_filter(w, h),
        "-c:v", "libx264", "-preset", "veryfast", "-crf", crf,
        "-c:a", "aac", "-b:a", "160k",
        "-movflags", "+faststart",
        str(dst),
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0 or not dst.exists():
        raise RenderError(f"ffmpeg failed: {proc.stderr[-500:]}")


def render_clip(
    url: str,
    start: float,
    end: float,
    out_path: Path,
    quality: str = DEFAULT_QUALITY,
    auto_frame: bool = True,
    reframe_nudge: float = 0.0,
    captions_data: Optional[list] = None,
    on_status: Optional[Callable[[str], None]] = None,
) -> Path:
    w, h, src_cap = QUALITY.get(quality, QUALITY[DEFAULT_QUALITY])
    crf = _CRF.get(quality, "20")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        workdir = Path(tmp)
        if on_status:
            on_status("downloading")
        src = _download_section(url, start, end, workdir, src_cap)
        if on_status:
            on_status("rendering")
        # Smart auto-reframe (Pro): follow the subject; None → plain center-crop.
        vf = (
            autoframe.reframe_filter(src, w, h, workdir, nudge=reframe_nudge)
            if auto_frame
            else None
        )
        if vf is None:
            vf = _reframe_filter(w, h)
        base_vf = vf
        # Burn captions (transcript sliced to this clip, times made clip-relative).
        if captions_data and HAS_SUBTITLES:
            clip_caps = [
                (max(0.0, c.start - start), min(end, c.end) - start, c.text)
                for c in captions_data
                if c.end > start and c.start < end
            ]
            if clip_caps:
                ass = captions_mod.build_ass(clip_caps, w, h, workdir / "subs.ass")
                vf = vf + f",ass={ass.as_posix()}"
        try:
            _reframe(src, out_path, w, h, crf, vf)
        except RenderError:
            if vf != base_vf:  # captions may have broken it — retry without them
                _reframe(src, out_path, w, h, crf, base_vf)
            else:
                raise
    return out_path
