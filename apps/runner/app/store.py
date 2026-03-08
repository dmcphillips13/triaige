"""In-memory triage run persistence.

Stores triage run results in a module-level dict so the dashboard can query
them via GET /runs. Data is lost on restart — acceptable for now.
Step 17 swaps this to Postgres; function signatures stay the same.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from app.schemas import PRContext, TriageFailureResult, TriageRunResponse, TriageRunSummary

_runs: dict[str, dict] = {}


def create_run(
    results: list[TriageFailureResult],
    pr_context: PRContext | None = None,
) -> TriageRunResponse:
    """Persist a new triage run and return the full response."""
    run_id = str(uuid.uuid4())
    created_at = datetime.now(timezone.utc).isoformat()

    classifications: dict[str, int] = {}
    for r in results:
        cls = r.ask_response.classification
        classifications[cls] = classifications.get(cls, 0) + 1

    pr_title = pr_context.title if pr_context else None
    pr_url = (
        f"https://github.com/{pr_context.repo}/pull/{pr_context.pr_number}"
        if pr_context and pr_context.repo and pr_context.pr_number
        else None
    )
    repo = pr_context.repo if pr_context else None

    response = TriageRunResponse(
        run_id=run_id,
        created_at=created_at,
        total_failures=len(results),
        results=results,
        pr_title=pr_title,
        pr_url=pr_url,
        repo=repo,
    )

    _runs[run_id] = {
        "response": response,
        "classifications": classifications,
    }

    return response


def get_run(run_id: str) -> TriageRunResponse | None:
    """Retrieve a single run by ID."""
    entry = _runs.get(run_id)
    return entry["response"] if entry else None


def get_result(run_id: str, test_name: str) -> TriageFailureResult | None:
    """Look up a single failure result within a run by test name."""
    run = get_run(run_id)
    if not run:
        return None
    for r in run.results:
        if r.test_name == test_name:
            return r
    return None


def list_runs() -> list[TriageRunSummary]:
    """List all runs, newest first."""
    summaries = []
    for run_id, entry in _runs.items():
        resp = entry["response"]
        summaries.append(TriageRunSummary(
            run_id=run_id,
            created_at=resp.created_at,
            total_failures=resp.total_failures,
            classifications=entry["classifications"],
            pr_title=resp.pr_title,
            pr_url=resp.pr_url,
            repo=resp.repo,
        ))
    summaries.sort(key=lambda s: s.created_at, reverse=True)
    return summaries
