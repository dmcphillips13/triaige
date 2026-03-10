"""Async Postgres connection pool using asyncpg.

Provides a module-level pool that is initialised on FastAPI startup and
closed on shutdown. All store/settings modules import `get_pool()` to
acquire connections.
"""

from __future__ import annotations

import importlib.resources
import logging
from contextlib import asynccontextmanager

import asyncpg

from app.settings import settings

logger = logging.getLogger(__name__)

_pool: asyncpg.Pool | None = None


async def init_db() -> None:
    """Create the connection pool and run the schema migration."""
    global _pool
    _pool = await asyncpg.create_pool(settings.database_url, min_size=2, max_size=10)
    schema_sql = (importlib.resources.files("app") / "schema.sql").read_text()
    async with _pool.acquire() as conn:
        await conn.execute(schema_sql)
    logger.info("Database initialised")


async def close_db() -> None:
    """Close the connection pool."""
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
    logger.info("Database pool closed")


def get_pool() -> asyncpg.Pool:
    """Return the active connection pool. Raises if not initialised."""
    if _pool is None:
        raise RuntimeError("Database pool not initialised — call init_db() first")
    return _pool
