"""HeatClip API — analyze a YouTube link, then render vertical Shorts.

Endpoints:
  POST /analyze        -> heatmap + AI hook-led clip candidates (fast, no download)
  POST /render         -> enqueue a render job for chosen clips, returns jobId
  GET  /jobs/{jobId}   -> job status + downloadable clip URLs
  GET  /files/...      -> rendered .mp4 files (static)
"""
from __future__ import annotations

from pathlib import Path

from datetime import datetime, timezone

from fastapi import BackgroundTasks, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import auth
import db
import jobs
from analyzer import AnalyzeError, analyze
from hooks import generate_candidates

app = FastAPI(title="HeatClip API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten for production
    allow_methods=["*"],
    allow_headers=["*"],
)

db.init_db()
jobs.STORAGE.mkdir(exist_ok=True)
app.mount("/files", StaticFiles(directory=str(jobs.STORAGE)), name="files")


class AnalyzeRequest(BaseModel):
    url: str


class ClipSpec(BaseModel):
    start: float
    end: float


class RenderRequest(BaseModel):
    url: str
    clips: list[ClipSpec]
    quality: str = "1080p"
    autoFrame: bool = True
    reframeNudge: float = 0.0


class SignupRequest(BaseModel):
    email: str
    password: str
    name: str = ""


class LoginRequest(BaseModel):
    email: str
    password: str


class ContactRequest(BaseModel):
    name: str = ""
    email: str = ""
    topic: str = ""
    message: str


@app.get("/health")
def health() -> dict:
    return {"ok": True}


# ---------------- auth ----------------


@app.post("/auth/signup")
def signup_endpoint(req: SignupRequest) -> dict:
    try:
        return auth.signup(req.email, req.password, req.name)
    except auth.AuthError as exc:
        raise HTTPException(400, str(exc)) from exc


@app.post("/auth/login")
def login_endpoint(req: LoginRequest) -> dict:
    try:
        return auth.login(req.email, req.password)
    except auth.AuthError as exc:
        raise HTTPException(401, str(exc)) from exc


@app.get("/auth/me")
def me_endpoint(authorization: str = Header(default="")) -> dict:
    token = authorization.replace("Bearer ", "").strip()
    if not token:
        raise HTTPException(401, "Not signed in")
    try:
        return {"user": auth.user_from_token(token)}
    except auth.AuthError as exc:
        raise HTTPException(401, str(exc)) from exc


@app.post("/contact")
def contact_endpoint(req: ContactRequest) -> dict:
    if not req.message.strip():
        raise HTTPException(400, "Message is required")
    db.save_contact(
        req.name, req.email, req.topic, req.message,
        datetime.now(timezone.utc).isoformat(),
    )
    return {"ok": True}


@app.post("/analyze")
def analyze_endpoint(req: AnalyzeRequest) -> dict:
    if not req.url.strip():
        raise HTTPException(400, "Missing url")
    try:
        result = analyze(req.url)
    except AnalyzeError as exc:
        raise HTTPException(422, str(exc)) from exc

    candidates = generate_candidates(result)
    payload = result.as_dict()
    payload["candidates"] = [c.as_dict() for c in candidates]
    return payload


@app.post("/render")
def render_endpoint(req: RenderRequest, background: BackgroundTasks) -> dict:
    if not req.clips:
        raise HTTPException(400, "No clips to render")
    for c in req.clips:
        if c.end <= c.start:
            raise HTTPException(400, "Clip end must be after start")
    quality = req.quality if req.quality in {"720p", "1080p", "2k", "4k"} else "1080p"
    nudge = max(-0.35, min(0.35, req.reframeNudge))
    job = jobs.create_job(
        req.url,
        [c.model_dump() for c in req.clips],
        quality=quality,
        auto_frame=req.autoFrame,
        reframe_nudge=nudge,
    )
    background.add_task(jobs.run_job, job.id)
    return {"jobId": job.id, "status": job.status}


@app.get("/jobs/{job_id}")
def job_status(job_id: str) -> dict:
    job = jobs.get_job(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    return job.as_dict()
