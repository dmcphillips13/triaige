"""FastAPI application for the Triaige runner.

Handles triage run ingestion, human feedback, baseline PR creation,
issue filing, and verdict/submission persistence. All run data is stored
in Postgres via the store module.
"""

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app import repo_settings, store
from app.agent.graph import run_graph
from app.db import close_db, init_db
from app.episodic import store_episode
from app.grouping import (
    build_group_request,
    extract_test_name,
    group_failures,
)
from app.schemas import (
    AskRequest,
    AskResponse,
    CreateIssuesRequest,
    CreateIssuesResponse,
    FeedbackRequest,
    TriageFailureResult,
    TriageRunRequest,
    TriageRunResponse,
    TriageRunSummary,
    UpdateBaselinesRequest,
    UpdateBaselinesResponse,
    VerdictRequest,
    SubmissionRequest,
)
from app.repo_settings import RepoSettings
from app.tools.github_actions import commit_baselines_to_branch, create_baseline_pr
from app.tools.github_checks import create_check_run, create_passing_check_run, update_check_run
from app.tools.github_issues import create_bug_issue, post_issue_comment
from app.tools.pr_comment import post_triage_comment
from app.settings import settings
from app.tools.playwright_parser import parse_report, parsed_result_to_ask_request

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield
    await close_db()


app = FastAPI(title="Triaige Runner", lifespan=lifespan)


class ApiKeyMiddleware(BaseHTTPMiddleware):
    OPEN_PATHS = {"/health", "/docs", "/openapi.json"}

    async def dispatch(self, request: Request, call_next):
        if not settings.api_key:
            return await call_next(request)
        if request.url.path in self.OPEN_PATHS:
            return await call_next(request)
        auth = request.headers.get("Authorization", "")
        if auth != f"Bearer {settings.api_key}":
            return JSONResponse(status_code=401, content={"detail": "Unauthorized"})
        return await call_next(request)


app.add_middleware(ApiKeyMiddleware)

origins = [o.strip() for o in settings.cors_origins.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/report-clean")
async def report_clean(request: Request):
    """Report that all visual tests passed — creates a passing check run.

    Also auto-closes pre-merge runs when a PR merges and all tests pass
    (no post-merge triage run is created in this case).
    """
    body = await request.json()
    repo = body.get("repo")
    head_sha = body.get("head_sha")
    pr_number = body.get("pr_number")
    event = body.get("event")
    if not repo or not head_sha:
        raise HTTPException(status_code=400, detail="repo and head_sha are required")

    # Auto-close pre-merge runs when a PR merges with all tests passing
    if event == "push" and pr_number:
        closed_ids = await store.auto_close_pre_merge_runs(repo, int(pr_number))
        if closed_ids:
            logger.info("Auto-closed %d pre-merge run(s) on clean merge of PR #%s", len(closed_ids), pr_number)

    rs = await repo_settings.get_settings(repo)
    if not rs.merge_gate:
        return {"status": "ok", "reason": "merge_gate disabled, runs closed"}

    try:
        check_run_id = await asyncio.to_thread(
            create_passing_check_run, repo=repo, head_sha=head_sha,
        )
        return {"status": "ok", "check_run_id": check_run_id}
    except Exception as e:
        logger.warning("Failed to create passing check run: %s", e)
        raise HTTPException(status_code=502, detail=f"GitHub API error: {e}")


@app.get("/repos/{repo:path}/settings", response_model=RepoSettings)
async def get_repo_settings(repo: str):
    """Get triage mode settings for a repo."""
    return await repo_settings.get_settings(repo)


@app.put("/repos/{repo:path}/settings", response_model=RepoSettings)
async def put_repo_settings(repo: str, req: RepoSettings):
    """Update triage mode settings for a repo."""
    return await repo_settings.put_settings(repo, req)


@app.post("/ask", response_model=AskResponse)
async def ask(req: AskRequest):
    return await asyncio.to_thread(run_graph, req)


@app.post("/triage-run", response_model=TriageRunResponse)
async def triage_run(req: TriageRunRequest, request: Request):
    """Accept a batch of test failures and triage each through the agent."""
    # Check if this triage mode is enabled for the repo
    repo = req.pr_context.repo if req.pr_context else None
    mode = req.triage_mode or "pre_merge"
    if repo:
        rs = await repo_settings.get_settings(repo)
        if mode == "pre_merge" and not rs.pre_merge:
            return await store.create_run([], pr_context=req.pr_context, triage_mode=mode)

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

    # --- Net-new filtering: only triage failures not present in known failures ---
    skipped_known: list[dict] = []  # Known failures skipped by filtering
    if repo:
        existing = await store.get_existing_failure_test_names(repo)
        if existing:
            skipped_requests = [
                r for r in ask_requests
                if extract_test_name(r) in existing
            ]
            ask_requests = [
                r for r in ask_requests
                if extract_test_name(r) not in existing
            ]
            # Collect skipped failure info for PR comment + screenshot comparison
            for r in skipped_requests:
                test_name = extract_test_name(r)
                screenshot = r.run_summary.screenshot_actual if r.run_summary else None
                skipped_known.append({"test_name": test_name, "screenshot": screenshot})

    # --- Screenshot comparison for skipped known failures ---
    # If a PR modifies an area that's already broken, notify the issue
    if skipped_known and repo and mode == "pre_merge" and req.pr_context:
        github_token = request.headers.get("X-GitHub-Token")
        for skipped in skipped_known:
            try:
                stored = await store.get_known_failure_screenshot(
                    repo, skipped["test_name"]
                )
                if stored and skipped["screenshot"] and stored != skipped["screenshot"]:
                    # Screenshots differ — this PR further modifies the broken area
                    kf_rows = await store.list_known_failures(repo)
                    matching = [
                        kf for kf in kf_rows
                        if kf["test_name"] == skipped["test_name"]
                    ]
                    for kf in matching:
                        pr_number = req.pr_context.pr_number
                        pr_url = f"https://github.com/{repo}/pull/{pr_number}" if pr_number else ""
                        comment = (
                            f"**Note:** PR #{pr_number} ([view]({pr_url})) "
                            f"further modifies this area. The visual appearance has changed "
                            f"since this issue was filed. Please verify manually."
                        )
                        # Use App installation token for reliability
                        from app.tools.github_checks import _get_client
                        def _post_comment():
                            client = _get_client(repo)
                            client.post(
                                f"/repos/{repo}/issues/{kf['issue_number']}/comments",
                                json={"body": comment},
                            )
                        await asyncio.to_thread(_post_comment)
                        logger.info(
                            "Posted modification notice on issue #%d for %s",
                            kf["issue_number"], skipped["test_name"],
                        )
            except Exception as e:
                logger.warning(
                    "Failed screenshot comparison for %s: %s",
                    skipped["test_name"], e,
                )

    # If no net-new failures, skip run creation but still create a passing check
    if not ask_requests:
        logger.info("No net-new failures for %s (%s) — skipping run creation", repo, mode)

        if (
            mode == "pre_merge"
            and req.pr_context
            and req.pr_context.head_sha
            and req.pr_context.repo
        ):
            rs = await repo_settings.get_settings(req.pr_context.repo)
            if rs.merge_gate:
                try:
                    await asyncio.to_thread(
                        create_passing_check_run,
                        repo=req.pr_context.repo,
                        head_sha=req.pr_context.head_sha,
                    )
                    logger.info("Created passing check — all failures are known")
                except Exception as e:
                    logger.warning("Failed to create passing check run: %s", e)

        # Post PR comment noting skipped known failures
        if (
            skipped_known
            and mode == "pre_merge"
            and req.pr_context
            and req.pr_context.pr_number
            and req.pr_context.repo
        ):
            github_token = request.headers.get("X-GitHub-Token")
            try:
                post_triage_comment(
                    repo=req.pr_context.repo,
                    pr_number=req.pr_context.pr_number,
                    run=None,
                    github_token=github_token,
                    known_failures={},
                    skipped_known=skipped_known,
                )
            except Exception as e:
                logger.warning("Failed to post known failures PR comment: %s", e)

        return TriageRunResponse(
            run_id="",
            created_at="",
            total_failures=0,
            results=[],
            repo=repo,
            triage_mode=mode,
        )

    # Group related failures to reduce LLM calls
    groups = group_failures(ask_requests)

    results: list[TriageFailureResult] = []
    for grp in groups:
        group_names = grp.test_names if len(grp.test_names) > 1 else None

        if len(grp.requests) <= 2:
            # Small groups: process individually
            for ask_req in grp.requests:
                response = await asyncio.to_thread(run_graph, ask_req)
                results.append(_build_result(ask_req, response, group_names))
        else:
            # Larger groups: one LLM call for the whole group
            group_request = build_group_request(grp)
            response = await asyncio.to_thread(run_graph, group_request)
            for ask_req in grp.requests:
                results.append(_build_result(ask_req, response, group_names))

    # --- Auto-close superseded pre-merge runs for the same PR ---
    pr_number = req.pr_context.pr_number if req.pr_context else None
    if repo and pr_number and mode == "pre_merge":
        closed_ids = await store.auto_close_pre_merge_runs(repo, pr_number)
        if closed_ids:
            logger.info("Auto-closed %d superseded pre-merge run(s) for PR #%d", len(closed_ids), pr_number)

    run_response = await store.create_run(results, pr_context=req.pr_context, triage_mode=mode)

    # Create merge gate check run for pre-merge runs
    if (
        mode == "pre_merge"
        and run_response.results
        and req.pr_context
        and req.pr_context.head_sha
        and req.pr_context.repo
    ):
        rs = await repo_settings.get_settings(req.pr_context.repo)
        if rs.merge_gate:
            github_token = request.headers.get("X-GitHub-Token")
            try:
                # Check if all failures already have submissions from previous runs
                gate_already_passed = await store.check_pre_merge_gate(run_response.run_id)

                if gate_already_passed:
                    # All failures already addressed — create a passing check
                    check_run_id = await asyncio.to_thread(
                        create_passing_check_run,
                        repo=req.pr_context.repo,
                        head_sha=req.pr_context.head_sha,
                    )
                    logger.info("Merge gate already satisfied for run %s", run_response.run_id)
                else:
                    check_run_id = await asyncio.to_thread(
                        create_check_run,
                        repo=req.pr_context.repo,
                        head_sha=req.pr_context.head_sha,
                        total_failures=len(run_response.results),
                        github_token=github_token,
                    )
                await store.set_check_run_id(run_response.run_id, check_run_id)
            except Exception as e:
                logger.warning("Failed to create check run: %s", e)

    # Post PR comment for pre-merge runs
    if (
        mode == "pre_merge"
        and run_response.results
        and req.pr_context
        and req.pr_context.pr_number
        and req.pr_context.repo
    ):
        github_token = request.headers.get("X-GitHub-Token")
        known = await store.get_known_failures(run_response.run_id)
        try:
            post_triage_comment(
                repo=req.pr_context.repo,
                pr_number=req.pr_context.pr_number,
                run=run_response,
                github_token=github_token,
                known_failures=known,
                skipped_known=skipped_known,
            )
        except Exception as e:
            logger.warning("Failed to post PR comment: %s", e)

    return run_response


def _build_result(
    ask_req: AskRequest,
    response: AskResponse,
    group_names: list[str] | None,
) -> TriageFailureResult:
    rs = ask_req.run_summary
    return TriageFailureResult(
        test_name=extract_test_name(ask_req),
        ask_response=response,
        group=group_names,
        screenshot_baseline=rs.screenshot_baseline if rs else None,
        screenshot_actual=rs.screenshot_actual if rs else None,
        snapshot_path=rs.snapshot_path if rs else None,
    )


@app.get("/runs", response_model=list[TriageRunSummary])
async def list_runs():
    """List all triage runs."""
    return await store.list_runs()


@app.get("/runs/{run_id}", response_model=TriageRunResponse)
async def get_run(run_id: str):
    """Get a single triage run by ID."""
    run = await store.get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return run


@app.patch("/runs/{run_id}/close")
async def close_run(run_id: str):
    """Mark a triage run as closed."""
    if not await store.close_run(run_id, force=True):
        raise HTTPException(status_code=404, detail="Run not found")
    return {"status": "closed"}


# --- Verdicts ---


@app.put("/runs/{run_id}/failures/{test_name}/verdict")
async def put_verdict(run_id: str, test_name: str, req: VerdictRequest):
    """Store a human verdict for a failure."""
    if req.verdict not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="Verdict must be 'approved' or 'rejected'")
    await store.set_verdict(run_id, test_name, req.verdict)
    return {"status": "stored"}


@app.get("/runs/{run_id}/verdicts")
async def get_verdicts(run_id: str):
    """Fetch all verdicts for a run."""
    return await store.get_verdicts(run_id)


# --- Submissions ---


@app.put("/runs/{run_id}/failures/{test_name}/submission")
async def put_submission(run_id: str, test_name: str, req: SubmissionRequest, request: Request):
    """Store a submission result (PR or issue URL) for a failure."""
    await store.set_submission(run_id, test_name, req.url, req.type)

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
                    logger.info("Merge gate passed for run %s", run_id)
                except Exception as e:
                    logger.warning("Failed to update check run: %s", e)

    return {"status": "stored"}


@app.get("/runs/{run_id}/submissions")
async def get_submissions(run_id: str):
    """Fetch all submissions for a run."""
    return await store.get_submissions(run_id)


# --- Known failures ---


@app.get("/runs/{run_id}/known-failures")
async def get_known_failures(run_id: str):
    """Find known failures for a run's test names.

    Returns per-test context: which PR introduced the failure and any
    existing open submissions (PRs or issues).
    """
    return await store.get_known_failures(run_id)


# --- Feedback (episodic memory) ---


@app.post("/feedback")
async def feedback(req: FeedbackRequest):
    """Store human verdict as an episode in Qdrant for future few-shot retrieval."""
    if req.verdict not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="Verdict must be 'approved' or 'rejected'")
    result = await store.get_result(req.run_id, req.test_name)
    if not result:
        raise HTTPException(status_code=404, detail="Result not found")

    # Also persist the verdict in Postgres
    await store.set_verdict(req.run_id, req.test_name, req.verdict)

    point_id = await asyncio.to_thread(store_episode, result, req.verdict, req.run_id)
    return {"status": "stored", "point_id": point_id}


# --- GitHub actions ---


@app.post("/update-baselines", response_model=UpdateBaselinesResponse)
async def update_baselines(req: UpdateBaselinesRequest, request: Request):
    """Update baseline screenshots for approved failures.

    For pre-merge runs: commits directly to the PR branch.
    For post-merge runs: creates a separate baseline PR.
    """
    run = await store.get_run(req.run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    # Collect approved failures that have both screenshot_actual and snapshot_path
    baselines: list[dict] = []
    for name in req.test_names:
        result = await store.get_result(req.run_id, name)
        if not result:
            raise HTTPException(status_code=404, detail=f"Result not found: {name}")
        if not result.screenshot_actual:
            raise HTTPException(status_code=400, detail=f"No actual screenshot for: {name}")
        if not result.snapshot_path:
            raise HTTPException(status_code=400, detail=f"No snapshot path for: {name}")
        baselines.append({
            "path": result.snapshot_path,
            "content_base64": result.screenshot_actual,
            "test_name": result.test_name,
        })

    if not baselines:
        raise HTTPException(status_code=400, detail="No baselines to update")

    github_token = request.headers.get("X-GitHub-Token")

    try:
        if run.triage_mode == "pre_merge":
            # Pre-merge: commit directly to the PR branch
            pr_number = await store.get_run_pr_number(req.run_id)
            if not pr_number:
                raise HTTPException(status_code=400, detail="No PR number for pre-merge run")
            commit_sha = await asyncio.to_thread(
                commit_baselines_to_branch,
                repo=req.repo,
                pr_number=pr_number,
                baselines=baselines,
                github_token=github_token,
            )
            # Return the commit URL as the "pr_url" for consistency
            pr_url = f"https://github.com/{req.repo}/pull/{pr_number}/commits/{commit_sha}"
        else:
            # Post-merge: create a separate baseline PR
            pr_url = await asyncio.to_thread(
                create_baseline_pr,
                repo=req.repo,
                run_id=req.run_id,
                baselines=baselines,
                source_pr_title=run.pr_title,
                github_token=github_token,
            )
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"GitHub API error: {e}")
    return UpdateBaselinesResponse(pr_url=pr_url)


@app.post("/create-issues", response_model=CreateIssuesResponse)
async def create_issues(req: CreateIssuesRequest, request: Request):
    """Create GitHub issues for rejected visual regression failures."""
    run = await store.get_run(req.run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    github_token = request.headers.get("X-GitHub-Token")
    issues: list[dict] = []

    for name in req.test_names:
        result = await store.get_result(req.run_id, name)
        if not result:
            raise HTTPException(status_code=404, detail=f"Result not found: {name}")
        try:
            issue_url = await asyncio.to_thread(
                create_bug_issue,
                repo=req.repo,
                run_id=req.run_id,
                test_name=result.test_name,
                classification=result.ask_response.classification,
                confidence=result.ask_response.confidence,
                rationale=result.ask_response.rationale,
                github_token=github_token,
            )
            issues.append({"test_name": name, "issue_url": issue_url})

            # Record as known failure for Main tab health dashboard
            try:
                issue_number = int(issue_url.rstrip("/").split("/")[-1])
                screenshot = result.screenshot_actual
                await store.add_known_failure(
                    repo=req.repo,
                    test_name=name,
                    issue_url=issue_url,
                    issue_number=issue_number,
                    screenshot_base64=screenshot,
                    filed_from_run_id=req.run_id,
                )
            except Exception as e:
                logger.warning("Failed to record known failure for %s: %s", name, e)

        except Exception as e:
            logger.warning("Failed to create issue for %s: %s", name, e)
            raise HTTPException(status_code=502, detail=f"GitHub API error for {name}: {e}")

    return CreateIssuesResponse(issues=issues)


# --- Known failures (Main tab health dashboard) ---


@app.get("/repos/{repo:path}/known-failures")
async def list_repo_known_failures(repo: str):
    """List open known failures for a repo's Main tab health dashboard."""
    return await store.list_known_failures(repo)


@app.get("/repos/{repo:path}/known-failures/closed")
async def list_repo_closed_known_failures(repo: str):
    """List closed known failures for a repo."""
    return await store.get_closed_known_failures(repo)


@app.patch("/repos/{repo:path}/known-failures/{failure_id}/close")
async def close_repo_known_failure(repo: str, failure_id: int, request: Request):
    """Close a known failure and its GitHub issue."""
    row = await store.close_known_failure(failure_id)
    if not row:
        raise HTTPException(status_code=404, detail="Known failure not found or already closed")

    # Close the GitHub issue too — use App installation token for reliability
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
            issue_error = str(e)
            logger.warning("Failed to close GitHub issue #%s: %s", row["issue_number"], e)

    return {"status": "closed", "id": failure_id, "issue_error": issue_error}
