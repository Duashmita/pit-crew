"""backend-diagnose lane: car routes, triage and gate routes, the diagnosis loop, did-it, render."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from . import events, state
from . import loop as loop_mod
from . import render as render_mod

router = APIRouter(prefix="/api")


class ScenarioIn(BaseModel):
    name: str


class DiagnoseIn(BaseModel):
    words: str = ""
    delay_ms: int = 600


class DidItIn(BaseModel):
    step: str = "swap-coils-1-2"
    delay_ms: int = 600


def snapshot() -> dict:
    c = loop_mod.car()
    return {"status": c.get_status(), "dtcs": c.read_dtcs(), "misfire_counts": c.misfire_counts(), "events": c.events()}


def _publish_car(snap: dict) -> None:
    events.publish({"type": "car", "status": snap["status"], "misfire_counts": snap["misfire_counts"]})


@router.get("/car")
def get_car() -> dict:
    return snapshot()


@router.post("/car/scenario")
def set_scenario(body: ScenarioIn) -> dict:
    r = loop_mod.car().set_scenario(body.name)
    if "error" in r:
        raise HTTPException(400, r)
    snap = snapshot()
    _publish_car(snap)
    return snap


@router.post("/diagnose")
def diagnose(body: DiagnoseIn) -> dict:  # sync on purpose: runs in the threadpool, publish is thread-safe
    return {"events": loop_mod.run_diagnosis(body.words, events.publish, body.delay_ms)}


@router.post("/did-it")
def did_it(body: DidItIn) -> dict:
    if body.step == "swap-coils-1-2":
        loop_mod.car().apply_action("swap_coils_1_2")
    snap = snapshot()
    _publish_car(snap)
    return {"events": loop_mod.run_diagnosis(f"I did it: {body.step}", events.publish, body.delay_ms)}


@router.post("/triage")
def triage(body: dict) -> dict:
    return loop_mod.triage_mod().triage(body)


@router.post("/gate")
def gate(body: dict) -> dict:
    return loop_mod.triage_mod().check_spec(body)


@router.post("/render")
def render(body: dict) -> dict:
    return {"svg": render_mod.render(body)}
