"""conversational mode: her words plus an optional photo. live claude answers, reads the car, and annotates the photo.
fixture mode (no key) or any api error returns a canned reply so the demo never dies."""
from __future__ import annotations

import json
import traceback

from fastapi import APIRouter
from pydantic import BaseModel

from . import events, state
from . import loop as loop_mod

router = APIRouter()
MODEL = "claude-opus-5-5"
MAX_TURNS = 6

SYSTEM = """You are Pit Crew, a calm mechanic who puts safety first. You are talking with Maya about her car.
- Read the car's own data with the tools before guessing: warning lights, codes, misfire counts, events.
- Call triage before any advice about driving. The safety call comes from that rulebook, not from you. If it says stop_now or short_trip_only, say so plainly in your first sentence, name the rule, and remind her the app can tell her people where she is.
- Never state a price without a source.
- If she asks, this is a simulated demo: the car, the shops and the friends are synthetic.
- When a photo is attached, call annotate_photo with up to 6 boxes around the parts that matter for her problem (x, y, w, h as fractions of the image, top-left origin), then refer to them by number in your reply: "1: the ignition coils, 2: ...". Say what you can and cannot tell from a photo.
- Keep replies under 120 words, plain spoken sentences, no markdown."""

FIXTURE_ANNOTATIONS = [
    {"label": "Ignition coils", "x": 0.30, "y": 0.18, "w": 0.40, "h": 0.16, "note": "One coil per cylinder sits on top of the engine. The cheapest test swaps two of them."},
    {"label": "Dipstick", "x": 0.12, "y": 0.42, "w": 0.10, "h": 0.22, "note": "Pull it to check the oil level while the engine is off."},
    {"label": "Battery", "x": 0.72, "y": 0.55, "w": 0.22, "h": 0.25, "note": "Disconnect the negative terminal first if you ever work near wiring."},
]


class ChatIn(BaseModel):
    messages: list[dict]
    image: dict | None = None


def _obj(props: dict, req: list[str]) -> dict:
    return {"type": "object", "properties": props, "required": req, "additionalProperties": False}


def _tools(with_image: bool) -> list[dict]:
    tools = [
        {"name": "get_status", "strict": True, "input_schema": _obj({}, []),
         "description": "Read the car's warning-light status, rpm, speed, coolant temperature and whether the engine is running."},
        {"name": "read_dtcs", "strict": True, "input_schema": _obj({}, []),
         "description": "Read the stored diagnostic trouble codes, for example P0301 cylinder 1 misfire."},
        {"name": "misfire_counts", "strict": True, "input_schema": _obj({}, []),
         "description": "Misfire counts per cylinder since the engine started."},
        {"name": "events", "strict": True, "input_schema": _obj({}, []),
         "description": "Recent car events such as engine_stall or airbag_deployed."},
        {"name": "triage", "strict": True,
         "input_schema": _obj({"words": {"type": "string", "description": "what she said about the car, verbatim"}}, ["words"]),
         "description": "The safety rulebook. Returns the call (stop_now, short_trip_only, ok_to_drive), the rule that fired and its source. Call it before any advice about driving."},
    ]
    if with_image:
        box = _obj({"label": {"type": "string"}, "x": {"type": "number"}, "y": {"type": "number"}, "w": {"type": "number"},
                    "h": {"type": "number"}, "note": {"type": "string"}}, ["label", "x", "y", "w", "h", "note"])
        tools.append({"name": "annotate_photo", "strict": True,
                      "input_schema": _obj({"annotations": {"type": "array", "items": box}}, ["annotations"]),
                      "description": "Draw up to 6 labeled boxes over her photo. x, y, w, h are fractions of the image in 0..1 with x, y at the box's top-left."})
    return tools


def _clamp(anns: list[dict]) -> list[dict]:
    out = []
    for a in anns[:6]:
        try:
            x, y = min(max(float(a["x"]), 0.0), 1.0), min(max(float(a["y"]), 0.0), 1.0)
            w, h = min(max(float(a["w"]), 0.01), 1.0 - x), min(max(float(a["h"]), 0.01), 1.0 - y)
            if w < 0.01 or h < 0.01:  # off the image after clamping
                continue
            out.append({"label": str(a.get("label", ""))[:60], "x": x, "y": y, "w": w, "h": h, "note": str(a.get("note", ""))[:200]})
        except (KeyError, TypeError, ValueError):
            continue
    return out


def _run_tool(name: str, inp: dict, words: str):
    c = loop_mod.car()
    if name == "get_status":
        return c.get_status()
    if name == "read_dtcs":
        return c.read_dtcs()
    if name == "misfire_counts":
        return c.misfire_counts()
    if name == "events":
        return c.events()
    if name == "triage":
        t = loop_mod.triage_mod().triage(loop_mod.build_triage_input(inp.get("words") or words, c))
        state.S["last_triage"] = t
        events.publish({"type": "triage", **t})
        return t
    if name == "annotate_photo":
        return {"ok": True, "boxes": len(inp.get("annotations", []))}
    return {"error": f"unknown tool {name}"}


def _api_messages(msgs: list[dict], image: dict | None) -> tuple[list[dict], str]:
    out = [{"role": m["role"], "content": m["content"]} for m in msgs if m.get("role") in ("user", "assistant") and m.get("content")]
    if not out or out[0]["role"] != "user":
        out.insert(0, {"role": "user", "content": "Hi."})
    words = next((m["content"] for m in reversed(out) if m["role"] == "user" and isinstance(m["content"], str)), "")
    if image and image.get("data"):
        data = image["data"].split(",", 1)[-1]  # tolerate a data: url prefix
        last = next(i for i in range(len(out) - 1, -1, -1) if out[i]["role"] == "user")
        out[last] = {"role": "user", "content": [
            {"type": "image", "source": {"type": "base64", "media_type": image.get("media_type", "image/jpeg"), "data": data}},
            {"type": "text", "text": out[last]["content"] or "Here is a photo of the engine bay. What should I look at?"},
        ]}
    return out, words


def _live(msgs: list[dict], image: dict | None) -> dict:
    import anthropic

    client = state.anthropic_client()
    api_msgs, words = _api_messages(msgs, image)
    tools = _tools(image is not None)
    tool_calls: list[dict] = []
    annotations: list[dict] = []
    triage = None
    resp = None
    for _ in range(MAX_TURNS):
        resp = loop_mod._create(client, model=MODEL, max_tokens=1500, system=SYSTEM, tools=tools,
                                output_config={"effort": "low"}, messages=api_msgs)
        if resp.stop_reason == "refusal":
            break
        uses = [b for b in resp.content if b.type == "tool_use"]
        if not uses:
            break
        api_msgs.append({"role": "assistant", "content": resp.content})
        results = []
        for u in uses:
            inp = u.input if isinstance(u.input, dict) else json.loads(u.input)
            out = _run_tool(u.name, inp, words)
            if u.name == "annotate_photo":
                annotations = _clamp(inp.get("annotations", []))
            if u.name == "triage":
                triage = out
            tool_calls.append({"tool": u.name, "result": out})
            events.publish({"type": "chat_tool", "tool": u.name, "result": out})
            results.append({"type": "tool_result", "tool_use_id": u.id, "content": json.dumps(out)})
        api_msgs.append({"role": "user", "content": results})
    reply = " ".join(b.text for b in (resp.content if resp else []) if b.type == "text").strip()
    if not reply and resp is not None and resp.stop_reason != "refusal":  # out of turns mid-tool-use: ask for the answer in words
        final = loop_mod._create(client, model=MODEL, max_tokens=1500, system=SYSTEM, tools=tools,
                                 tool_choice={"type": "none"}, output_config={"effort": "low"}, messages=api_msgs)
        reply = " ".join(b.text for b in final.content if b.type == "text").strip()
    if not reply:
        reply = "I couldn't answer that one. Tell me what the car is doing, or tap SOS if you feel unsafe."
    return {"reply": reply, "annotations": annotations, "mode": "live", "tool_calls": tool_calls, "triage": triage}


def _fixture(msgs: list[dict], image: dict | None) -> dict:
    c = loop_mod.car()
    codes = ", ".join(f"{d['code']} ({d['desc']})" for d in c.read_dtcs()) or "no stored codes"
    reply = ("Live chat needs an API key: put ANTHROPIC_API_KEY in .env and I'll read the car and your photo for real. "
             f"Right now the car reports {codes}. ")
    if image:
        reply += "On the photo: 1: the ignition coils, 2: the dipstick, 3: the battery. The cheapest test is to swap two coils, engine off and cool."
    return {"reply": reply, "annotations": FIXTURE_ANNOTATIONS if image else [], "mode": "fixture", "tool_calls": [], "triage": None}


@router.post("/api/chat")
def chat(body: ChatIn) -> dict:  # sync on purpose: runs in the threadpool, publish is thread-safe
    if state.mode() == "live":
        try:
            out = _live(body.messages, body.image)
        except Exception as e:  # never let the demo die on the api
            print(f"[chat] live failed, using fixture: {e!r}\n{traceback.format_exc()[-800:]}")
            out = _fixture(body.messages, body.image)
    else:
        out = _fixture(body.messages, body.image)
    events.publish({"type": "chat_reply", "reply": out["reply"], "annotations": out["annotations"], "mode": out["mode"]})
    return out
