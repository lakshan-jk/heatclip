"""SQLite storage for users and contact submissions.

Uses the stdlib sqlite3 (no external DB needed). The connection is created per
call with check_same_thread=False safe usage since each request opens its own.
"""
from __future__ import annotations

import sqlite3

from config import DATA_DIR

DB_PATH = DATA_DIR / "heatclip.db"


def _conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with _conn() as c:
        c.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                email      TEXT UNIQUE NOT NULL,
                name       TEXT,
                pw_hash    TEXT NOT NULL,
                salt       TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        c.execute(
            """
            CREATE TABLE IF NOT EXISTS contacts (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                name       TEXT,
                email      TEXT,
                topic      TEXT,
                message    TEXT,
                created_at TEXT NOT NULL
            )
            """
        )


def create_user(email: str, name: str, pw_hash: str, salt: str, created_at: str) -> dict:
    with _conn() as c:
        cur = c.execute(
            "INSERT INTO users (email, name, pw_hash, salt, created_at) VALUES (?,?,?,?,?)",
            (email, name, pw_hash, salt, created_at),
        )
        return {"id": cur.lastrowid, "email": email, "name": name}


def get_user_by_email(email: str) -> dict | None:
    with _conn() as c:
        row = c.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        return dict(row) if row else None


def save_contact(name: str, email: str, topic: str, message: str, created_at: str) -> int:
    with _conn() as c:
        cur = c.execute(
            "INSERT INTO contacts (name, email, topic, message, created_at) VALUES (?,?,?,?,?)",
            (name, email, topic, message, created_at),
        )
        return cur.lastrowid
