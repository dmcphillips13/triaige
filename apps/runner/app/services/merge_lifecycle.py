"""Post-merge lifecycle — issue materialization, drift detection, and run cleanup."""

import asyncio
import logging

from app import events, repo_settings, store
from app.schemas import ReportCleanRequest
from app.tools.github_checks import create_passing_check_run
from app.tools.github_issues import create_bug_issue

logger = logging.getLogger(__name__)


async def handle_report_clean(req: ReportCleanRequest) -> dict:
    """Process a clean test report — close runs, materialize issues, detect drift.

    Called when all visual tests pass after a push or PR merge.
    """
    # Auto-close pre-merge runs when a PR merges with all tests passing
    if req.event == "push" and req.pr_number:
        closed_ids = await store.auto_close_pre_merge_runs(req.repo, req.pr_number)
        if closed_ids:
            logger.info(
                "Auto-closed %d pre-merge run(s) on clean merge of PR #%s",
                len(closed_ids), req.pr_number,
            )
            for cid in closed_ids:
                events.emit("run_closed", {"run_id": cid, "repo": req.repo})

        await _materialize_pending_issues(req.repo, req.pr_number)
        if closed_ids:
            await _detect_merge_drift(req.repo, req.pr_number, closed_ids)

    # Create passing check run if merge gate is enabled
    try:
        rs = await repo_settings.get_settings(req.repo)
    except Exception as e:
        logger.warning("Failed to fetch repo settings for %s: %s", req.repo, e)
        return {"status": "ok", "reason": "runs closed, settings fetch failed"}

    if not rs.merge_gate:
        return {"status": "ok", "reason": "merge_gate disabled, runs closed"}

    try:
        check_run_id = await asyncio.to_thread(
            create_passing_check_run, repo=req.repo, head_sha=req.head_sha,
        )
        return {"status": "ok", "check_run_id": check_run_id}
    except Exception as e:
        logger.error("Failed to create passing check run for %s: %s", req.repo, e)
        return {"status": "error", "reason": "Failed to create GitHub check run"}


async def _materialize_pending_issues(repo: str, pr_number: int) -> None:
    """Create GitHub issues for deferred rejections now that the PR has merged."""
    pending = await store.get_pending_issues_for_pr(repo, pr_number)
    for pi in pending:
        try:
            issue_url = await asyncio.to_thread(
                create_bug_issue,
                repo=pi["repo"],
                run_id=pi["run_id"],
                test_name=pi["test_name"],
                classification=pi["classification"],
                confidence=pi["confidence"],
                rationale=pi["rationale"],
                github_token=None,
                pr_number=pi.get("pr_number"),
            )
            issue_number = int(issue_url.rstrip("/").split("/")[-1])
            pi_result = await store.get_result(pi["run_id"], pi["test_name"])
            pi_baseline = pi_result.screenshot_baseline if pi_result else None
            await store.add_known_failure(
                repo=pi["repo"],
                test_name=pi["test_name"],
                issue_url=issue_url,
                issue_number=issue_number,
                screenshot_base64=pi["screenshot_base64"],
                filed_from_run_id=pi["run_id"],
                screenshot_baseline=pi_baseline,
            )
            await store.mark_pending_issue_materialized(pi["id"], issue_url)
            await store.update_submission_url(pi["run_id"], pi["test_name"], issue_url)
            logger.info("Materialized deferred issue for %s → %s", pi["test_name"], issue_url)
        except Exception as e:
            logger.warning("Failed to materialize pending issue for %s: %s", pi["test_name"], e)


async def _detect_merge_drift(
    repo: str, pr_number: int, closed_ids: list[str],
) -> None:
    """Compare stored known-failure screenshots against merged PR actuals.

    Posts a notice on the GitHub issue when drift is detected.
    """
    known_failures = await store.list_known_failures(repo)
    for kf in known_failures:
        try:
            for cid in closed_ids:
                result = await store.get_result(cid, kf["test_name"])
                if result and result.screenshot_actual:
                    stored = kf.get("screenshot_base64")
                    if stored and stored != result.screenshot_actual:
                        from app.tools.github_checks import _get_client

                        def _check_and_post(
                            kf_issue=kf["issue_number"], kf_test=kf["test_name"],
                        ):
                            client = _get_client(repo)
                            existing = client.get(
                                f"/repos/{repo}/issues/{kf_issue}/comments",
                                params={"per_page": 100},
                            )
                            existing.raise_for_status()
                            marker = f"PR #{pr_number}"
                            if any(marker in c.get("body", "") for c in existing.json()):
                                return False
                            pr_url = f"https://github.com/{repo}/pull/{pr_number}"
                            comment = (
                                f"**Note:** PR #{pr_number} ([view]({pr_url})) "
                                f"further modifies this area. The visual appearance has changed "
                                f"since this issue was filed. Please verify manually."
                            )
                            client.post(
                                f"/repos/{repo}/issues/{kf_issue}/comments",
                                json={"body": comment},
                            )
                            return True

                        posted = await asyncio.to_thread(_check_and_post)
                        if posted:
                            logger.info(
                                "Posted merge drift notice on issue #%d for %s (PR #%s)",
                                kf["issue_number"], kf["test_name"], pr_number,
                            )
                    break
        except Exception as e:
            logger.warning(
                "Failed drift check for %s on merge: %s", kf["test_name"], e,
            )
