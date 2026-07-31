"""Shared runtime config. HEATCLIP_DATA points at a writable data directory
(DB, session secret, rendered clips) so it can be a Docker volume in production.
Defaults to the backend folder for local dev.
"""
from __future__ import annotations

import os
from pathlib import Path

DATA_DIR = Path(os.environ.get("HEATCLIP_DATA", Path(__file__).parent))
DATA_DIR.mkdir(parents=True, exist_ok=True)
