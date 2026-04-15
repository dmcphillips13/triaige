"""Shared access-control helpers for route handlers."""

import logging

from fastapi import HTTPException, Request

from app import repo_settings, store

logger = logging.getLogger(__name__)


def check_repo_access(request: Request, repo: str) -> None:
    """Ensure the authenticated token has access to the requested repo.

    Global API keys (dashboard proxy) can access any repo.
    Per-repo API keys can only access the repo they were generated for.
    """
    auth_repo = getattr(request.state, "authenticated_repo", None)
    if auth_repo is not None and auth_repo != repo:
        raise HTTPException(status_code=403, detail="Access denied for this repo")


async def check_run_access(request: Request, run_id: str) -> None:
    """Ensure the authenticated token can access this run's repo.

    Returns 404 (not 403) for unauthorized access to prevent run enumeration.
    """
    auth_repo = getattr(request.state, "authenticated_repo", None)
    if auth_repo is None:
        return  # global key — skip DB query entirely
    repo = await store.get_run_repo(run_id)
    if repo is None or auth_repo != repo:
        raise HTTPException(status_code=404, detail="Run not found")


async def resolve_openai_key(request: Request, repo: str | None) -> str:
    """Resolve the OpenAI API key from header or DB. No fallback to the global key."""
    header_key = request.headers.get("X-OpenAI-Key")
    if header_key and header_key.strip():
        return header_key.strip()

    if repo:
        db_key = await repo_settings.get_openai_key(repo)
        if db_key:
            return db_key

    raise HTTPException(
        status_code=400,
        detail="OpenAI API key required. Set it in dashboard settings or pass X-OpenAI-Key header.",
    )
