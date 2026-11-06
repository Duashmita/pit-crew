"""friends, settings, alerts, acks, the crash countdown and the car watcher. owned by backend-safety."""
import asyncio
import importlib
import json
import os

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from . import events, state

router = APIRouter()

LOCATION = {"lat": 37.8044, "lng": -122.2712, "label": "Elm St & 3rd Ave (synthetic)"}
STATE_FILE = state.ROOT / "car" / "state.json"
VALID_TRIGGERS = {"verdict", "sos", "crash", "stall"}


# ---------- the car belongs to another lane; use car.mock, else its state file ----------

def _car():
    try:
        return importlib.import_module("car.mock")
    except Exception:
        return None


def _car_events() -> list[dict]:
    car = _car()
    try:
        if car is not None:
            return list(car.events() or [])
        if STATE_FILE.exists():
            return list(json.loads(STATE_FILE.read_text()).get("events") or [])
    except Exception:
        pass
    return []


def _fault(trigger: str) -> str:
    if trigger == "crash":
        return "possible crash, airbag deployed"
    if trigger == "stall":
        return "engine stalled while driving"
    car = _car()
    try:
        if car is not None:
            dtcs = car.read_dtcs()
            if not dtcs:
                return "no fault codes"
            d = dtcs[0]
            return f"{d['code']} {d['desc'].removesuffix(' detected')}"
    except Exception:
        pass
    return "unknown"


# ---------- models ----------

class FriendIn(BaseModel):
    name: str
    relation: str = ""
    phone: str = ""


class SettingsIn(BaseModel):
    share_location: bool = True


class AlertIn(BaseModel):
    trigger: str = "sos"
    include_location: bool = True
    auto: bool = False


class AckIn(BaseModel):
    by: str
    action: str


# ---------- friends and settings (json files in data/) ----------

def _friends() -> list[dict]:
    return state.load_json("friends.json", [])


def _settings() -> dict:
    return state.load_json("settings.json", {"share_location": True})


@router.get("/api/friends")
def list_friends() -> list[dict]:
    return _friends()


@router.post("/api/friends")
def add_friend(f: FriendIn) -> dict:
    friends = _friends()
    friend = {"id": state.new_id("f"), "name": f.name, "relation": f.relation, "phone": f.phone, "synthetic": True}
    friends.append(friend)
    state.save_json("friends.json", friends)
    return friend


@router.delete("/api/friends/{fid}")
def remove_friend(fid: str) -> dict:
    friends = _friends()
    kept = [f for f in friends if f["id"] != fid]
    if len(kept) == len(friends):
        raise HTTPException(404, "no such friend")
    state.save_json("friends.json", kept)
    return {"ok": True}


@router.get("/api/settings")
def get_settings() -> dict:
    return _settings()


@router.put("/api/settings")
def put_settings(s: SettingsIn) -> dict:
    state.save_json("settings.json", s.model_dump())
    return s.model_dump()


# ---------- alerts ----------

def make_alert(trigger: str, include_location: bool = True, auto: bool = False) -> dict:
    if trigger not in VALID_TRIGGERS:
        raise HTTPException(400, f"trigger must be one of {sorted(VALID_TRIGGERS)}")
    triage = state.S.get("last_triage") or {}
    share = include_location and bool(_settings().get("share_location", True))
    alert = {
        "id": state.new_id("a"),
        "trigger": trigger,
        "auto": auto,
        "fault": _fault(trigger),
        "call": triage.get("call", "unknown"),
        "rule": triage.get("rule", "unknown"),
        "location": dict(LOCATION) if share else None,
        "to": [f["name"] for f in _friends()],
        "sent_at": state.now(),
        "status": "delivered",
        "acks": [],
    }
    state.S.setdefault("alerts", []).append(alert)
    events.publish({"type": "alert", "alert": alert})
    return alert


@router.post("/api/alerts")
def post_alert(a: AlertIn) -> dict:
    return make_alert(a.trigger, a.include_location, a.auto)


@router.get("/api/alerts")
def list_alerts() -> list[dict]:
    return state.S.get("alerts", [])


@router.post("/api/alerts/cancel")
def cancel_alert() -> dict:
    pending = state.S.get("pending_alert")
    state.S["pending_alert"] = None
    if pending:
        events.publish({"type": "alert_cancelled"})
    return {"cancelled": True, "was_pending": bool(pending)}


@router.post("/api/alerts/{aid}/ack")
def ack_alert(aid: str, a: AckIn) -> dict:
    for alert in state.S.get("alerts", []):
        if alert["id"] == aid:
            alert["acks"].append({"by": a.by, "action": a.action, "at": state.now()})
            events.publish({"type": "ack", "alert_id": aid, "by": a.by, "action": a.action})
            return alert
    raise HTTPException(404, "no such alert")


# ---------- car watcher: a crash or stall from the car fires an alert after a countdown unless cancelled ----------

_seen: set[str] = set()


def _countdown_s() -> int:
    return int(float(os.environ.get("ALERT_COUNTDOWN_S", "10")))


async def _countdown(ev: dict) -> None:
    trigger = "crash" if ev.get("type") == "airbag_deployed" else "stall"
    token = state.new_id("p")
    state.S["pending_alert"] = {"token": token, "trigger": trigger, "event": ev}
    secs = _countdown_s()
    events.publish({"type": "car_event", "event": ev, "countdown_s": secs})
    await asyncio.sleep(secs)
    pending = state.S.get("pending_alert")
    if pending and pending.get("token") == token:
        state.S["pending_alert"] = None
        make_alert(trigger, include_location=True, auto=True)


async def _watch() -> None:
    primed = False  # events that pre-date startup never fire
    while True:
        for ev in _car_events():
            key = f"{ev.get('type')}@{ev.get('at')}"
            if key in _seen:
                continue
            _seen.add(key)
            if primed and not state.S.get("pending_alert"):
                asyncio.create_task(_countdown(ev))
        primed = True
        await asyncio.sleep(1)


@router.on_event("startup")
async def _start_watcher() -> None:
    asyncio.create_task(_watch())
