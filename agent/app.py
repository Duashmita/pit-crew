"""pit crew backend. lanes own agent/diagnose.py, agent/safety.py, agent/shops.py; each exposes `router`."""
import asyncio
import importlib

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import events, state

app = FastAPI(title="pit crew")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.on_event("startup")
async def _startup() -> None:
    events.set_loop(asyncio.get_running_loop())


@app.get("/api/health")
def health() -> dict:
    return {"ok": True, "mode": state.mode()}


@app.get("/api/events")
async def sse():
    return events.stream()


for _name in ("diagnose", "safety", "shops"):
    try:
        app.include_router(importlib.import_module(f"agent.{_name}").router)
    except Exception as e:  # a lane that isn't ready yet must not take the app down
        print(f"[app] router {_name} not loaded: {e!r}")
