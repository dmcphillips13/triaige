import asyncio

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app import store
from app.agent.graph import run_graph
from app.schemas import (
    AskRequest,
    AskResponse,
    TriageFailureResult,
    TriageRunRequest,
    TriageRunResponse,
    TriageRunSummary,
)
from app.settings import settings
from app.tools.playwright_parser import parse_report, parsed_result_to_ask_request

app = FastAPI(title="Triaige Runner")

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

    results: list[TriageFailureResult] = []
    for ask_req in ask_requests:
        response = await asyncio.to_thread(run_graph, ask_req)
        test_name = (
            ask_req.run_summary.test_name
            if ask_req.run_summary and ask_req.run_summary.test_name
            else ask_req.question[:80]
        )
        results.append(TriageFailureResult(test_name=test_name, ask_response=response))

    return store.create_run(results)


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
