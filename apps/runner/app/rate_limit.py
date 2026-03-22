"""Rate limiting module using the `limits` library.

Async moving-window rate limiter integrated into ApiKeyMiddleware.
Three tiers based on endpoint cost, plus auth-failure limiting by IP.

Key strategy:
- Per-repo API keys (CI): rate limit by repo name
- Global API key (dashboard proxy): rate limit by X-Dashboard-User header
- Auth failures: rate limit by client IP

In-memory storage — counters reset on deploy/restart. Acceptable for a
single Render instance. Migrate to Redis when scaling horizontally.
"""

import time

from limits import parse
from limits.aio.storage import MemoryStorage
from limits.aio.strategies import MovingWindowRateLimiter
from starlette.requests import Request

# ---------------------------------------------------------------------------
# Storage & limiter (module-level singletons)
# ---------------------------------------------------------------------------

_storage = MemoryStorage()
_limiter = MovingWindowRateLimiter(_storage)

# ---------------------------------------------------------------------------
# Rate limit definitions — easy to tune
# ---------------------------------------------------------------------------

# Expensive: triggers LLM calls billed to BYOK key
RATE_EXPENSIVE = parse("20/minute")

# Mutation: GitHub API calls, embedding calls
RATE_MUTATION = parse("30/minute")

# General: DB reads/writes
RATE_GENERAL = parse("60/minute")

# Auth failures: brute-force prevention (per IP)
RATE_AUTH_FAILURE = parse("5/minute")

# ---------------------------------------------------------------------------
# Endpoint → tier mapping
# ---------------------------------------------------------------------------

_EXPENSIVE_ENDPOINTS = {"/triage-run", "/ask"}

_MUTATION_ENDPOINTS = {"/update-baselines", "/create-issues", "/feedback"}

_EXEMPT_ENDPOINTS = {"/health", "/events"}


def get_rate_for_path(path: str) -> "parse | None":
    """Return the rate limit for a given URL path, or None if exempt."""
    if path in _EXEMPT_ENDPOINTS:
        return None

    # Normalize: strip trailing slash, match first path segment
    clean = path.rstrip("/")

    if clean in _EXPENSIVE_ENDPOINTS:
        return RATE_EXPENSIVE

    if clean in _MUTATION_ENDPOINTS:
        return RATE_MUTATION

    return RATE_GENERAL


# ---------------------------------------------------------------------------
# Key functions
# ---------------------------------------------------------------------------


def get_rate_key(request: Request) -> str:
    """Build the rate limit key based on authentication context.

    - Per-repo key (CI): "repo:{repo_name}"
    - Global key (dashboard): "user:{github_login}" or "global:unknown"
    """
    auth_repo = getattr(request.state, "authenticated_repo", None)

    if auth_repo is not None:
        # Per-repo API key — rate limit by repo
        return f"repo:{auth_repo}"

    # Global API key — use dashboard user header for per-user limiting
    dashboard_user = request.headers.get("X-Dashboard-User")
    if dashboard_user:
        return f"user:{dashboard_user}"

    return "global:unknown"


def get_client_ip(request: Request) -> str:
    """Extract client IP for auth-failure rate limiting."""
    if request.client:
        return request.client.host
    return "unknown"


# ---------------------------------------------------------------------------
# Core rate limit checks
# ---------------------------------------------------------------------------


async def check_rate_limit(request: Request) -> tuple[bool, int, int, float]:
    """Check the rate limit for an authenticated request.

    Returns (allowed, limit, remaining, reset_time).
    """
    rate = get_rate_for_path(request.url.path)
    if rate is None:
        return (True, 0, 0, 0)

    key = get_rate_key(request)
    namespace = request.url.path.rstrip("/")

    allowed = await _limiter.hit(rate, namespace, key)
    stats = await _limiter.get_window_stats(rate, namespace, key)

    return (allowed, rate.amount, stats.remaining, stats.reset_time)


async def check_auth_failure_rate(request: Request) -> bool:
    """Check whether an auth-failure rate limit has been exceeded.

    Returns True if the request is allowed, False if rate-limited.
    """
    ip = get_client_ip(request)
    return await _limiter.hit(RATE_AUTH_FAILURE, "auth_failure", ip)


# ---------------------------------------------------------------------------
# Response headers
# ---------------------------------------------------------------------------


def rate_limit_headers(limit: int, remaining: int, reset_time: float) -> dict[str, str]:
    """Build standard rate limit response headers."""
    reset_epoch = int(reset_time)
    retry_after = max(0, reset_epoch - int(time.time()))

    return {
        "X-RateLimit-Limit": str(limit),
        "X-RateLimit-Remaining": str(max(0, remaining)),
        "X-RateLimit-Reset": str(reset_epoch),
        "Retry-After": str(retry_after),
    }
