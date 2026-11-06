"""sse fan-out. publish() is safe from sync code, threads and tasks."""
import asyncio
import json

from sse_starlette.sse import EventSourceResponse

_subs: set[asyncio.Queue] = set()
_loop: asyncio.AbstractEventLoop | None = None


def set_loop(loop: asyncio.AbstractEventLoop) -> None:
    global _loop
    _loop = loop


def publish(event: dict) -> None:
    data = json.dumps(event)
    for q in list(_subs):
        if _loop and _loop.is_running():
            _loop.call_soon_threadsafe(q.put_nowait, data)
        else:
            q.put_nowait(data)


def stream() -> EventSourceResponse:
    q: asyncio.Queue = asyncio.Queue()
    _subs.add(q)

    async def gen():
        try:
            while True:
                yield {"data": await q.get()}
        finally:
            _subs.discard(q)

    return EventSourceResponse(gen(), ping=15)
