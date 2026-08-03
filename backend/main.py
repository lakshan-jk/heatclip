"""HeatClip API — analyze a YouTube link, then render vertical Shorts.

Endpoints:
  POST /analyze        -> heatmap + AI hook-led clip candidates (fast, no download)
  POST /render         -> enqueue a render job for chosen clips, returns jobId
  GET  /jobs/{jobId}   -> job status + downloadable clip URLs
  GET  /files/...      -> rendered .mp4 files (static)
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timezone

from fastapi import BackgroundTasks, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import auth
import config
import db
import jobs
import security
from analyzer import AnalyzeError, analyze
from hooks import generate_candidates

log = logging.getLogger("heatclip")
app = FastAPI(title="HeatClip API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.ALLOWED_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
    max_age=3600,
)

db.init_db()
jobs.STORAGE.mkdir(exist_ok=True)
app.mount("/files", StaticFiles(directory=str(jobs.STORAGE)), name="files")


@app.on_event("startup")
def _startup() -> None:
    if not os.environ.get("HEATCLIP_SECRET"):
        log.warning(
            "HEATCLIP_SECRET not set — using a generated dev secret. Set it in "
            "production so sessions are stable and secret across restarts."
        )
    if config.ALLOWED_ORIGINS == ["*"]:
        log.warning("ALLOWED_ORIGINS is '*' — restrict this to your domain in production.")
    if auth.provision_admin():
        log.info("Admin account provisioned for %s", config.ADMIN_EMAIL)
    else:
        log.warning(
            "HEATCLIP_ADMIN_PASSWORD not set — admin account not pre-provisioned. "
            "Anyone could sign up with the admin email. Set it in production."
        )
    jobs.start_cleanup()  # background TTL cleanup of old render output


def _plan_from_header(authorization: str) -> tuple[str, str]:
    """Resolve (plan, email) from an optional Bearer token; anonymous → free."""
    token = (authorization or "").replace("Bearer ", "").strip()
    if not token:
        return "free", ""
    try:
        user = auth.user_from_token(token)
        return user.get("plan", "free"), user.get("email", "")
    except auth.AuthError:
        return "free", ""


def _limit(request: Request, name: str, limit: int, window: int) -> None:
    if not security.rate_limit(request, name, limit, window):
        raise HTTPException(429, "Too many requests — please slow down and try again.")


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
    captions: bool = True


class PreviewRequest(BaseModel):
    url: str
    clip: ClipSpec
    autoFrame: bool = True
    reframeNudge: float = 0.0
    captions: bool = True


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
def signup_endpoint(req: SignupRequest, request: Request) -> dict:
    _limit(request, "signup", 5, 3600)
    try:
        return auth.signup(req.email, req.password, req.name)
    except auth.AuthError as exc:
        raise HTTPException(400, str(exc)) from exc


@app.post("/auth/login")
def login_endpoint(req: LoginRequest, request: Request) -> dict:
    _limit(request, "login", 10, 300)  # brute-force protection
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
def contact_endpoint(req: ContactRequest, request: Request) -> dict:
    _limit(request, "contact", 5, 3600)
    msg = (req.message or "").strip()
    if not msg:
        raise HTTPException(400, "Message is required")
    if len(msg) > 5000:
        raise HTTPException(400, "Message is too long")
    db.save_contact(
        req.name[:120], req.email[:200], req.topic[:60], msg,
        datetime.now(timezone.utc).isoformat(),
    )
    return {"ok": True}


@app.post("/analyze")
def analyze_endpoint(req: AnalyzeRequest, request: Request) -> dict:
    _limit(request, "analyze", 30, 60)
    try:
        url = security.validate_youtube_url(req.url)
    except security.ValidationError as exc:
        raise HTTPException(400, str(exc)) from exc
    try:
        result = analyze(url)
    except AnalyzeError as exc:
        raise HTTPException(422, str(exc)) from exc

    candidates = generate_candidates(result)
    payload = result.as_dict()
    payload["candidates"] = [c.as_dict() for c in candidates]
    return payload


@app.post("/render")
def render_endpoint(
    req: RenderRequest,
    background: BackgroundTasks,
    request: Request,
    authorization: str = Header(default=""),
) -> dict:
    _limit(request, "render", 10, 600)  # expensive: heavy per-IP limit
    try:
        url = security.validate_youtube_url(req.url)
    except security.ValidationError as exc:
        raise HTTPException(400, str(exc)) from exc

    # Subscription enforcement (server-side — never trust the client).
    plan, _email = _plan_from_header(authorization)
    quality, auto_frame, max_clips = security.enforce_plan(
        plan, req.quality, req.autoFrame
    )
    try:
        security.validate_clips(req.clips, max_clips)
    except security.ValidationError as exc:
        raise HTTPException(400, str(exc)) from exc

    nudge = max(-0.35, min(0.35, req.reframeNudge))
    job = jobs.create_job(
        url,
        [c.model_dump() for c in req.clips],
        quality=quality,
        auto_frame=auto_frame,
        reframe_nudge=nudge,
        captions=bool(req.captions),
    )
    background.add_task(jobs.run_job, job.id)
    return {"jobId": job.id, "status": job.status, "plan": plan, "quality": quality}


@app.post("/preview")
def preview_endpoint(
    req: PreviewRequest, background: BackgroundTasks, request: Request
) -> dict:
    """Fast low-res render of a single clip to check framing before committing."""
    _limit(request, "preview", 20, 600)
    try:
        url = security.validate_youtube_url(req.url)
        security.validate_clips([req.clip], max_clips=1)
    except security.ValidationError as exc:
        raise HTTPException(400, str(exc)) from exc
    nudge = max(-0.35, min(0.35, req.reframeNudge))
    job = jobs.create_job(
        url,
        [req.clip.model_dump()],
        quality="preview",
        auto_frame=req.autoFrame,
        reframe_nudge=nudge,
        captions=bool(req.captions),
    )
    background.add_task(jobs.run_job, job.id)
    return {"jobId": job.id, "status": job.status}


@app.get("/jobs/{job_id}")
def job_status(job_id: str) -> dict:
    job = jobs.get_job(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    return job.as_dict()
