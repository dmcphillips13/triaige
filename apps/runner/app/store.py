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
    pr_number = pr_context.pr_number if pr_context else None
    pr_url = (
        f"https://github.com/{pr_context.repo}/pull/{pr_context.pr_number}"
        if pr_context and pr_context.repo and pr_context.pr_number
        else None
    )
    repo = pr_context.repo if pr_context else None

    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute(
                """INSERT INTO runs (run_id, created_at, total_failures, pr_title, pr_url, pr_number, repo, triage_mode, classifications)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)""",
                run_id, created_at, len(results), pr_title, pr_url, pr_number, repo, triage_mode,
                json.dumps(classifications),
            )
            for r in results:
                await conn.execute(
                    """INSERT INTO failure_results (run_id, test_name, snapshot_path, group_names, screenshot_baseline, screenshot_actual, response, failure_type)
                       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)""",
                    run_id, r.test_name, r.snapshot_path,
                    json.dumps(r.group) if r.group else None,
                    r.screenshot_baseline, r.screenshot_actual,
                    r.ask_response.model_dump_json(),
                    r.failure_type,
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
            failure_type=fr.get("failure_type"),
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
        failure_type=fr.get("failure_type"),
    )


async def set_check_run_id(run_id: str, check_run_id: int) -> None:
    """Store the GitHub check run ID on a triage run."""
    pool = get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE runs SET check_run_id = $2 WHERE run_id = $1",
            run_id, check_run_id,
        )


async def get_check_run_id(run_id: str) -> int | None:
    """Get the GitHub check run ID for a triage run."""
    pool = get_pool()
    async with pool.acquire() as conn:
        return await conn.fetchval(
            "SELECT check_run_id FROM runs WHERE run_id = $1", run_id
        )


async def get_run_pr_number(run_id: str) -> int | None:
    """Get the PR number for a run."""
    pool = get_pool()
    async with pool.acquire() as conn:
        return await conn.fetchval(
            "SELECT pr_number FROM runs WHERE run_id = $1", run_id
        )


async def get_run_repo(run_id: str) -> str | None:
    """Get the repo for a run."""
    pool = get_pool()
    async with pool.acquire() as conn:
        return await conn.fetchval(
            "SELECT repo FROM runs WHERE run_id = $1", run_id
        )


async def close_run(run_id: str, force: bool = False) -> bool:
    """Mark a run as closed. Returns True if found."""
    pool = get_pool()
    async with pool.acquire() as conn:
        result = await conn.execute(
            "UPDATE runs SET closed = TRUE WHERE run_id = $1", run_id
        )
    return result == "UPDATE 1"


async def get_gate_statuses(run_ids: list[str]) -> dict[str, str]:
    """Batch-compute gate status for a set of runs.

    Returns {run_id: "action_required" | "ready_to_merge"} for runs where
    all failures have submissions.
    """
    if not run_ids:
        return {}
    pool = get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT
                   fr.run_id,
                   COUNT(DISTINCT fr.test_name) AS total,
                   COUNT(DISTINCT s.test_name) AS covered
               FROM failure_results fr
               LEFT JOIN submissions s
                   ON s.test_name = fr.test_name
                   AND s.run_id IN (
                       SELECT r2.run_id FROM runs r2
                       WHERE r2.repo = (SELECT repo FROM runs WHERE run_id = fr.run_id)
                         AND r2.pr_number = (SELECT pr_number FROM runs WHERE run_id = fr.run_id)
                   )
               WHERE fr.run_id = ANY($1)
               GROUP BY fr.run_id""",
            run_ids,
        )
    result: dict[str, str] = {}
    for row in rows:
        if row["total"] > 0:
            if row["covered"] >= row["total"]:
                result[row["run_id"]] = "ready_to_merge"
            else:
                result[row["run_id"]] = "action_required"
    return result


async def list_runs(repo_filter: str | None = None) -> list[TriageRunSummary]:
    """List runs, newest first. If repo_filter is set, only that repo's runs."""
    pool = get_pool()
    async with pool.acquire() as conn:
        if repo_filter:
            rows = await conn.fetch(
                "SELECT * FROM runs WHERE repo = $1 ORDER BY created_at DESC",
                repo_filter,
            )
        else:
            rows = await conn.fetch(
                "SELECT * FROM runs ORDER BY created_at DESC"
            )

    # Compute gate statuses for open pre-merge runs
    open_pre_merge_ids = [
        row["run_id"] for row in rows
        if row["triage_mode"] == "pre_merge" and not row["closed"]
    ]
    gate_statuses = await get_gate_statuses(open_pre_merge_ids)

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
            gate_status=gate_statuses.get(row["run_id"]),
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
    """Store a submission result (PR or issue URL) for a failure.

    After storing, checks if all failures in the run now have submissions
    (from this or any prior run). If so, auto-closes the run.
    """
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


async def get_existing_failure_test_names(repo: str) -> set[str]:
    """Get test names with open known failures for a repo.

    Used to filter incoming failures down to net-new only.
    """
    pool = get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT DISTINCT test_name
               FROM known_failures
               WHERE repo = $1
                 AND closed_at IS NULL""",
            repo,
        )
    return {row["test_name"] for row in rows}


async def get_existing_failures_with_issues(repo: str) -> dict[str, str]:
    """Get test names with their issue URLs for open known failures.

    Returns {test_name: issue_url} for the most recent known failure per test.
    """
    pool = get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT DISTINCT ON (test_name) test_name, issue_url
               FROM known_failures
               WHERE repo = $1
                 AND closed_at IS NULL
               ORDER BY test_name, created_at DESC""",
            repo,
        )
    return {row["test_name"]: row["issue_url"] for row in rows}



async def auto_close_pre_merge_runs(repo: str, pr_number: int) -> list[str]:
    """Close all open pre-merge runs for a repo/PR combo.

    Called when a newer pre-merge run supersedes older ones, or when a PR
    merges and a post-merge run is created. Returns list of closed run IDs.
    """
    pool = get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """UPDATE runs
               SET closed = TRUE
               WHERE repo = $1
                 AND pr_number = $2
                 AND triage_mode = 'pre_merge'
                 AND closed = FALSE
               RETURNING run_id""",
            repo, pr_number,
        )
    return [row["run_id"] for row in rows]


async def check_close_eligibility(run_id: str) -> bool:
    """Check if a post-merge run should be auto-closed.

    Returns True if the run is an open post-merge run and every failure has
    a submission (baseline PR or issue) from this or any prior run.
    """
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT triage_mode, closed FROM runs WHERE run_id = $1", run_id
        )
        if not row or row["closed"] or row["triage_mode"] != "post_merge":
            return False

        test_names = [
            r["test_name"]
            for r in await conn.fetch(
                "SELECT test_name FROM failure_results WHERE run_id = $1", run_id
            )
        ]
        if not test_names:
            return False

        covered = await conn.fetchval(
            """SELECT COUNT(DISTINCT fr.test_name)
               FROM failure_results fr
               WHERE fr.run_id = $1
                 AND EXISTS (
                     SELECT 1 FROM submissions s
                     JOIN runs r ON r.run_id = s.run_id
                     WHERE s.test_name = fr.test_name
                       AND r.closed = FALSE
                 )""",
            run_id,
        )
    return covered >= len(test_names)


async def check_pre_merge_gate(run_id: str) -> bool:
    """Check if all net-new failures in a pre-merge run have submissions.

    Returns True if every failure has a submission (baseline committed or
    issue filed) — from this run OR any previous run for the same PR.
    """
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT triage_mode, closed, repo, pr_number FROM runs WHERE run_id = $1", run_id
        )
        if not row or row["closed"] or row["triage_mode"] != "pre_merge":
            return False

        test_names = [
            r["test_name"]
            for r in await conn.fetch(
                "SELECT test_name FROM failure_results WHERE run_id = $1", run_id
            )
        ]
        if not test_names:
            return False

        # Count failures that have a submission from any run for the same PR
        covered = await conn.fetchval(
            """SELECT COUNT(DISTINCT s.test_name)
               FROM submissions s
               JOIN runs r ON r.run_id = s.run_id
               WHERE s.test_name = ANY($1)
                 AND r.repo = $2
                 AND r.pr_number = $3""",
            test_names, row["repo"], row["pr_number"],
        )
    return covered >= len(test_names)


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
                 AND r.closed = FALSE
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

        # 2. Find the most recent submission from an open run for each test name
        submission_rows = await conn.fetch(
            """SELECT DISTINCT ON (s.test_name)
                   s.test_name, s.url, s.type
               FROM submissions s
               JOIN runs r ON r.run_id = s.run_id
               WHERE s.test_name = ANY($1)
                 AND r.closed = FALSE
               ORDER BY s.test_name, s.created_at DESC""",
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


# --- Known failures ---


async def add_known_failure(
    repo: str,
    test_name: str,
    issue_url: str,
    issue_number: int,
    screenshot_base64: str | None = None,
    filed_from_run_id: str | None = None,
    screenshot_baseline: str | None = None,
) -> int:
    """Record a known failure when an issue is filed."""
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """INSERT INTO known_failures (repo, test_name, issue_url, issue_number, screenshot_base64, filed_from_run_id, screenshot_baseline)
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               ON CONFLICT (repo, test_name, issue_number)
               DO UPDATE SET screenshot_base64 = $5, screenshot_baseline = $7, closed_at = NULL
               RETURNING id""",
            repo, test_name, issue_url, issue_number, screenshot_base64, filed_from_run_id, screenshot_baseline,
        )
    return row["id"]


async def list_known_failures(repo: str) -> list[dict]:
    """List open known failures for a repo."""
    pool = get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT id, test_name, issue_url, issue_number, screenshot_base64, screenshot_baseline, created_at
               FROM known_failures
               WHERE repo = $1
                 AND closed_at IS NULL
               ORDER BY created_at DESC""",
            repo,
        )
    return [dict(row) for row in rows]


async def close_known_failure(failure_id: int) -> dict | None:
    """Close a known failure. Returns the row if found."""
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """UPDATE known_failures
               SET closed_at = NOW()
               WHERE id = $1 AND closed_at IS NULL
               RETURNING id, repo, test_name, issue_url, issue_number""",
            failure_id,
        )
    return dict(row) if row else None


async def get_closed_known_failures(repo: str) -> list[dict]:
    """List closed known failures for a repo."""
    pool = get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT id, test_name, issue_url, issue_number, screenshot_base64, screenshot_baseline, created_at, closed_at
               FROM known_failures
               WHERE repo = $1
                 AND closed_at IS NOT NULL
               ORDER BY closed_at DESC""",
            repo,
        )
    return [dict(row) for row in rows]


async def add_pending_issue(
    run_id: str,
    repo: str,
    pr_number: int,
    test_name: str,
    classification: str | None = None,
    confidence: float | None = None,
    rationale: str | None = None,
    screenshot_base64: str | None = None,
) -> int:
    """Record intent to file a GitHub issue on merge."""
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """INSERT INTO pending_issues
                   (run_id, repo, pr_number, test_name, classification, confidence, rationale, screenshot_base64)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
               ON CONFLICT (run_id, test_name)
               DO UPDATE SET classification = $5, confidence = $6, rationale = $7, screenshot_base64 = $8
               RETURNING id""",
            run_id, repo, pr_number, test_name, classification, confidence, rationale, screenshot_base64,
        )
    return row["id"]


async def get_pending_issue_test_names(repo: str, pr_number: int) -> set[str]:
    """Get test names with unmaterialized pending issues for a repo/PR.

    Used during net-new filtering to skip failures that already have a
    deferred issue on the same PR.
    """
    pool = get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT DISTINCT test_name
               FROM pending_issues
               WHERE repo = $1
                 AND pr_number = $2
                 AND materialized_at IS NULL""",
            repo, pr_number,
        )
    return {row["test_name"] for row in rows}


async def get_pending_issues_for_pr(repo: str, pr_number: int) -> list[dict]:
    """Get unmaterialized pending issues for a repo/PR."""
    pool = get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT id, run_id, repo, pr_number, test_name, classification, confidence, rationale, screenshot_base64
               FROM pending_issues
               WHERE repo = $1
                 AND pr_number = $2
                 AND materialized_at IS NULL""",
            repo, pr_number,
        )
    return [dict(row) for row in rows]


async def mark_pending_issue_materialized(pending_id: int, issue_url: str) -> None:
    """Mark a pending issue as materialized with the real issue URL."""
    pool = get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """UPDATE pending_issues
               SET materialized_at = NOW(), issue_url = $2
               WHERE id = $1""",
            pending_id, issue_url,
        )


async def update_submission_url(run_id: str, test_name: str, url: str) -> None:
    """Update a submission's URL (e.g. replace deferred placeholder with real issue URL)."""
    pool = get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """UPDATE submissions SET url = $3 WHERE run_id = $1 AND test_name = $2""",
            run_id, test_name, url,
        )


async def get_known_failure_screenshot(repo: str, test_name: str) -> str | None:
    """Get the stored screenshot for a known failure (for comparison)."""
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """SELECT screenshot_base64
               FROM known_failures
               WHERE repo = $1 AND test_name = $2 AND closed_at IS NULL
               ORDER BY created_at DESC LIMIT 1""",
            repo, test_name,
        )
    return row["screenshot_base64"] if row else None
