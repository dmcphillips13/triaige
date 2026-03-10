"""Postgres-backed triage run persistence.

Stores triage runs, failure results, verdicts, and submissions in Postgres
so data survives server restarts. All functions are async and use the
shared asyncpg pool from db.py.
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

from app.db import get_pool
from app.schemas import (
    AskResponse,
    PRContext,
    TriageFailureResult,
    TriageRunResponse,
    TriageRunSummary,
)


async def create_run(
    results: list[TriageFailureResult],
    pr_context: PRContext | None = None,
    triage_mode: str | None = None,
) -> TriageRunResponse:
    """Persist a new triage run and return the full response."""
    pool = get_pool()
    run_id = str(uuid.uuid4())
    created_at = datetime.now(timezone.utc)

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

    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute(
                """INSERT INTO runs (run_id, created_at, total_failures, pr_title, pr_url, repo, triage_mode, classifications)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8)""",
                run_id, created_at, len(results), pr_title, pr_url, repo, triage_mode,
                json.dumps(classifications),
            )
            for r in results:
                await conn.execute(
                    """INSERT INTO failure_results (run_id, test_name, snapshot_path, group_names, screenshot_baseline, screenshot_actual, response)
                       VALUES ($1, $2, $3, $4, $5, $6, $7)""",
                    run_id, r.test_name, r.snapshot_path,
                    json.dumps(r.group) if r.group else None,
                    r.screenshot_baseline, r.screenshot_actual,
                    r.ask_response.model_dump_json(),
                )

    return TriageRunResponse(
        run_id=run_id,
        created_at=created_at.isoformat(),
        total_failures=len(results),
        results=results,
        pr_title=pr_title,
        pr_url=pr_url,
        repo=repo,
        triage_mode=triage_mode,
    )


async def get_run(run_id: str) -> TriageRunResponse | None:
    """Retrieve a single run by ID, including all failure results."""
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM runs WHERE run_id = $1", run_id)
        if not row:
            return None

        failure_rows = await conn.fetch(
            "SELECT * FROM failure_results WHERE run_id = $1", run_id
        )

    results = [
        TriageFailureResult(
            test_name=fr["test_name"],
            ask_response=AskResponse(**json.loads(fr["response"])),
            group=json.loads(fr["group_names"]) if fr["group_names"] else None,
            screenshot_baseline=fr["screenshot_baseline"],
            screenshot_actual=fr["screenshot_actual"],
            snapshot_path=fr["snapshot_path"],
        )
        for fr in failure_rows
    ]

    return TriageRunResponse(
        run_id=row["run_id"],
        created_at=row["created_at"].isoformat(),
        total_failures=row["total_failures"],
        results=results,
        pr_title=row["pr_title"],
        pr_url=row["pr_url"],
        repo=row["repo"],
        triage_mode=row["triage_mode"],
        closed=row["closed"],
    )


async def get_result(run_id: str, test_name: str) -> TriageFailureResult | None:
    """Look up a single failure result within a run by test name."""
    pool = get_pool()
    async with pool.acquire() as conn:
        fr = await conn.fetchrow(
            "SELECT * FROM failure_results WHERE run_id = $1 AND test_name = $2",
            run_id, test_name,
        )
    if not fr:
        return None
    return TriageFailureResult(
        test_name=fr["test_name"],
        ask_response=AskResponse(**json.loads(fr["response"])),
        group=json.loads(fr["group_names"]) if fr["group_names"] else None,
        screenshot_baseline=fr["screenshot_baseline"],
        screenshot_actual=fr["screenshot_actual"],
        snapshot_path=fr["snapshot_path"],
    )


async def close_run(run_id: str) -> bool:
    """Mark a run as closed. Returns True if found."""
    pool = get_pool()
    async with pool.acquire() as conn:
        result = await conn.execute(
            "UPDATE runs SET closed = TRUE WHERE run_id = $1", run_id
        )
    return result == "UPDATE 1"


async def list_runs() -> list[TriageRunSummary]:
    """List all runs, newest first."""
    pool = get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM runs ORDER BY created_at DESC"
        )
    return [
        TriageRunSummary(
            run_id=row["run_id"],
            created_at=row["created_at"].isoformat(),
            total_failures=row["total_failures"],
            classifications=json.loads(row["classifications"]),
            pr_title=row["pr_title"],
            pr_url=row["pr_url"],
            repo=row["repo"],
            triage_mode=row["triage_mode"],
            closed=row["closed"],
        )
        for row in rows
    ]


# --- Verdict persistence ---


async def set_verdict(run_id: str, test_name: str, verdict: str) -> None:
    """Store or update a human verdict for a failure."""
    pool = get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """INSERT INTO verdicts (run_id, test_name, verdict)
               VALUES ($1, $2, $3)
               ON CONFLICT (run_id, test_name)
               DO UPDATE SET verdict = $3, created_at = NOW()""",
            run_id, test_name, verdict,
        )


async def get_verdicts(run_id: str) -> dict[str, str]:
    """Fetch all verdicts for a run. Returns {test_name: verdict}."""
    pool = get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT test_name, verdict FROM verdicts WHERE run_id = $1", run_id
        )
    return {row["test_name"]: row["verdict"] for row in rows}


# --- Submission persistence ---


async def set_submission(
    run_id: str, test_name: str, url: str, sub_type: str
) -> None:
    """Store a submission result (PR or issue URL) for a failure."""
    pool = get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """INSERT INTO submissions (run_id, test_name, url, type)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT (run_id, test_name)
               DO UPDATE SET url = $3, type = $4, created_at = NOW()""",
            run_id, test_name, url, sub_type,
        )


async def get_submissions(run_id: str) -> dict[str, dict]:
    """Fetch all submissions for a run. Returns {test_name: {url, type}}."""
    pool = get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT test_name, url, type FROM submissions WHERE run_id = $1", run_id
        )
    return {row["test_name"]: {"url": row["url"], "type": row["type"]} for row in rows}


# --- Known failure detection ---


async def get_known_failures(run_id: str) -> dict[str, dict]:
    """Find known failures for a run's test names.

    For each failing test in the given run, looks up:
    1. The earliest main-branch run where that test also failed (before this run)
    2. The most recent submission (PR or issue) for that test name across all runs

    Returns {test_name: {failing_since: {...} | null, open_submission: {...} | null}}.
    """
    pool = get_pool()
    async with pool.acquire() as conn:
        # Get the run's metadata and test names
        run_row = await conn.fetchrow(
            "SELECT repo, created_at FROM runs WHERE run_id = $1", run_id
        )
        if not run_row:
            return {}

        test_names = [
            row["test_name"]
            for row in await conn.fetch(
                "SELECT test_name FROM failure_results WHERE run_id = $1", run_id
            )
        ]
        if not test_names:
            return {}

        repo = run_row["repo"]
        created_at = run_row["created_at"]

        # 1. Find the earliest main-branch run where each test failed
        failing_since_rows = await conn.fetch(
            """SELECT DISTINCT ON (fr.test_name)
                   fr.test_name,
                   r.run_id,
                   r.pr_title,
                   r.pr_url,
                   r.created_at
               FROM failure_results fr
               JOIN runs r ON r.run_id = fr.run_id
               WHERE fr.test_name = ANY($1)
                 AND r.repo = $2
                 AND r.triage_mode = 'post_merge'
                 AND r.created_at < $3
               ORDER BY fr.test_name, r.created_at ASC""",
            test_names, repo, created_at,
        )
        failing_since = {
            row["test_name"]: {
                "run_id": row["run_id"],
                "pr_title": row["pr_title"],
                "pr_url": row["pr_url"],
                "created_at": row["created_at"].isoformat(),
            }
            for row in failing_since_rows
        }

        # 2. Find the most recent submission for each test name (across all runs)
        submission_rows = await conn.fetch(
            """SELECT DISTINCT ON (test_name)
                   test_name, url, type
               FROM submissions
               WHERE test_name = ANY($1)
               ORDER BY test_name, created_at DESC""",
            test_names,
        )
        open_submissions = {
            row["test_name"]: {"url": row["url"], "type": row["type"]}
            for row in submission_rows
        }

    # Build combined result
    result: dict[str, dict] = {}
    for name in test_names:
        entry: dict[str, dict | None] = {
            "failing_since": failing_since.get(name),
            "open_submission": open_submissions.get(name),
        }
        result[name] = entry

    return result
