"""Create GitHub issues for rejected visual regression failures.

Each rejected failure gets its own issue with test name, classification,
rationale, and a link to the Triaige dashboard run detail page.
"""

import logging

import httpx

from app.settings import settings

logger = logging.getLogger(__name__)


def create_bug_issue(
    repo: str,
    run_id: str,
    test_name: str,
    classification: str,
    confidence: float,
    rationale: str,
    dashboard_url: str | None = None,
    github_token: str | None = None,
    pr_number: int | None = None,
) -> str:
    """Create a GitHub issue for a rejected visual regression failure.

    Args:
        repo: "owner/repo" format.
        run_id: Triage run ID.
        test_name: Name of the failing test.
        classification: Triage classification (e.g. "unexpected").
        confidence: Confidence score (0-1).
        rationale: Explanation of the classification.
        dashboard_url: Base URL of the Triaige dashboard.
        github_token: Per-request token. Falls back to env var.
        pr_number: Originating PR number for context.

    Returns:
        URL of the created issue.
    """
    effective_token = github_token or settings.github_token
    if not effective_token:
        raise RuntimeError("GitHub token is required for creating issues")

    base_url = dashboard_url or settings.dashboard_url
    run_link = f"{base_url}/runs/{run_id}"

    # Build source line with PR link when available
    if pr_number:
        pr_url = f"https://github.com/{repo}/pull/{pr_number}"
        source_line = f"**Source:** [PR #{pr_number}]({pr_url})"
    else:
        source_line = None

    body_lines = [
        "## Visual Regression Bug Report",
        "",
        f"**Test:** `{test_name}`",
        f"**Classification:** {classification} ({round(confidence * 100)}% confidence)",
    ]
    if source_line:
        body_lines.append(source_line)
    body_lines.extend([
        "",
        "### Analysis",
        "",
        rationale,
        "",
        "### Details",
        "",
        f"View screenshots and full triage details: [{run_id[:8]}]({run_link})",
        "",
        "---",
        "*Created by [Triaige](https://triaige-dashboard.vercel.app) visual regression triage*",
    ])

    client = httpx.Client(
        base_url="https://api.github.com",
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {effective_token}",
        },
        timeout=15.0,
    )

    resp = client.post(
        f"/repos/{repo}/issues",
        json={
            "title": f"Visual regression: {test_name}",
            "body": "\n".join(body_lines),
            "labels": ["visual-regression"],
        },
    )
    # If label doesn't exist, retry without it
    if resp.status_code == 422:
        resp = client.post(
            f"/repos/{repo}/issues",
            json={
                "title": f"Visual regression: {test_name}",
                "body": "\n".join(body_lines),
            },
        )
    resp.raise_for_status()
    issue_url = resp.json()["html_url"]

    logger.info("Created issue for %s: %s", test_name, issue_url)
    return issue_url


def post_issue_comment(
    repo: str,
    issue_number: int,
    body: str,
    github_token: str | None = None,
) -> None:
    """Post a comment on an existing GitHub issue."""
    effective_token = github_token or settings.github_token
    if not effective_token:
        raise RuntimeError("No GitHub token available for posting issue comment")

    client = httpx.Client(
        base_url="https://api.github.com",
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {effective_token}",
        },
        timeout=15.0,
    )

    resp = client.post(
        f"/repos/{repo}/issues/{issue_number}/comments",
        json={"body": body},
    )
    resp.raise_for_status()
    logger.info("Posted comment on %s#%d", repo, issue_number)
