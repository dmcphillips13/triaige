"""Baseline screenshot update service."""

import asyncio
import logging

from app import store
from app.schemas import UpdateBaselinesRequest, UpdateBaselinesResponse
from app.tools.github_actions import commit_baselines_to_branch, create_baseline_pr

logger = logging.getLogger(__name__)


async def update_baselines(
    req: UpdateBaselinesRequest,
    run: object,
    github_token: str | None,
) -> UpdateBaselinesResponse:
    """Commit updated baseline screenshots to the PR branch or create a baseline PR."""
    baselines: list[dict] = []
    for name in req.test_names:
        result = await store.get_result(req.run_id, name)
        if not result:
            raise ValueError(f"Result not found: {name}")
        if not result.screenshot_actual:
            raise ValueError(f"No actual screenshot for: {name}")
        if not result.snapshot_path:
            raise ValueError(f"No snapshot path for: {name}")
        baselines.append({
            "path": result.snapshot_path,
            "content_base64": result.screenshot_actual,
            "test_name": result.test_name,
        })

    if not baselines:
        raise ValueError("No baselines to update")

    logger.info(
        "Updating %d baseline(s) for run %s: %s",
        len(baselines), req.run_id[:8], [b["test_name"] for b in baselines],
    )

    if run.triage_mode == "pre_merge":
        pr_number = await store.get_run_pr_number(req.run_id)
        if not pr_number:
            raise ValueError("No PR number for pre-merge run")
        commit_sha = await asyncio.to_thread(
            commit_baselines_to_branch,
            repo=req.repo,
            pr_number=pr_number,
            baselines=baselines,
            github_token=github_token,
        )
        pr_url = f"https://github.com/{req.repo}/pull/{pr_number}/commits/{commit_sha}"
    else:
        pr_url = await asyncio.to_thread(
            create_baseline_pr,
            repo=req.repo,
            run_id=req.run_id,
            baselines=baselines,
            source_pr_title=run.pr_title,
            github_token=github_token,
        )

    return UpdateBaselinesResponse(pr_url=pr_url)
