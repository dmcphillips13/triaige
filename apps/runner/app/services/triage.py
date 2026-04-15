"""Core triage orchestration — filtering, classification, and merge gate management."""

import asyncio
import logging

from app import events, repo_settings, store
from app.agent.graph import run_graph
from app.grouping import build_group_request, extract_test_name, group_failures
from app.schemas import (
    AskRequest,
    AskResponse,
    TriageFailureResult,
    TriageRunRequest,
    TriageRunResponse,
)
from app.tools.github_checks import (
    create_check_run,
    create_passing_check_run,
    create_setup_required_check_run,
)
from app.tools.pr_comment import post_triage_comment

logger = logging.getLogger(__name__)


async def filter_known_failures(
    repo: str, ask_requests: list[AskRequest],
) -> tuple[list[AskRequest], list[dict]]:
    """Remove failures already tracked as known (open GitHub issues).

    Returns the filtered request list and metadata about skipped failures.
    """
    skipped_known: list[dict] = []
    existing = await store.get_existing_failures_with_issues(repo)
    if not existing:
        return ask_requests, skipped_known

    existing = await sync_known_failure_states(repo, existing)

    skipped_requests = [
        r for r in ask_requests if extract_test_name(r) in existing
    ]
    remaining = [
        r for r in ask_requests if extract_test_name(r) not in existing
    ]
    for r in skipped_requests:
        test_name = extract_test_name(r)
        screenshot = r.run_summary.screenshot_actual if r.run_summary else None
        skipped_known.append({
            "test_name": test_name,
            "screenshot": screenshot,
            "issue_url": existing.get(test_name, {}).get("issue_url"),
        })

    return remaining, skipped_known


async def filter_pending_failures(
    repo: str, pr_number: int, ask_requests: list[AskRequest],
) -> tuple[list[AskRequest], list[dict]]:
    """Remove failures with pending (deferred) issues on the same PR."""
    skipped_pending: list[dict] = []
    pending_names = await store.get_pending_issue_test_names(repo, pr_number)
    if not pending_names:
        return ask_requests, skipped_pending

    for r in ask_requests:
        test_name = extract_test_name(r)
        if test_name in pending_names:
            skipped_pending.append({"test_name": test_name})
    remaining = [
        r for r in ask_requests
        if extract_test_name(r) not in pending_names
    ]
    if skipped_pending:
        logger.info(
            "Skipped %d failure(s) with pending issues on PR #%d",
            len(skipped_pending), pr_number,
        )

    return remaining, skipped_pending


async def detect_drift(
    repo: str, skipped_known: list[dict],
) -> None:
    """Check stored screenshots against current actuals for known failures.

    Mutates skipped_known entries in place by adding ``has_drift`` flag.
    """
    for skipped in skipped_known:
        try:
            stored = await store.get_known_failure_screenshot(repo, skipped["test_name"])
            if stored and skipped["screenshot"] and stored != skipped["screenshot"]:
                skipped["has_drift"] = True
        except Exception as e:
            logger.warning(
                "Failed screenshot comparison for %s: %s",
                skipped["test_name"], e,
            )


async def run_triage_pipeline(
    ask_requests: list[AskRequest],
) -> list[TriageFailureResult]:
    """Classify failures through the LLM agent pipeline.

    Functional failures are processed individually for accuracy.
    Visual failures are grouped to reduce LLM calls.
    """
    functional_requests = [
        r for r in ask_requests
        if r.run_summary and r.run_summary.failure_type == "error"
    ]
    visual_requests = [
        r for r in ask_requests
        if not (r.run_summary and r.run_summary.failure_type == "error")
    ]

    results: list[TriageFailureResult] = []

    for ask_req in functional_requests:
        response = await asyncio.to_thread(run_graph, ask_req)
        results.append(_build_result(ask_req, response, None))

    groups = group_failures(visual_requests)
    for grp in groups:
        group_names = grp.test_names if len(grp.test_names) > 1 else None
        if len(grp.requests) <= 2:
            for ask_req in grp.requests:
                response = await asyncio.to_thread(run_graph, ask_req)
                results.append(_build_result(ask_req, response, group_names))
        else:
            group_request = build_group_request(grp)
            response = await asyncio.to_thread(run_graph, group_request)
            for ask_req in grp.requests:
                results.append(_build_result(ask_req, response, group_names))

    return results


async def create_empty_response(
    repo: str | None, mode: str,
) -> TriageRunResponse:
    """Return an empty response for cases with no failures to process."""
    return TriageRunResponse(
        run_id="",
        created_at="",
        total_failures=0,
        results=[],
        repo=repo,
        triage_mode=mode,
    )


async def handle_no_failures_check(
    mode: str, req: TriageRunRequest,
) -> None:
    """Create a passing check run when there are zero failures."""
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
                logger.info("Created passing check — no failures")
            except Exception as e:
                logger.warning("Failed to create passing check run: %s", e)


async def handle_setup_required_check(
    mode: str, req: TriageRunRequest,
) -> None:
    """Create a setup-required check when no OpenAI key is available."""
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
                    create_setup_required_check_run,
                    repo=req.pr_context.repo,
                    head_sha=req.pr_context.head_sha,
                )
                logger.info("Created setup-required check — no OpenAI key")
            except Exception as e:
                logger.warning("Failed to create setup-required check: %s", e)


async def post_skipped_comment(
    req: TriageRunRequest,
    skipped_known: list[dict],
    skipped_pending: list[dict],
    github_token: str | None,
) -> None:
    """Post a PR comment listing skipped known/pending failures."""
    if (
        (skipped_known or skipped_pending)
        and req.pr_context
        and req.pr_context.pr_number
        and req.pr_context.repo
    ):
        try:
            post_triage_comment(
                repo=req.pr_context.repo,
                pr_number=req.pr_context.pr_number,
                run=None,
                github_token=github_token,
                known_failures={},
                skipped_known=skipped_known,
                skipped_pending=skipped_pending,
            )
        except Exception as e:
            logger.warning("Failed to post known failures PR comment: %s", e)


async def close_superseded_runs(
    repo: str, pr_number: int,
) -> None:
    """Auto-close older pre-merge runs for the same PR."""
    closed_ids = await store.auto_close_pre_merge_runs(repo, pr_number)
    if closed_ids:
        logger.info(
            "Auto-closed %d superseded pre-merge run(s) for PR #%d",
            len(closed_ids), pr_number,
        )
        for cid in closed_ids:
            events.emit("run_closed", {"run_id": cid, "repo": repo})


async def create_merge_gate_check(
    run_response: TriageRunResponse,
    req: TriageRunRequest,
    mode: str,
    github_token: str | None,
) -> None:
    """Create or update the merge gate check run for a triage run."""
    if not (
        mode == "pre_merge"
        and run_response.results
        and req.pr_context
        and req.pr_context.head_sha
        and req.pr_context.repo
    ):
        return

    rs = await repo_settings.get_settings(req.pr_context.repo)
    if not rs.merge_gate:
        return

    try:
        gate_already_passed = await store.check_pre_merge_gate(run_response.run_id)

        if gate_already_passed:
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


async def post_triage_pr_comment(
    run_response: TriageRunResponse,
    req: TriageRunRequest,
    mode: str,
    skipped_known: list[dict],
    skipped_pending: list[dict],
    github_token: str | None,
) -> None:
    """Post a PR comment summarizing triage results."""
    if not (
        mode == "pre_merge"
        and run_response.results
        and req.pr_context
        and req.pr_context.pr_number
        and req.pr_context.repo
    ):
        return

    known = await store.get_known_failures(run_response.run_id)
    try:
        post_triage_comment(
            repo=req.pr_context.repo,
            pr_number=req.pr_context.pr_number,
            run=run_response,
            github_token=github_token,
            known_failures=known,
            skipped_known=skipped_known,
            skipped_pending=skipped_pending,
        )
    except Exception as e:
        logger.warning("Failed to post PR comment: %s", e)


async def sync_known_failure_states(
    repo: str, existing: dict[str, dict],
) -> dict[str, dict]:
    """Verify known failure issues are still open on GitHub. Auto-close stale entries.

    Fails open: if the GitHub API is unavailable, returns the original dict unchanged.
    """
    if not existing:
        return existing
    try:
        from app.tools.github_checks import _get_client

        client = await asyncio.to_thread(_get_client, repo)
        stale_tests = []
        for test_name, info in existing.items():
            try:
                resp = client.get(f"/repos/{repo}/issues/{info['issue_number']}")
                if resp.status_code != 200 or resp.json().get("state") != "open":
                    stale_tests.append(test_name)
                    await store.close_known_failure(info["id"])
                    logger.info(
                        "Auto-closed stale known failure: %s (issue #%s %s)",
                        test_name, info["issue_number"],
                        "not found" if resp.status_code != 200 else "closed",
                    )
            except Exception as e:
                logger.warning(
                    "Failed to check issue #%s for %s: %s",
                    info["issue_number"], test_name, e,
                )
        for t in stale_tests:
            del existing[t]
    except Exception as e:
        logger.warning("Skipping known failure sync for %s: %s", repo, e)
    return existing


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
        failure_type=rs.failure_type if rs else None,
    )
