"""mock car. state in car/state.json, read fresh on every call, written atomically. contract: CLAUDE.md."""
import datetime
import json
import os
import random
import tempfile
from pathlib import Path

STATE_PATH = Path(__file__).with_name("state.json")
DEFAULT = {"scenario": "misfire_before_swap", "engine_running": True, "events": []}
# cyl: the misfiring cylinder (None = healthy). rpm is the running idle before jitter.
SCENARIOS = {
    "misfire_before_swap": {"running": True, "cyl": "1", "rpm": 740, "coolant": 92, "events": []},
    "misfire_after_swap": {"running": True, "cyl": "2", "rpm": 740, "coolant": 92, "events": []},
    "stall": {"running": False, "cyl": "1", "rpm": 740, "coolant": 92, "events": [{"type": "engine_stall", "speed_kph": 45}]},
    "crash": {"running": False, "cyl": "1", "rpm": 740, "coolant": 92, "events": [{"type": "airbag_deployed"}]},
    "ok": {"running": True, "cyl": None, "rpm": 800, "coolant": 90, "events": []},
}
ACTIONS = ("swap_coils_1_2", "engine_off", "engine_on")
UNITS = {"RPM": "rpm", "SPEED": "kph", "COOLANT_TEMP": "C", "SHORT_FUEL_TRIM_1": "percent", "LONG_FUEL_TRIM_1": "percent", "THROTTLE_POS": "percent"}


def _load() -> dict:
    try:
        return {**DEFAULT, **json.loads(STATE_PATH.read_text())}
    except (FileNotFoundError, json.JSONDecodeError):
        return dict(DEFAULT)


def _save(state: dict) -> None:
    fd, tmp = tempfile.mkstemp(dir=STATE_PATH.parent, prefix=".state-", suffix=".json")
    with os.fdopen(fd, "w") as f:
        json.dump(state, f)
    os.replace(tmp, STATE_PATH)


def _scenario() -> dict:
    return SCENARIOS[_load()["scenario"]]


def get_status() -> dict:
    s = _load()
    sc = SCENARIOS[s["scenario"]]
    running = s["engine_running"]
    rpm = 0 if not running else sc["rpm"] + (random.randint(-30, 30) if sc["cyl"] else 0)
    return {"mil_on": sc["cyl"] is not None, "dtc_count": len(read_dtcs()), "rpm": rpm, "speed_kph": 0,
            "coolant_c": sc["coolant"], "engine_running": running, "scenario": s["scenario"]}


def read_dtcs() -> list:
    cyl = _scenario()["cyl"]
    return [] if cyl is None else [{"code": f"P030{cyl}", "desc": f"cylinder {cyl} misfire detected"}]


def read_pid(name: str) -> dict:
    if name not in UNITS:
        return {"error": "unknown pid"}
    st = get_status()
    values = {"RPM": st["rpm"], "SPEED": st["speed_kph"], "COOLANT_TEMP": st["coolant_c"],
              "SHORT_FUEL_TRIM_1": 3.1 if st["mil_on"] else 0.8, "LONG_FUEL_TRIM_1": 5.5 if st["mil_on"] else 1.2,
              "THROTTLE_POS": 14 if st["engine_running"] else 0}
    return {"name": name, "value": values[name], "unit": UNITS[name]}


def misfire_counts() -> dict:
    counts = {"1": 0, "2": 0, "3": 0, "4": 0}
    cyl = _scenario()["cyl"]
    if cyl:
        counts[cyl] = 12 if cyl == "1" else 11
    return counts


def freeze_frame() -> dict:
    sc = _scenario()
    return {"code": f"P030{sc['cyl']}" if sc["cyl"] else None, "rpm": sc["rpm"], "speed_kph": 0, "coolant_c": sc["coolant"], "load_pct": 22}


def events() -> list:
    return _load()["events"]


def set_scenario(name: str) -> dict:
    if name not in SCENARIOS:
        return {"error": "unknown scenario", "known": list(SCENARIOS)}
    sc = SCENARIOS[name]
    at = datetime.datetime.now().isoformat(timespec="seconds")
    _save({"scenario": name, "engine_running": sc["running"], "events": [{**e, "at": at} for e in sc["events"]]})
    return {"scenario": name}


def apply_action(name: str) -> dict:
    s = _load()
    if name == "swap_coils_1_2":
        if s["scenario"] == "misfire_before_swap":
            s["scenario"] = "misfire_after_swap"
    elif name == "engine_off":
        s["engine_running"] = False
    elif name == "engine_on":
        s["engine_running"] = True
    else:
        return {"error": "unknown action", "known": list(ACTIONS)}
    _save(s)
    return get_status()
