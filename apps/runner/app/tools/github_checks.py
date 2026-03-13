"""GitHub Checks API integration.

Creates and updates check runs on PRs to implement the merge gate.
A pending check blocks the PR from merging until all net-new failures
are addressed (baseline committed or issue filed).

Uses GitHub App installation tokens for auth — check runs can only be
updated by the same identity that created them.
"""

import logging
import time

import httpx
import jwt

from app.settings import settings

logger = logging.getLogger(__name__)


def _get_app_jwt() -> str:
    """Generate a short-lived JWT for GitHub App authentication."""
    if not settings.github_app_id or not settings.github_app_private_key:
        raise RuntimeError("GitHub App ID and private key are required for check runs")
    now = int(time.time())
    payload = {
        "iat": now - 60,
        "exp": now + (10 * 60),
        "iss": settings.github_app_id,
    }
    private_key = settings.github_app_private_key.replace("\\n", "\n")
    return jwt.encode(payload, private_key, algorithm="RS256")


def _get_installation_token(repo: str) -> str:
    """Get an installation access token for the repo's App installation."""
    app_jwt = _get_app_jwt()
    client = httpx.Client(
        base_url="https://api.github.com",
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {app_jwt}",
        },
        timeout=15.0,
    )
    # Find the installation for this repo
    resp = client.get(f"/repos/{repo}/installation")
    resp.raise_for_status()
    installation_id = resp.json()["id"]

    # Create an installation access token
    resp = client.post(f"/app/installations/{installation_id}/access_tokens")
    resp.raise_for_status()
    return resp.json()["token"]


def _get_client(repo: str) -> httpx.Client:
    """Authenticated GitHub API client using App installation token."""
    token = _get_installation_token(repo)
    return httpx.Client(
        base_url="https://api.github.com",
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {token}",
        },
        timeout=30.0,
    )


def create_check_run(
    repo: str,
    head_sha: str,
    total_failures: int,
    github_token: str | None = None,
) -> int:
    """Create a check run on a PR commit that blocks merge.

    Created as completed/action_required so it doesn't appear as a
    spinning "in progress" check — just a clear signal that review
    is needed before merging.

    Returns the check run ID for later updates.
    """
    client = _get_client(repo)

    summary = f"{total_failures} visual failure{'s' if total_failures != 1 else ''} need review"

    resp = client.post(
        f"/repos/{repo}/check-runs",
        json={
            "name": "Triaige Visual Regression",
            "head_sha": head_sha,
            "status": "completed",
            "conclusion": "action_required",
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
    client = _get_client(repo)

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
