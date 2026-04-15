"""Issue creation service — immediate and deferred."""

import asyncio
import logging

from app import store
from app.schemas import CreateIssuesRequest, CreateIssuesResponse
from app.tools.github_issues import create_bug_issue

logger = logging.getLogger(__name__)


async def create_issues(
    req: CreateIssuesRequest,
    run: object,
    github_token: str | None,
) -> CreateIssuesResponse:
    """Create GitHub issues for rejected failures, deferring for pre-merge runs."""
    is_pre_merge = run.triage_mode == "pre_merge"
    issues: list[dict] = []

    for name in req.test_names:
        result = await store.get_result(req.run_id, name)
        if not result:
            raise ValueError(f"Result not found: {name}")

        if is_pre_merge:
            pr_number = await store.get_run_pr_number(req.run_id)
            if not pr_number:
                raise ValueError("No PR number for pre-merge run")
            await store.add_pending_issue(
                run_id=req.run_id,
                repo=req.repo,
                pr_number=pr_number,
                test_name=name,
                classification=result.ask_response.classification,
                confidence=result.ask_response.confidence,
                rationale=result.ask_response.rationale,
                screenshot_base64=result.screenshot_actual,
            )
            issues.append({"test_name": name, "issue_url": "deferred:merge"})
            logger.info("Deferred issue for %s until PR #%d merges", name, pr_number)
        else:
            run_pr = await store.get_run_pr_number(req.run_id)
            issue_url = await asyncio.to_thread(
                create_bug_issue,
                repo=req.repo,
                run_id=req.run_id,
                test_name=result.test_name,
                classification=result.ask_response.classification,
                confidence=result.ask_response.confidence,
                rationale=result.ask_response.rationale,
                github_token=github_token,
                pr_number=run_pr,
                failure_type=result.failure_type,
            )
            issues.append({"test_name": name, "issue_url": issue_url})

            try:
                issue_number = int(issue_url.rstrip("/").split("/")[-1])
                await store.add_known_failure(
                    repo=req.repo,
                    test_name=name,
                    issue_url=issue_url,
                    issue_number=issue_number,
                    screenshot_base64=result.screenshot_actual,
                    filed_from_run_id=req.run_id,
                    screenshot_baseline=result.screenshot_baseline,
                )
            except Exception as e:
                logger.warning("Failed to record known failure for %s: %s", name, e)

    return CreateIssuesResponse(issues=issues)
