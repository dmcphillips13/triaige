"""Action endpoints — feedback, baseline updates, and issue creation."""

import asyncio
import logging

from fastapi import APIRouter, HTTPException, Request

from app import repo_settings, store
from app.episodic import store_episode
from app.routers._auth import check_repo_access, check_run_access
from app.schemas import (
    CreateIssuesRequest,
    CreateIssuesResponse,
    FeedbackRequest,
    ReportCleanRequest,
    UpdateBaselinesRequest,
    UpdateBaselinesResponse,
)
from app.services import baselines as baselines_service
from app.services import issues as issues_service
from app.services import merge_lifecycle

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/report-clean")
async def report_clean(req: ReportCleanRequest, request: Request):
    """Report that all visual tests passed — creates a passing check run.

    Also auto-closes pre-merge runs when a PR merges and all tests pass
    (no post-merge triage run is created in this case).
    """
    check_repo_access(request, req.repo)
    try:
        result = await merge_lifecycle.handle_report_clean(req)
        if result.get("status") == "error":
            raise HTTPException(status_code=502, detail=result["reason"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Unexpected error in /report-clean for %s: %s", req.repo, e, exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/feedback")
async def feedback(req: FeedbackRequest, request: Request):
    """Store human verdict as an episode in Qdrant for future few-shot retrieval."""
    if req.verdict not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="Verdict must be 'approved' or 'rejected'")

    # Access check FIRST — before any data read/write
    run_repo = await store.get_run_repo(req.run_id)
    auth_repo = getattr(request.state, "authenticated_repo", None)
    if auth_repo is not None and (run_repo is None or auth_repo != run_repo):
        raise HTTPException(status_code=404, detail="Run not found")

    result = await store.get_result(req.run_id, req.test_name)
    if not result:
        raise HTTPException(status_code=404, detail="Result not found")

    # Persist the verdict in Postgres
    await store.set_verdict(req.run_id, req.test_name, req.verdict)

    # Resolve BYOK key for the embedding call in store_episode.
    # If the key was deleted after classification, skip episodic memory
    # (verdict is already persisted in Postgres above).
    openai_key = None
    if run_repo:
        openai_key = await repo_settings.get_openai_key(run_repo)
    if openai_key:
        from app.request_context import openai_api_key_var

        openai_api_key_var.set(openai_key)
        point_id = await asyncio.to_thread(store_episode, result, req.verdict, req.run_id, run_repo)
        return {"status": "stored", "point_id": point_id}

    logger.warning("No OpenAI key for %s — verdict saved but episode not stored", run_repo)
    return {"status": "verdict_saved", "point_id": None}


@router.post("/update-baselines", response_model=UpdateBaselinesResponse)
async def update_baselines(req: UpdateBaselinesRequest, request: Request):
    """Update baseline screenshots for approved failures.

    For pre-merge runs: commits directly to the PR branch.
    For post-merge runs: creates a separate baseline PR.
    """
    check_repo_access(request, req.repo)
    run = await store.get_run(req.run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    if run.repo != req.repo:
        raise HTTPException(status_code=404, detail="Run not found")

    github_token = request.headers.get("X-GitHub-Token")
    try:
        return await baselines_service.update_baselines(req, run, github_token)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        logger.error("Baseline update failed (RuntimeError): %s", e)
        raise HTTPException(status_code=400, detail="Baseline update failed")
    except Exception as e:
        logger.error("GitHub API error in /update-baselines: %s", e)
        raise HTTPException(status_code=502, detail="Failed to update baselines via GitHub")


@router.post("/create-issues", response_model=CreateIssuesResponse)
async def create_issues(req: CreateIssuesRequest, request: Request):
    """Create GitHub issues for rejected visual regression failures."""
    check_repo_access(request, req.repo)
    run = await store.get_run(req.run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    if run.repo != req.repo:
        raise HTTPException(status_code=404, detail="Run not found")

    github_token = request.headers.get("X-GitHub-Token")
    try:
        return await issues_service.create_issues(req, run, github_token)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error("Failed to create issue: %s", e)
        raise HTTPException(status_code=502, detail="Failed to create GitHub issue")
