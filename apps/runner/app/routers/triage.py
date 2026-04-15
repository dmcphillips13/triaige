"""Triage endpoints — /ask and /triage-run."""

import asyncio
import logging

from fastapi import APIRouter, HTTPException, Request

from app import events, repo_settings, store
from app.agent.graph import run_graph
from app.grouping import extract_test_name
from app.routers._auth import check_repo_access, resolve_openai_key
from app.schemas import (
    AskRequest,
    AskResponse,
    TriageRunRequest,
    TriageRunResponse,
)
from app.services import triage as triage_service
from app.tools.playwright_parser import parse_report, parsed_result_to_ask_request

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/ask", response_model=AskResponse)
async def ask(req: AskRequest, request: Request):
    repo = req.pr_context.repo if req.pr_context else None
    auth_repo = getattr(request.state, "authenticated_repo", None)
    if auth_repo is not None and not repo:
        raise HTTPException(status_code=403, detail="Repo context required for per-repo keys")
    if repo:
        check_repo_access(request, repo)
    openai_key = await resolve_openai_key(request, repo)
    from app.request_context import openai_api_key_var
    openai_api_key_var.set(openai_key)
    return await asyncio.to_thread(run_graph, req)


@router.post("/triage-run", response_model=TriageRunResponse)
async def triage_run(req: TriageRunRequest, request: Request):
    """Accept a batch of test failures and triage each through the agent."""
    # Access check — per-repo keys must provide repo context
    repo = req.pr_context.repo if req.pr_context else None
    auth_repo = getattr(request.state, "authenticated_repo", None)
    if auth_repo is not None and not repo:
        raise HTTPException(status_code=403, detail="Repo context required for per-repo keys")
    if repo:
        check_repo_access(request, repo)

    # Check if this triage mode is enabled for the repo
    mode = req.triage_mode or "pre_merge"
    if repo:
        rs = await repo_settings.get_settings(repo)
        if mode == "pre_merge" and not rs.pre_merge:
            run_resp = await store.create_run([], pr_context=req.pr_context, triage_mode=mode)
            events.emit("run_created", {"run_id": run_resp.run_id, "repo": repo})
            return run_resp

    # Parse report or use provided failures
    if req.report_json:
        report = parse_report(req.report_json)
        ask_requests = [
            parsed_result_to_ask_request(f, pr_context=req.pr_context)
            for f in report.failures
        ]
    else:
        ask_requests = req.failures  # type: ignore[assignment]
        if req.pr_context:
            for r in ask_requests:
                if r.pr_context is None:
                    r.pr_context = req.pr_context

    # No failures at all — create passing check and return
    if not ask_requests:
        logger.info("No failures for %s (%s) — creating passing check", repo, mode)
        await triage_service.handle_no_failures_check(mode, req)
        return await triage_service.create_empty_response(repo, mode)

    # Filter out known and pending failures
    skipped_known: list[dict] = []
    skipped_pending: list[dict] = []

    if repo:
        ask_requests, skipped_known = await triage_service.filter_known_failures(
            repo, ask_requests,
        )

    pr_number_val = req.pr_context.pr_number if req.pr_context else None
    if repo and pr_number_val and mode == "pre_merge":
        ask_requests, skipped_pending = await triage_service.filter_pending_failures(
            repo, pr_number_val, ask_requests,
        )

    # Detect drift on known failures for PR comment annotation
    if skipped_known and repo and mode == "pre_merge" and req.pr_context:
        await triage_service.detect_drift(repo, skipped_known)

    # No net-new failures — post comment about skipped failures and return
    github_token = request.headers.get("X-GitHub-Token")
    if not ask_requests:
        logger.info("No net-new failures for %s (%s) — skipping run creation", repo, mode)
        await triage_service.handle_no_failures_check(mode, req)
        if mode == "pre_merge":
            await triage_service.post_skipped_comment(
                req, skipped_known, skipped_pending, github_token,
            )
        return await triage_service.create_empty_response(repo, mode)

    # Resolve BYOK OpenAI key before LLM processing
    try:
        openai_key = await resolve_openai_key(request, repo)
    except HTTPException:
        await triage_service.handle_setup_required_check(mode, req)
        return TriageRunResponse(
            run_id="",
            created_at="",
            total_failures=0,
            results=[],
            repo=repo,
            triage_mode=mode,
            status="setup_required",
        )

    from app.request_context import openai_api_key_var
    openai_api_key_var.set(openai_key)

    # Run the classification pipeline
    results = await triage_service.run_triage_pipeline(ask_requests)

    # Close superseded runs and create the new run
    pr_number = req.pr_context.pr_number if req.pr_context else None
    if repo and pr_number and mode == "pre_merge":
        await triage_service.close_superseded_runs(repo, pr_number)

    run_response = await store.create_run(results, pr_context=req.pr_context, triage_mode=mode)
    events.emit("run_created", {"run_id": run_response.run_id, "repo": repo})

    # Create merge gate check and post PR comment
    await triage_service.create_merge_gate_check(run_response, req, mode, github_token)
    await triage_service.post_triage_pr_comment(
        run_response, req, mode, skipped_known, skipped_pending, github_token,
    )

    return run_response
