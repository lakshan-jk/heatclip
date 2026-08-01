"""Shared runtime config. HEATCLIP_DATA points at a writable data directory
(DB, session secret, rendered clips) so it can be a Docker volume in production.
Defaults to the backend folder for local dev.
"""
from __future__ import annotations

import os
from pathlib import Path

DATA_DIR = Path(os.environ.get("HEATCLIP_DATA", Path(__file__).parent))
DATA_DIR.mkdir(parents=True, exist_ok=True)

# Super admins get full ("admin") access regardless of subscription. Configurable
# via HEATCLIP_ADMINS (comma-separated); a built-in owner account is always included.
_admins_env = os.environ.get("HEATCLIP_ADMINS", "")
SUPER_ADMINS = {
    e.strip().lower()
    for e in ("kumarlakshan1032@gmail.com," + _admins_env).split(",")
    if e.strip()
}

# CORS — comma-separated allowed origins. "*" only for local dev; set real origins
# in production (e.g. https://heatclip.duckdns.org).
ALLOWED_ORIGINS = [
    o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "*").split(",") if o.strip()
]

# ---- Subscription / plan limits (enforced server-side) ----
QUALITY_ORDER = ["720p", "1080p", "2k", "4k"]
# 2K/4K + auto-reframe are the paid/PRO features; free stays usable at 1080p.
PLAN_MAX_QUALITY = {
    "free": "1080p",
    "creator": "2k",
    "studio": "4k",
    "admin": "4k",
}
PLAN_AUTOFRAME = {"free": False, "creator": True, "studio": True, "admin": True}
PLAN_MAX_CLIPS = {"free": 6, "creator": 20, "studio": 30, "admin": 50}


def plan_for(email: str, stored_plan: str = "free") -> str:
    """Resolve the effective plan — super admins always get 'admin'."""
    if email and email.strip().lower() in SUPER_ADMINS:
        return "admin"
    return stored_plan if stored_plan in PLAN_MAX_QUALITY else "free"
