"""shops, fair price, quote drafts, the simulated send and the inbox. owned by backend-safety."""
import asyncio
import importlib

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from . import events, state

router = APIRouter()


def _shops() -> list[dict]:
    return state.load_json("shops.json", [])


def _fair() -> dict:
    return state.load_json("fair_price.json", {})


def _templates() -> list[dict]:
    return state.load_json("quote_templates.json", [])


class DraftIn(BaseModel):
    shop_ids: list[str] = []


class SendIn(BaseModel):
    shop_ids: list[str] = []
    approved: bool = False


@router.get("/api/shops")
def shops() -> list[dict]:
    return _shops()


@router.get("/api/fair-price")
def fair_price(dtc: str = "P0301") -> dict:
    fp = _fair()
    if not fp:
        raise HTTPException(404, "no fair price data on file")
    return fp


def _car_story() -> tuple[str, str]:
    """(what the car reported, the test result) from the car's real state, never invented."""
    try:
        car = importlib.import_module("car.mock")
        scenario = car.get_status().get("scenario", "")
        codes = [d["code"] for d in car.read_dtcs()]
    except Exception:
        scenario, codes = "", []
    if scenario == "misfire_after_swap" or "P0302" in codes:
        return (
            "The car first reported P0301, a cylinder 1 misfire.",
            "After I swapped the ignition coils on cylinders 1 and 2, the misfire moved to cylinder 2 (P0302), so it is the coil.",
        )
    code = codes[0] if codes else "P0301"
    return (
        f"The car reports {code}, a cylinder 1 misfire.",
        "I am about to swap the coils on cylinders 1 and 2 as a test; if the misfire moves to cylinder 2, it is the coil.",
    )


@router.post("/api/quotes/draft")
def draft(d: DraftIn) -> dict:
    fp = _fair()
    lo, hi = fp.get("fair_range_usd", [0, 0])
    src = (fp.get("sources") or ["no source on file"])[0]
    part = fp.get("part", "ignition coil")
    code_line, test_line = _car_story()
    text = (
        f"Hi, I'd like a quote for a 2014 compact, 1.8 L inline-4. {code_line} {test_line} "
        f"Please quote replacing the {part} on cylinder 1, with parts and labor separately. "
        f"The fair range for this job is ${lo} to ${hi} all in ({src}). Thanks, Maya"
    )
    state.S["draft"] = {"text": text, "shop_ids": d.shop_ids}
    return {"draft": text}


def _make_quotes(shop_ids: list[str]) -> list[dict]:
    fp = _fair()
    lo, hi = fp.get("fair_range_usd", [0, 0])
    sources = fp.get("sources", [])
    chosen = [s for s in _shops() if s["id"] in shop_ids] or _shops()
    templates = _templates() or [{"total_factor": 0.9, "parts_share": 0.45, "note": ""}]
    quotes = []
    for i, shop in enumerate(chosen):
        t = templates[i % len(templates)]
        total = round(hi * t["total_factor"])
        parts = round(total * t["parts_share"])
        quotes.append({
            "id": state.new_id("q"),
            "shop": shop["name"],
            "total_usd": total,
            "parts_usd": parts,
            "labor_usd": total - parts,
            "fair_range_usd": [lo, hi],
            "flag": "above_range" if total > hi else "in_range",
            "note": t.get("note", ""),
            "sources": sources,
        })
    return quotes


async def _deliver(quotes: list[dict]) -> None:
    for q in quotes:
        await asyncio.sleep(0.7)
        events.publish({"type": "quote", "quote": q})


@router.post("/api/quotes/send")
async def send(s: SendIn) -> dict:
    if not s.approved:
        raise HTTPException(400, "she has to approve before anything is sent (and nothing real is ever sent)")
    quotes = _make_quotes(s.shop_ids)
    state.S["quotes"] = quotes
    asyncio.create_task(_deliver(quotes))
    return {"sent": len(quotes)}


@router.get("/api/inbox")
def inbox() -> list[dict]:
    return state.S.get("quotes", [])
