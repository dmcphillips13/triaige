"""Health check and SSE event streaming."""

import asyncio
import logging

from fastapi import APIRouter, Request
from starlette.responses import JSONResponse, StreamingResponse

from app import events

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/health")
async def health():
    return {"status": "ok"}


@router.get("/events")
async def sse_events(request: Request):
    """SSE endpoint — streams run_created/run_closed events to dashboard.

    Enforces global subscriber cap (200), per-user limit (3), bounded
    queues (50), and max connection lifetime (1 hour).
    """
    user_id = request.headers.get("X-Dashboard-User")
    sub = events.subscribe(user_id=user_id)
    if sub is None:
        return JSONResponse(
            status_code=503,
            content={"error": "SSE connection limit reached. Try again later."},
            headers={"Retry-After": "10"},
        )

    async def stream():
        try:
            while True:
                if events.is_expired(sub):
                    logger.info("SSE connection expired (user=%s)", user_id or "anonymous")
                    break
                if sub.disconnected:
                    logger.info("SSE client disconnected due to full queue (user=%s)", user_id or "anonymous")
                    break
                try:
                    msg = await asyncio.wait_for(sub.queue.get(), timeout=15)
                    yield events.format_sse(msg["event"], msg["data"])
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            events.unsubscribe(sub)

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
