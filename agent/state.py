"""shared session state. lanes add keys to S; don't restructure."""
import datetime
import json
import os
import uuid
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
DATA.mkdir(exist_ok=True)
load_dotenv(ROOT / ".env")


def mode() -> str:
    return os.environ.get("DIAGNOSE_MODE") or ("live" if os.environ.get("ANTHROPIC_API_KEY") else "fixture")


def now() -> str:
    return datetime.datetime.now().isoformat(timespec="seconds")


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


def load_json(name: str, default):
    p = DATA / name
    return json.loads(p.read_text()) if p.exists() else default


def save_json(name: str, obj) -> None:
    (DATA / name).write_text(json.dumps(obj, indent=2))


S: dict = {"last_triage": None, "last_diagnosis": None, "last_step": None, "alerts": [], "quotes": [], "pending_alert": None}
