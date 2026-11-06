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
    """watch flow and svg render: scripted unless DIAGNOSE_MODE=live is set explicitly (the demo stays deterministic)."""
    return os.environ.get("DIAGNOSE_MODE") or "fixture"


def chat_mode() -> str:
    """ask flow: live whenever a key exists."""
    return "live" if os.environ.get("ANTHROPIC_API_KEY") else "fixture"


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


def anthropic_client():
    """one client for every lane. ANTHROPIC_WORKSPACE_ID (optional) scopes an org-level key to a workspace."""
    import anthropic
    ws = os.environ.get("ANTHROPIC_WORKSPACE_ID")
    return anthropic.Anthropic(default_headers={"anthropic-workspace-id": ws} if ws else None)
