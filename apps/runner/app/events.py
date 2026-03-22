"""In-memory event bus for SSE fan-out with connection hardening.

Single-process design — each subscriber gets its own bounded asyncio.Queue.

Limits:
- MAX_SUBSCRIBERS (200): global cap on concurrent SSE connections.
- MAX_PER_USER (3): per-user connection limit (prevents reconnection loops).
- QUEUE_MAX_SIZE (50): bounded queue per subscriber. On full, the subscriber
  is marked for disconnect — EventSource auto-reconnects.
- MAX_LIFETIME_SECONDS (3600): connections older than 1 hour are closed to
  prevent zombie connections from laptop lid closures, etc.
"""

import asyncio
import json
import logging
import time
from typing import Any

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Tunable limits
# ---------------------------------------------------------------------------

MAX_SUBSCRIBERS = 200
MAX_PER_USER = 3
QUEUE_MAX_SIZE = 50
MAX_LIFETIME_SECONDS = 3600  # 1 hour

# ---------------------------------------------------------------------------
# Subscriber tracking
# ---------------------------------------------------------------------------


class Subscriber:
    """A single SSE subscriber with metadata for limit enforcement."""

    __slots__ = ("queue", "user_id", "created_at", "disconnected")

    def __init__(self, user_id: str | None) -> None:
        self.queue: asyncio.Queue = asyncio.Queue(maxsize=QUEUE_MAX_SIZE)
        self.user_id = user_id
        self.created_at = time.monotonic()
        self.disconnected = False


_subscribers: list[Subscriber] = []


def subscriber_count() -> int:
    """Return the current number of active subscribers."""
    return len(_subscribers)


def subscribe(user_id: str | None = None) -> Subscriber | None:
    """Create a new subscriber. Returns None if limits are exceeded."""
    # Global cap
    if len(_subscribers) >= MAX_SUBSCRIBERS:
        logger.warning(
            "SSE global subscriber cap reached (%d). Rejecting connection.",
            MAX_SUBSCRIBERS,
        )
        return None

    # Per-user cap
    if user_id:
        user_count = sum(1 for s in _subscribers if s.user_id == user_id)
        if user_count >= MAX_PER_USER:
            logger.warning(
                "SSE per-user cap reached for %s (%d). Rejecting connection.",
                user_id,
                MAX_PER_USER,
            )
            return None

    sub = Subscriber(user_id)
    _subscribers.append(sub)
    logger.info(
        "SSE subscriber connected (user=%s, total=%d)",
        user_id or "anonymous",
        len(_subscribers),
    )
    return sub


def unsubscribe(sub: Subscriber) -> None:
    """Remove a subscriber."""
    try:
        _subscribers.remove(sub)
    except ValueError:
        pass
    logger.info(
        "SSE subscriber disconnected (user=%s, total=%d)",
        sub.user_id or "anonymous",
        len(_subscribers),
    )


def is_expired(sub: Subscriber) -> bool:
    """Check if a subscriber has exceeded the max connection lifetime."""
    return (time.monotonic() - sub.created_at) > MAX_LIFETIME_SECONDS


def emit(event: str, data: dict[str, Any]) -> None:
    """Send an event to all subscribers. Mark full subscribers for disconnect."""
    msg = {"event": event, "data": data}
    for sub in _subscribers:
        if sub.disconnected:
            continue
        try:
            sub.queue.put_nowait(msg)
        except asyncio.QueueFull:
            logger.warning(
                "SSE queue full for user=%s, marking for disconnect",
                sub.user_id or "anonymous",
            )
            sub.disconnected = True


def format_sse(event: str, data: dict[str, Any]) -> str:
    """Format a message as SSE text."""
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"
