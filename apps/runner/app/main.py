import asyncio

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app import store
from app.agent.graph import run_graph
from app.episodic import store_episode
from app.grouping import (
    build_group_request,
    extract_test_name,
    group_failures,
)
from app.schemas import (
    AskRequest,
    AskResponse,
    FeedbackRequest,
    TriageFailureResult,
    TriageRunRequest,
    TriageRunResponse,
    TriageRunSummary,
    UpdateBaselinesRequest,
    UpdateBaselinesResponse,
)
from app.tools.github_actions import create_baseline_pr
from app.settings import settings
from app.tools.playwright_parser import parse_report, parsed_result_to_ask_request

app = FastAPI(title="Triaige Runner")


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


@app.post("/ask", response_model=AskResponse)
async def ask(req: AskRequest):
    return await asyncio.to_thread(run_graph, req)


@app.post("/triage-run", response_model=TriageRunResponse)
async def triage_run(req: TriageRunRequest):
    """Accept a batch of test failures and triage each through the agent."""
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

    return store.create_run(results, pr_context=req.pr_context)


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
    return store.list_runs()


@app.get("/runs/{run_id}", response_model=TriageRunResponse)
async def get_run(run_id: str):
    """Get a single triage run by ID."""
    run = store.get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return run


@app.post("/feedback")
async def feedback(req: FeedbackRequest):
    """Store human verdict as an episode in Qdrant for future few-shot retrieval."""
    if req.verdict not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="Verdict must be 'approved' or 'rejected'")
    result = store.get_result(req.run_id, req.test_name)
    if not result:
        raise HTTPException(status_code=404, detail="Result not found")
    point_id = await asyncio.to_thread(store_episode, result, req.verdict, req.run_id)
    return {"status": "stored", "point_id": point_id}


@app.post("/update-baselines", response_model=UpdateBaselinesResponse)
async def update_baselines(req: UpdateBaselinesRequest):
    """Create a PR updating baseline screenshots for approved failures."""
    run = store.get_run(req.run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    # Collect approved failures that have both screenshot_actual and snapshot_path
    baselines: list[dict] = []
    for name in req.test_names:
        result = store.get_result(req.run_id, name)
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

    try:
        pr_url = await asyncio.to_thread(
            create_baseline_pr,
            repo=req.repo,
            run_id=req.run_id,
            baselines=baselines,
            source_pr_title=run.pr_title,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"GitHub API error: {e}")
    return UpdateBaselinesResponse(pr_url=pr_url)
