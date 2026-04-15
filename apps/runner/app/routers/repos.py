"""Repository settings, API keys, OpenAI keys, and known failure endpoints."""

import logging

from fastapi import APIRouter, HTTPException, Request

from app import repo_settings, store
from app.repo_settings import RepoSettings
from app.routers._auth import check_repo_access

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/repos/{repo:path}")


@router.get("/settings", response_model=RepoSettings)
async def get_repo_settings(repo: str, request: Request):
    """Get triage mode settings for a repo."""
    check_repo_access(request, repo)
    return await repo_settings.get_settings(repo)


@router.put("/settings", response_model=RepoSettings)
async def put_repo_settings(repo: str, req: RepoSettings, request: Request):
    """Update triage mode settings for a repo."""
    check_repo_access(request, repo)
    return await repo_settings.put_settings(repo, req)


@router.get("/api-key")
async def get_repo_api_key(repo: str, request: Request):
    """Get or generate the API key for a repo."""
    check_repo_access(request, repo)
    key = await repo_settings.get_or_create_api_key(repo)
    return {"api_key": key}


@router.get("/openai-key")
async def get_openai_key(repo: str, request: Request):
    """Get the masked OpenAI key for a repo, or null if not set."""
    check_repo_access(request, repo)
    key = await repo_settings.get_openai_key(repo)
    if not key:
        return {"masked": None}
    return {"masked": repo_settings.mask_key(key)}


@router.put("/openai-key")
async def put_openai_key(repo: str, request: Request):
    """Validate and store an encrypted OpenAI API key for a repo."""
    check_repo_access(request, repo)
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid request body")

    key = body.get("openai_api_key") if isinstance(body, dict) else None
    if not key or not isinstance(key, str):
        raise HTTPException(status_code=400, detail="openai_api_key is required")

    from app.clients.openai_validation import validate_openai_key

    valid = await validate_openai_key(key)
    if not valid:
        raise HTTPException(status_code=400, detail="Invalid OpenAI API key")

    await repo_settings.store_openai_key(repo, key)
    return {"masked": repo_settings.mask_key(key)}


@router.delete("/openai-key")
async def delete_openai_key(repo: str, request: Request):
    """Remove the stored OpenAI API key for a repo."""
    check_repo_access(request, repo)
    await repo_settings.delete_openai_key(repo)
    return {"status": "deleted"}


@router.get("/known-failures")
async def list_repo_known_failures(repo: str, request: Request):
    """List open known failures for a repo's Main tab health dashboard."""
    check_repo_access(request, repo)
    return await store.list_known_failures(repo)


@router.get("/known-failures/closed")
async def list_repo_closed_known_failures(repo: str, request: Request):
    """List closed known failures for a repo."""
    check_repo_access(request, repo)
    return await store.get_closed_known_failures(repo)


@router.patch("/known-failures/{failure_id}/close")
async def close_repo_known_failure(repo: str, failure_id: int, request: Request):
    """Close a known failure and its GitHub issue."""
    check_repo_access(request, repo)
    row = await store.close_known_failure(failure_id)
    if not row:
        raise HTTPException(status_code=404, detail="Known failure not found or already closed")

    issue_error = None
    if row["issue_number"]:
        try:
            from app.tools.github_checks import _get_client

            client = _get_client(repo)
            resp = client.patch(
                f"/repos/{repo}/issues/{row['issue_number']}",
                json={"state": "closed"},
            )
            resp.raise_for_status()
            logger.info("Closed GitHub issue #%s on %s", row["issue_number"], repo)
        except Exception as e:
            issue_error = "Failed to close GitHub issue"
            logger.warning("Failed to close GitHub issue #%s: %s", row["issue_number"], e)

    return {"status": "closed", "issue_error": issue_error}
