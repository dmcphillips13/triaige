"""FastAPI application for the Triaige runner.

App factory: creates the FastAPI instance, registers middleware (auth,
rate limiting, CORS), and includes all route modules.
"""

import asyncio
import logging
import re
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app import rate_limit
from app.db import close_db, init_db
from app.settings import settings

logger = logging.getLogger(__name__)

_KEY_RE = re.compile(r"sk-[A-Za-z0-9_-]{20,}")


class _KeyRedactingFilter(logging.Filter):
    """Prevent OpenAI API keys from leaking into log output."""

    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.msg, str):
            record.msg = _KEY_RE.sub("sk-***REDACTED***", record.msg)
        return True


logging.getLogger().addFilter(_KeyRedactingFilter())


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    try:
        from app.retrieval.qdrant_store import ensure_collection
        await asyncio.to_thread(ensure_collection)
    except Exception as e:
        logger.warning("Qdrant collection setup failed (non-fatal): %s", e)
    yield
    await close_db()


# ---------------------------------------------------------------------------
# App instance
# ---------------------------------------------------------------------------


app = FastAPI(
    title="Triaige Runner",
    lifespan=lifespan,
    docs_url="/docs" if settings.enable_docs else None,
    redoc_url="/redoc" if settings.enable_docs else None,
    openapi_url="/openapi.json" if settings.enable_docs else None,
)


# ---------------------------------------------------------------------------
# Middleware
# ---------------------------------------------------------------------------


class ApiKeyMiddleware(BaseHTTPMiddleware):
    OPEN_PATHS = {"/health"}

    async def dispatch(self, request: Request, call_next):
        if request.url.path in self.OPEN_PATHS:
            return await call_next(request)

        auth = request.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            auth_allowed = await rate_limit.check_auth_failure_rate(request)
            if not auth_allowed:
                return JSONResponse(
                    status_code=429,
                    content={"error": "rate_limit_exceeded", "message": "Too many failed auth attempts. Try again later."},
                    headers={"Retry-After": "60"},
                )
            return JSONResponse(status_code=401, content={"detail": "Unauthorized"})

        token = auth[7:]  # Strip "Bearer "

        # Check global API key first (dashboard proxy uses this)
        if settings.api_key and token == settings.api_key:
            request.state.authenticated_repo = None  # global key — no repo restriction
            return await self._check_rate_and_proceed(request, call_next)

        # Check per-repo API keys (CI workflows use these)
        from app.repo_settings import validate_repo_api_key
        repo = await validate_repo_api_key(token)
        if repo:
            request.state.authenticated_repo = repo  # restrict to this repo only
            return await self._check_rate_and_proceed(request, call_next)

        # Invalid token — rate limit by IP
        auth_allowed = await rate_limit.check_auth_failure_rate(request)
        if not auth_allowed:
            return JSONResponse(
                status_code=429,
                content={"error": "rate_limit_exceeded", "message": "Too many failed auth attempts. Try again later."},
                headers={"Retry-After": "60"},
            )
        return JSONResponse(status_code=401, content={"detail": "Unauthorized"})

    async def _check_rate_and_proceed(self, request: Request, call_next):
        """Check rate limit for an authenticated request, then proceed or reject."""
        allowed, limit, remaining, reset_time = await rate_limit.check_rate_limit(request)

        if not allowed:
            headers = rate_limit.rate_limit_headers(limit, remaining, reset_time)
            return JSONResponse(
                status_code=429,
                content={"error": "rate_limit_exceeded", "message": "Too many requests. Try again later."},
                headers=headers,
            )

        response = await call_next(request)

        if limit > 0:
            headers = rate_limit.rate_limit_headers(limit, remaining, reset_time)
            for key, value in headers.items():
                response.headers[key] = value

        return response


app.add_middleware(ApiKeyMiddleware)

origins = [o.strip() for o in settings.cors_origins.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------

from app.routers import actions, health, repos, runs, triage  # noqa: E402

app.include_router(health.router)
app.include_router(repos.router)
app.include_router(runs.router)
app.include_router(triage.router)
app.include_router(actions.router)
