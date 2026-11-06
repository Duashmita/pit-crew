"""the diagnosis loop. fixture mode replays claude's words; the car and the rulebook always run for real."""
from __future__ import annotations

import importlib
import json
import re
import time
from pathlib import Path

from . import state

ROOT = state.ROOT
FIXTURES = ROOT / "fixtures"
DIAG_MODEL = "claude-opus-5-5"

# ---------------------------------------------------------------- bridges (car/ and triage/ are other lanes)
_warned: set[str] = set()


def _warn(key: str, msg: str) -> None:
    if key not in _warned:
        _warned.add(key)
        print(f"[loop] {msg}")


class _StubCar:
    """contract-shaped stand-in until car/mock.py lands. same state file, so nothing is lost on the switch."""

    STATE = ROOT / "car" / "state.json"
    KNOWN = ["misfire_before_swap", "misfire_after_swap", "stall", "crash", "ok"]

    def _st(self) -> dict:
        try:
            return json.loads(self.STATE.read_text())
        except Exception:
            return {"scenario": "misfire_before_swap", "engine_running": True, "events": []}

    def _save(self, st: dict) -> None:
        self.STATE.parent.mkdir(exist_ok=True)
        self.STATE.write_text(json.dumps(st, indent=2))

    def get_status(self) -> dict:
        st = self._st()
        s = st["scenario"]
        if s == "ok":
            return {"mil_on": False, "dtc_count": 0, "rpm": 800, "speed_kph": 0, "coolant_c": 90, "engine_running": True, "scenario": s}
        if s in ("stall", "crash"):
            return {"mil_on": True, "dtc_count": 1, "rpm": 0, "speed_kph": 0, "coolant_c": 92, "engine_running": False, "scenario": s}
        running = st.get("engine_running", True)
        return {"mil_on": True, "dtc_count": 1, "rpm": 740 if running else 0, "speed_kph": 0, "coolant_c": 92, "engine_running": running, "scenario": s}

    def read_dtcs(self) -> list:
        s = self._st()["scenario"]
        if s == "ok":
            return []
        if s == "misfire_after_swap":
            return [{"code": "P0302", "desc": "cylinder 2 misfire detected"}]
        return [{"code": "P0301", "desc": "cylinder 1 misfire detected"}]

    def misfire_counts(self) -> dict:
        s = self._st()["scenario"]
        if s == "misfire_after_swap":
            return {"1": 0, "2": 11, "3": 0, "4": 0}
        if s == "ok":
            return {"1": 0, "2": 0, "3": 0, "4": 0}
        return {"1": 12, "2": 0, "3": 0, "4": 0}

    def read_pid(self, name: str) -> dict:
        st = self.get_status()
        table = {"RPM": (st["rpm"], "rpm"), "SPEED": (st["speed_kph"], "kph"), "COOLANT_TEMP": (st["coolant_c"], "C"),
                 "SHORT_FUEL_TRIM_1": (1.5, "percent"), "LONG_FUEL_TRIM_1": (2.3, "percent"), "THROTTLE_POS": (14.0, "percent")}
        if name not in table:
            return {"error": "unknown pid"}
        return {"name": name, "value": table[name][0], "unit": table[name][1]}

    def freeze_frame(self) -> dict:
        d = self.read_dtcs()
        return {"code": d[0]["code"] if d else None, "rpm": 740, "speed_kph": 0, "coolant_c": 92, "load_pct": 22}

    def events(self) -> list:
        return self._st().get("events", [])

    def set_scenario(self, name: str) -> dict:
        if name not in self.KNOWN:
            return {"error": "unknown scenario", "known": self.KNOWN}
        ev = []
        if name == "stall":
            ev = [{"type": "engine_stall", "speed_kph": 45, "at": state.now()}]
        if name == "crash":
            ev = [{"type": "airbag_deployed", "at": state.now()}]
        self._save({"scenario": name, "engine_running": name not in ("stall", "crash"), "events": ev})
        return {"scenario": name}

    def apply_action(self, name: str) -> dict:
        st = self._st()
        if name == "swap_coils_1_2" and st["scenario"] == "misfire_before_swap":
            st["scenario"] = "misfire_after_swap"
        elif name == "engine_off":
            st["engine_running"] = False
        elif name == "engine_on":
            st["engine_running"] = True
        self._save(st)
        return self.get_status()


class _StubTriage:
    """contract-shaped stand-in until triage/run.py (prolog) lands. marked as fallback in every result."""

    FAMILY = {"ignition": (("coil", "plug", "connector"), ["engine_off", "engine_cool"]),
              "fuel": (("injector", "fuel"), ["engine_off", "no_flame"]),
              "battery": (("battery",), ["key_out", "negative_first"])}

    def triage(self, inp: dict) -> dict:
        dtcs = [str(c) for c in inp.get("dtcs", [])]
        ev = set(inp.get("events", []))
        flashing = inp.get("flashing", "unknown")
        misfire = any(c.startswith("P030") for c in dtcs)
        unknowns = ["is the light flashing or steady?"] if (inp.get("mil_on") and flashing == "unknown") else []
        rules = []
        if "airbag_deployed" in ev:
            rules.append(("stop_now", "airbag_deployed", "An airbag has deployed. The car must not be driven; it needs a tow and an inspection."))
        if "engine_stall" in ev:
            rules.append(("stop_now", "engine_stall", "The engine stalled while moving. Get the car off the road and don't keep driving it."))
        if (inp.get("coolant_c") or 0) >= 110:
            rules.append(("stop_now", "engine_overheat", "The engine is overheating. Stop and let it cool before it's damaged."))
        if inp.get("mil_on") and misfire and flashing in ("yes", "unknown"):
            rules.append(("stop_now", "mil_flashing_misfire", "A flashing check-engine light with a misfire means unburned fuel is reaching the exhaust and can damage the catalytic converter. Don't drive it."))
        if not rules:
            rules.append(("ok_to_drive", "mil_steady", "A steady check-engine light and nothing else: safe to drive, get it read soon.") if inp.get("mil_on")
                         else ("ok_to_drive", "no_warnings", "No warning light and no stored codes."))
        order = {"stop_now": 0, "short_trip_only": 1, "ok_to_drive": 2}
        call, rule, why = sorted(rules, key=lambda r: order[r[0]])[0]
        return {"call": call, "rule": rule, "why": why,
                "cite": {"label": "fallback rules (triage lane not loaded)", "url": "", "source_id": "fallback"}, "unknowns": unknowns}

    def check_spec(self, spec: dict) -> dict:
        parts = " ".join(spec.get("parts", [])).lower()
        required: list[str] = []
        for keys, req in self.FAMILY.values():
            if any(k in parts for k in keys):
                required += [r for r in req if r not in required]
        missing = [r for r in required if r not in spec.get("precautions", [])]
        return {"approved": not missing, "missing": missing, "required": required}


_STUB_CAR = _StubCar()
_STUB_TRIAGE = _StubTriage()


def car():
    try:
        return importlib.import_module("car.mock")
    except Exception as e:
        _warn("car", f"car.mock not importable ({e!r}); using the in-file stub")
        return _STUB_CAR


def triage_mod():
    try:
        return importlib.import_module("triage.run")
    except Exception as e:
        _warn("triage", f"triage.run not importable ({e!r}); using the in-file stub")
        return _STUB_TRIAGE


# ---------------------------------------------------------------- her words -> triage input
def flashing_from_words(words: str) -> str:
    w = words.lower()
    if re.search(r"blink|flash", w):
        return "yes"
    if re.search(r"steady|solid|stays on|not flashing", w):
        return "no"
    return "unknown"


def symptoms_from_words(words: str) -> list[str]:
    w = words.lower()
    found = [s for k, s in (("shak", "shaking"), ("died", "stalled"), ("stall", "stalled"), ("hit", "collision"),
                            ("smoke", "smoke"), ("noise", "noise"), ("rough", "rough idle")) if k in w]
    return list(dict.fromkeys(found))


def build_triage_input(words: str, c=None) -> dict:
    c = c or car()
    st = c.get_status()
    flashing = flashing_from_words(words)
    if flashing == "unknown" and state.S.get("flashing"):
        flashing = state.S["flashing"]  # she answered earlier in this session
    if flashing != "unknown":
        state.S["flashing"] = flashing
    return {"mil_on": st["mil_on"], "flashing": flashing, "dtcs": [d["code"] for d in c.read_dtcs()],
            "coolant_c": st["coolant_c"], "warnings": st.get("warnings", []), "battery_v": st.get("battery_v"),
            "events": [e["type"] for e in c.events()], "symptoms": symptoms_from_words(words)}


# ---------------------------------------------------------------- public entry
FIXTURE_SCENARIOS = {"misfire_before_swap", "misfire_after_swap", "stall", "crash", "ok"}


def run_diagnosis(words: str, publish, delay_ms: int = 600) -> list[dict]:
    scenario = car().get_status().get("scenario")
    # the misfire demo path stays scripted; a scenario with no recording goes live when a key exists
    if state.mode() == "live" or (scenario not in FIXTURE_SCENARIOS and state.chat_mode() == "live"):
        try:
            return _live(words, publish, delay_ms)
        except Exception as e:  # never let the demo die on the api
            print(f"[loop] live loop failed ({e!r}); replaying the fixture")
            publish({"type": "text", "text": "Live loop unavailable, replaying a recorded diagnosis."})
    return _fixture(words, publish, delay_ms)


# ---------------------------------------------------------------- fixture replay
def _variant(c) -> str:
    s = c.get_status()["scenario"]
    return {"misfire_before_swap": "before_swap", "misfire_after_swap": "after_swap", "stall": "event", "crash": "event"}.get(s, "ok")


def _fixture(words: str, publish, delay_ms: int) -> list[dict]:
    c, t = car(), triage_mod()
    lines = [json.loads(l) for l in (FIXTURES / f"diagnose_{_variant(c)}.jsonl").read_text().splitlines() if l.strip()]
    out: list[dict] = []

    def emit(ev: dict) -> None:
        out.append(ev)
        publish(ev)
        if ev["type"] != "done" and delay_ms:
            time.sleep(delay_ms / 1000)

    for line in lines:
        kind = line["type"]
        if kind == "tool_call":
            fn = getattr(c, line["tool"])
            args = line.get("args", {})
            emit({"type": "tool_call", "tool": line["tool"], "args": args, "result": fn(**args)})
        elif kind == "triage":
            res = t.triage(build_triage_input(words, c))
            state.S["last_triage"] = res
            emit({"type": "triage", **res})
        elif kind == "diagnosis":
            state.S["last_diagnosis"] = {"causes": line["causes"], "summary": line["summary"]}
            emit(line)
        elif kind == "step":
            spec = line["spec"]
            if spec.get("cost_usd") is None:
                fp = state.load_json("fair_price.json", None)
                spec["cost_usd"] = fp["parts_usd"][0] if fp else None
            emit(_gate_event(spec, t))
        else:
            emit(line)
    return out


def _gate_event(spec: dict, t=None) -> dict:
    t = t or triage_mod()
    gate = t.check_spec(spec)
    state.S["last_step"] = {"spec": spec, "gate": gate}
    if gate.get("approved"):
        return {"type": "step", "spec": spec, "gate": gate}
    return {"type": "step_blocked", "spec": spec, "missing": gate.get("missing", [])}


# ---------------------------------------------------------------- live loop (anthropic sdk, manual tool loop)
SYSTEM = (
    "You are Pit Crew's mechanic brain. A driver describes what her car is doing; you question the car's computer "
    "with the tools, one query at a time, choosing each next query from the evidence (status, codes, misfire counts, "
    "freeze frame, fuel trims). Then, in this order: 1) call triage: the rulebook makes the safety call, you never do; "
    "2) call report_diagnosis with the likely causes ranked, each with its evidence; 3) call propose_step with the "
    "cheapest test that separates the top causes, as a complete step spec whose precautions include engine_off and "
    "engine_cool for any ignition part. Never state a price. If her words say the test was done, read the car again "
    "and report what moved. Narrate at most one short sentence before a tool call. After propose_step, stop. "
    "Use plain words; the first time you use a code or a part name, add a short explanation in parentheses. "
    "Every proposed step lists the precautions the gate requires for its part family: ignition (coil, plug, connector) "
    "engine_off and engine_cool; fuel system including the fuel cap engine_off and no_flame; battery key_out and "
    "negative_first; tires parking_brake and wheel_chocks. If the fix is one she can do herself (tighten the fuel cap, "
    "add air to a tire, let the engine cool and top up coolant, swap two coils), say so and keep it to one step. "
    "When the rulebook says stop_now, say so first, before anything else."
)

_NOARGS = {"type": "object", "properties": {}, "additionalProperties": False}
STEP_SCHEMA = {
    "type": "object",
    "properties": {
        "id": {"type": "string"}, "title": {"type": "string"},
        "parts": {"type": "array", "items": {"type": "string"}},
        "actions": {"type": "array", "items": {"type": "object", "properties": {"verb": {"type": "string"}, "target": {"type": "string"}},
                                                "required": ["verb", "target"], "additionalProperties": False}},
        "tools": {"type": "array", "items": {"type": "string"}},
        "precautions": {"type": "array", "items": {"type": "string"}},
        "expect": {"type": "string"}, "est_minutes": {"type": "integer"}, "cost_usd": {"type": "number"},
    },
    "required": ["id", "title", "parts", "actions", "tools", "precautions", "expect", "est_minutes", "cost_usd"],
    "additionalProperties": False,
}
TOOLS = [
    {"name": "get_status", "description": "Warning light, code count, rpm, speed, coolant, engine running.", "input_schema": _NOARGS},
    {"name": "read_dtcs", "description": "Stored diagnostic trouble codes.", "input_schema": _NOARGS},
    {"name": "misfire_counts", "description": "Misfire count per cylinder (mode 06).", "input_schema": _NOARGS},
    {"name": "freeze_frame", "description": "Conditions when the code was set.", "input_schema": _NOARGS},
    {"name": "events", "description": "Safety events the car reported: engine_stall, airbag_deployed.", "input_schema": _NOARGS},
    {"name": "read_pid", "description": "One live value: RPM, SPEED, COOLANT_TEMP, SHORT_FUEL_TRIM_1, LONG_FUEL_TRIM_1, THROTTLE_POS.",
     "input_schema": {"type": "object", "properties": {"name": {"type": "string"}}, "required": ["name"], "additionalProperties": False}},
    {"name": "triage", "description": "The rulebook's safety call from the car's data and the driver's words. Call it before any step.",
     "input_schema": {"type": "object", "properties": {"flashing": {"type": "string", "enum": ["yes", "no", "unknown"]},
                                                       "symptoms": {"type": "array", "items": {"type": "string"}}},
                      "required": ["flashing", "symptoms"], "additionalProperties": False}},
    {"name": "report_diagnosis", "description": "Report the likely causes ranked with evidence, and a one-paragraph summary.", "strict": True,
     "input_schema": {"type": "object", "properties": {
         "causes": {"type": "array", "items": {"type": "object", "properties": {"cause": {"type": "string"}, "evidence": {"type": "array", "items": {"type": "string"}},
                                                                                 "confidence": {"type": "number"}},
                                                "required": ["cause", "evidence", "confidence"], "additionalProperties": False}},
         "summary": {"type": "string"}}, "required": ["causes", "summary"], "additionalProperties": False}},
    {"name": "propose_step", "description": "Propose the next step as a step spec. The rulebook checks its precautions before anything is drawn.",
     "strict": True, "input_schema": STEP_SCHEMA},
]


def _create(client, **kw):
    try:  # server-side refusal fallback, per the claude-api skill; older sdks don't know the field
        return client.beta.messages.create(betas=["server-side-fallback-2026-07-01"], fallbacks="default", **kw)
    except TypeError:
        return client.messages.create(**kw)


def _live(words: str, publish, delay_ms: int) -> list[dict]:
    import anthropic

    client = state.anthropic_client()
    c, t = car(), triage_mod()
    out: list[dict] = []

    def emit(ev: dict) -> None:
        out.append(ev)
        publish(ev)

    def run_tool(name: str, args: dict) -> str:
        if name == "triage":
            inp = build_triage_input(words, c)
            if args.get("flashing") in ("yes", "no"):
                inp["flashing"] = args["flashing"]
                state.S["flashing"] = args["flashing"]
            inp["symptoms"] = list(dict.fromkeys(inp["symptoms"] + list(args.get("symptoms", []))))
            res = t.triage(inp)
            state.S["last_triage"] = res
            emit({"type": "triage", **res})
            return json.dumps(res)
        if name == "report_diagnosis":
            state.S["last_diagnosis"] = args
            emit({"type": "diagnosis", **args})
            return "recorded"
        if name == "propose_step":
            ev = _gate_event(args, t)
            emit(ev)
            return json.dumps(ev.get("gate") or {"approved": False, "missing": ev["missing"]})
        res = getattr(c, name)(**args)
        emit({"type": "tool_call", "tool": name, "args": args, "result": res})
        return json.dumps(res)

    messages = [{"role": "user", "content": f"Driver says: {words!r}. Scenario context: simulated car, inline-4, one coil per cylinder."}]
    for _ in range(12):
        resp = _create(client, model=DIAG_MODEL, max_tokens=4096, system=SYSTEM, tools=TOOLS, messages=messages,
                       output_config={"effort": "medium"})
        if resp.stop_reason == "refusal":
            raise RuntimeError("refused")
        for b in resp.content:
            if b.type == "text" and b.text.strip():
                emit({"type": "text", "text": b.text.strip()})
        uses = [b for b in resp.content if b.type == "tool_use"]
        messages.append({"role": "assistant", "content": resp.content})
        if resp.stop_reason == "pause_turn":
            continue
        if not uses:
            break
        results = []
        for u in uses:
            try:
                content = run_tool(u.name, dict(u.input))
                results.append({"type": "tool_result", "tool_use_id": u.id, "content": content})
            except Exception as e:
                results.append({"type": "tool_result", "tool_use_id": u.id, "content": f"error: {e!r}", "is_error": True})
        messages.append({"role": "user", "content": results})
        if delay_ms:
            time.sleep(min(delay_ms, 300) / 1000)
    emit({"type": "done"})
    return out
