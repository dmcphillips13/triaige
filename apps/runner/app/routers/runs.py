"""Run listing, detail, close, verdicts, submissions, and known failures."""

import asyncio
import logging

from fastapi import APIRouter, HTTPException, Request

from app import events, store
from app.routers._auth import check_run_access
from app.schemas import SubmissionRequest, TriageRunResponse, TriageRunSummary, VerdictRequest
from app.tools.github_checks import update_check_run

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/runs")


@router.get("", response_model=list[TriageRunSummary])
async def list_runs(request: Request):
    """List triage runs. Per-repo keys only see their repo's runs."""
    auth_repo = getattr(request.state, "authenticated_repo", None)
    return await store.list_runs(repo_filter=auth_repo)


@router.get("/{run_id}", response_model=TriageRunResponse)
async def get_run(run_id: str, request: Request):
    """Get a single triage run by ID."""
    await check_run_access(request, run_id)
    run = await store.get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return run


@router.patch("/{run_id}/close")
async def close_run(run_id: str, request: Request):
    """Mark a triage run as closed."""
    await check_run_access(request, run_id)
    if not await store.close_run(run_id, force=True):
        raise HTTPException(status_code=404, detail="Run not found")
    events.emit("run_closed", {"run_id": run_id})
    return {"status": "closed"}


# --- Verdicts ---


@router.put("/{run_id}/verdict")
async def put_verdict(run_id: str, req: VerdictRequest, request: Request):
    """Store a human verdict for a failure."""
    await check_run_access(request, run_id)
    if req.verdict not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="Verdict must be 'approved' or 'rejected'")
    await store.set_verdict(run_id, req.test_name, req.verdict)
    return {"status": "stored"}


@router.get("/{run_id}/verdicts")
async def get_verdicts(run_id: str, request: Request):
    """Fetch all verdicts for a run."""
    await check_run_access(request, run_id)
    return await store.get_verdicts(run_id)


# --- Submissions ---


@router.put("/{run_id}/submission")
async def put_submission(run_id: str, req: SubmissionRequest, request: Request):
    """Store a submission result (PR or issue URL) for a failure."""
    await check_run_access(request, run_id)
    await store.set_submission(run_id, req.test_name, req.url, req.type)

    # Check if all pre-merge failures are now addressed → update merge gate
    if await store.check_pre_merge_gate(run_id):
        check_run_id = await store.get_check_run_id(run_id)
        if check_run_id:
            run = await store.get_run(run_id)
            repo = run.repo if run else None
            if repo:
                github_token = request.headers.get("X-GitHub-Token")
                try:
                    await asyncio.to_thread(
                        update_check_run,
                        repo=repo,
                        check_run_id=check_run_id,
                        conclusion="success",
                        summary="All visual failures have been addressed",
                        github_token=github_token,
                    )
                except Exception as e:
                    logger.warning("Failed to update check run: %s", e)

        logger.info("Merge gate passed for run %s", run_id)
        await store.close_run(run_id)
        events.emit("run_closed", {"run_id": run_id})
        logger.info("Auto-closed run %s after merge gate passed", run_id)

    return {"status": "stored"}


@router.get("/{run_id}/submissions")
async def get_submissions(run_id: str, request: Request):
    """Fetch all submissions for a run."""
    await check_run_access(request, run_id)
    return await store.get_submissions(run_id)


# --- Known failures ---


@router.get("/{run_id}/known-failures")
async def get_known_failures(run_id: str, request: Request):
    """Find known failures for a run's test names.

    Returns per-test context: which PR introduced the failure and any
    existing open submissions (PRs or issues).
    """
    await check_run_access(request, run_id)
    return await store.get_known_failures(run_id)
