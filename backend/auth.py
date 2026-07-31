"""Authentication: pbkdf2 password hashing (stdlib) + JWT sessions (PyJWT).

The signing secret comes from HEATCLIP_SECRET if set, otherwise a stable
dev secret persisted next to the DB so tokens survive restarts in development.
"""
from __future__ import annotations

import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path

import jwt

import db
from config import DATA_DIR

_ALGO = "HS256"
_TOKEN_DAYS = 30
_SECRET_FILE = DATA_DIR / ".secret"


def _secret() -> str:
    env = os.environ.get("HEATCLIP_SECRET")
    if env:
        return env
    if _SECRET_FILE.exists():
        return _SECRET_FILE.read_text().strip()
    s = secrets.token_hex(32)
    try:
        _SECRET_FILE.write_text(s)
    except Exception:  # noqa: BLE001
        pass
    return s


class AuthError(Exception):
    pass


def _hash(password: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac(
        "sha256", password.encode(), bytes.fromhex(salt), 120_000
    ).hex()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def signup(email: str, password: str, name: str) -> dict:
    email = email.strip().lower()
    if "@" not in email or len(password) < 6:
        raise AuthError("Enter a valid email and a password of at least 6 characters.")
    if db.get_user_by_email(email):
        raise AuthError("An account with this email already exists.")
    salt = secrets.token_hex(16)
    user = db.create_user(email, name.strip(), _hash(password, salt), salt, _now_iso())
    return {"token": make_token(email), "user": {"email": email, "name": name.strip()}}


def login(email: str, password: str) -> dict:
    email = email.strip().lower()
    user = db.get_user_by_email(email)
    if not user or not hmac.compare_digest(user["pw_hash"], _hash(password, user["salt"])):
        raise AuthError("Incorrect email or password.")
    return {
        "token": make_token(email),
        "user": {"email": email, "name": user["name"]},
    }


def make_token(email: str) -> str:
    payload = {
        "sub": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=_TOKEN_DAYS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, _secret(), algorithm=_ALGO)


def user_from_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, _secret(), algorithms=[_ALGO])
    except jwt.PyJWTError as exc:
        raise AuthError("Invalid or expired session.") from exc
    user = db.get_user_by_email(payload.get("sub", ""))
    if not user:
        raise AuthError("Account not found.")
    return {"email": user["email"], "name": user["name"]}
