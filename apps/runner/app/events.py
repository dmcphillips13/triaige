"""In-memory event bus for SSE fan-out.

Single-process design — each subscriber gets its own asyncio.Queue.
Events are lightweight notifications (type + data), not full payloads.
"""

import asyncio
import json
import logging
from typing import Any

logger = logging.getLogger(__name__)

_subscribers: list[asyncio.Queue] = []


def subscribe() -> asyncio.Queue:
    """Create a new subscriber queue."""
    q: asyncio.Queue = asyncio.Queue()
    _subscribers.append(q)
    return q


def unsubscribe(q: asyncio.Queue) -> None:
    """Remove a subscriber queue."""
    try:
        _subscribers.remove(q)
    except ValueError:
        pass


def emit(event: str, data: dict[str, Any]) -> None:
    """Send an event to all subscribers."""
    msg = {"event": event, "data": data}
    for q in _subscribers:
        try:
            q.put_nowait(msg)
        except asyncio.QueueFull:
            logger.warning("Subscriber queue full, dropping event %s", event)


def format_sse(event: str, data: dict[str, Any]) -> str:
    """Format a message as SSE text."""
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"
