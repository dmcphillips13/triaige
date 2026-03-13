"""GitHub Checks API integration.

Creates and updates check runs on PRs to implement the merge gate.
A pending check blocks the PR from merging until all net-new failures
are addressed (baseline committed or issue filed).
"""

import logging

import httpx

from app.settings import settings

logger = logging.getLogger(__name__)


def _get_client(token: str | None = None) -> httpx.Client:
    """Authenticated GitHub API client."""
    effective_token = token or settings.github_token
    if not effective_token:
        raise RuntimeError("GitHub token is required for check runs")
    return httpx.Client(
        base_url="https://api.github.com",
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {effective_token}",
        },
        timeout=30.0,
    )


def create_check_run(
    repo: str,
    head_sha: str,
    total_failures: int,
    github_token: str | None = None,
) -> int:
    """Create a pending check run on a PR commit.

    Returns the check run ID for later updates.
    """
    client = _get_client(github_token)

    summary = f"{total_failures} visual failure{'s' if total_failures != 1 else ''} need review"

    resp = client.post(
        f"/repos/{repo}/check-runs",
        json={
            "name": "Triaige Visual Regression",
            "head_sha": head_sha,
            "status": "in_progress",
            "output": {
                "title": "Visual failures need review",
                "summary": summary,
            },
        },
    )
    resp.raise_for_status()
    check_run_id = resp.json()["id"]
    logger.info("Created check run %d on %s @ %s", check_run_id, repo, head_sha[:8])
    return check_run_id


def update_check_run(
    repo: str,
    check_run_id: int,
    conclusion: str,
    summary: str,
    github_token: str | None = None,
) -> None:
    """Update a check run with a conclusion.

    Args:
        conclusion: "success", "action_required", or "failure"
        summary: Human-readable summary of the check result
    """
    client = _get_client(github_token)

    title = {
        "success": "All visual failures addressed",
        "action_required": "Visual failures need review",
        "failure": "Visual regression check failed",
    }.get(conclusion, "Visual regression check")

    resp = client.patch(
        f"/repos/{repo}/check-runs/{check_run_id}",
        json={
            "status": "completed",
            "conclusion": conclusion,
            "output": {
                "title": title,
                "summary": summary,
            },
        },
    )
    resp.raise_for_status()
    logger.info("Updated check run %d → %s", check_run_id, conclusion)
