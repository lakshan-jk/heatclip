"""In-memory render-job store + runner.

MVP uses FastAPI BackgroundTasks + a process-local dict. This is intentionally
simple; swap for Redis/RQ when you need multiple workers or persistence.
"""
from __future__ import annotations

import shutil
import threading
import time
import uuid
from dataclasses import asdict, dataclass, field
from typing import Optional

import analyzer
import transcribe
from config import DATA_DIR
from renderer import RenderError, render_clip

STORAGE = DATA_DIR / "storage"
CLEANUP_TTL = 6 * 3600      # delete rendered clips older than 6h
CLEANUP_EVERY = 1800        # sweep every 30 min


@dataclass
class ClipResult:
    index: int
    start: float
    end: float
    status: str = "pending"  # pending|downloading|rendering|done|error
    clip_url: Optional[str] = None
    error: Optional[str] = None


@dataclass
class Job:
    id: str
    url: str
    quality: str = "1080p"
    auto_frame: bool = True
    reframe_nudge: float = 0.0
    captions: bool = False
    status: str = "pending"  # pending|running|done|error
    clips: list[ClipResult] = field(default_factory=list)
    error: Optional[str] = None

    def as_dict(self) -> dict:
        done = sum(1 for c in self.clips if c.status in ("done", "error"))
        return {
            "jobId": self.id,
            "status": self.status,
            "progress": {"done": done, "total": len(self.clips)},
            "error": self.error,
            "clips": [asdict(c) for c in self.clips],
        }


_JOBS: dict[str, Job] = {}
_LOCK = threading.Lock()


def create_job(
    url: str,
    clips: list[dict],
    quality: str = "1080p",
    auto_frame: bool = True,
    reframe_nudge: float = 0.0,
    captions: bool = False,
) -> Job:
    job_id = uuid.uuid4().hex[:12]
    job = Job(
        id=job_id,
        url=url,
        quality=quality,
        auto_frame=auto_frame,
        reframe_nudge=reframe_nudge,
        captions=captions,
        clips=[
            ClipResult(index=i, start=float(c["start"]), end=float(c["end"]))
            for i, c in enumerate(clips)
        ],
    )
    with _LOCK:
        _JOBS[job_id] = job
    return job


def get_job(job_id: str) -> Optional[Job]:
    return _JOBS.get(job_id)


def run_job(job_id: str, files_base_url: str = "/files") -> None:
    job = _JOBS.get(job_id)
    if not job:
        return
    job.status = "running"
    # Prefer YouTube captions (fast); if absent, fall back to Whisper per clip.
    caps = analyzer.fetch_captions(job.url) if job.captions else None
    use_whisper = bool(job.captions and not caps and transcribe.available())
    for clip in job.clips:
        out = STORAGE / job.id / f"clip_{clip.index}.mp4"
        try:
            render_clip(
                job.url, clip.start, clip.end, out,
                quality=job.quality,
                auto_frame=job.auto_frame,
                reframe_nudge=job.reframe_nudge,
                captions_data=caps,
                whisper_captions=use_whisper,
                on_status=lambda s, c=clip: setattr(c, "status", s),
            )
            clip.status = "done"
            clip.clip_url = f"{files_base_url}/{job.id}/clip_{clip.index}.mp4"
        except (RenderError, Exception) as exc:  # noqa: BLE001
            clip.status = "error"
            clip.error = str(exc)[:300]
    job.status = "error" if all(c.status == "error" for c in job.clips) else "done"


def start_cleanup() -> None:
    """Background sweep: delete old render output + drop stale in-memory jobs so
    disk usage stays bounded in production."""

    def loop() -> None:
        while True:
            time.sleep(CLEANUP_EVERY)
            cutoff = time.time() - CLEANUP_TTL
            try:
                for d in STORAGE.iterdir():
                    if d.is_dir() and d.stat().st_mtime < cutoff:
                        shutil.rmtree(d, ignore_errors=True)
            except Exception:  # noqa: BLE001 - cleanup must never crash the app
                pass
            with _LOCK:
                for jid in [
                    j for j, job in _JOBS.items()
                    if job.status in ("done", "error")
                    and not (STORAGE / j).exists()
                ]:
                    _JOBS.pop(jid, None)

    threading.Thread(target=loop, daemon=True).start()
