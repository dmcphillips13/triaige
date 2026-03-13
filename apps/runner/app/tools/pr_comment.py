"""Post a triage summary comment on a GitHub PR.

Used for pre-merge triage mode: after processing visual test failures,
posts a markdown comment with the classification summary, known failure
annotations (with links to existing PRs/issues), and a link to the
dashboard run detail page.
"""

import logging

import httpx

from app.schemas import TriageRunResponse
from app.settings import settings

logger = logging.getLogger(__name__)


def post_triage_comment(
    repo: str,
    pr_number: int,
    run: TriageRunResponse,
    github_token: str | None = None,
    known_failures: dict[str, dict] | None = None,
) -> str:
    """Post a triage summary comment on a PR.

    Args:
        repo: "owner/repo" format.
        pr_number: Pull request number.
        run: The triage run response with results.
        github_token: Per-request token. Falls back to env var.
        known_failures: Known failure context from store.get_known_failures().

    Returns:
        URL of the created comment.
    """
    effective_token = github_token or settings.github_token
    if not effective_token:
        raise RuntimeError("GitHub token is required for PR comments")

    known = known_failures or {}

    # Build classification summary
    counts: dict[str, int] = {}
    for r in run.results:
        cls = r.ask_response.classification
        counts[cls] = counts.get(cls, 0) + 1

    summary_parts = []
    for cls in ("expected", "unexpected", "uncertain"):
        if cls in counts:
            summary_parts.append(f"{counts[cls]} {cls}")

    summary = ", ".join(summary_parts) if summary_parts else "no failures"
    dashboard_link = f"{settings.dashboard_url}/runs/{run.run_id}"

    # Build markdown body
    lines = [
        "## Triaige Visual Regression Report",
        "",
        f"**{run.total_failures} failure{'s' if run.total_failures != 1 else ''}** triaged: {summary}",
        "",
        "| Test | Classification | Confidence | Status |",
        "|---|---|---|---|",
    ]
    for r in run.results:
        res = r.ask_response
        confidence = f"{round(res.confidence * 100)}%"

        # Build status column with known failure context
        kf = known.get(r.test_name, {})
        status_parts = []

        failing_since = kf.get("failing_since")
        if failing_since:
            pr_title = failing_since.get("pr_title") or "a previous run"
            pr_url = failing_since.get("pr_url")
            if pr_url:
                status_parts.append(f"Known — [since {pr_title}]({pr_url})")
            else:
                status_parts.append(f"Known — since {pr_title}")

        open_sub = kf.get("open_submission")
        if open_sub:
            sub_label = "Baseline PR" if open_sub["type"] == "pr" else "Issue"
            status_parts.append(f"[{sub_label} open]({open_sub['url']})")

        if not status_parts:
            status_parts.append("New")

        lines.append(
            f"| {r.test_name} | {res.classification} | {confidence} | {' · '.join(status_parts)} |"
        )

    lines.extend([
        "",
        f"[View full results]({dashboard_link})",
        "",
        "> **Action required**: address all failures before merging.",
    ])

    body = "\n".join(lines)

    # Post comment via GitHub API (PRs are issues)
    client = httpx.Client(
        base_url="https://api.github.com",
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {effective_token}",
        },
        timeout=15.0,
    )
    resp = client.post(
        f"/repos/{repo}/issues/{pr_number}/comments",
        json={"body": body},
    )
    resp.raise_for_status()
    comment_url = resp.json()["html_url"]

    logger.info("Posted triage comment on %s#%d: %s", repo, pr_number, comment_url)
    return comment_url


def post_gate_passed_comment(
    repo: str,
    pr_number: int,
    github_token: str | None = None,
) -> str:
    """Post a comment indicating all visual failures have been addressed.

    Returns the URL of the created comment.
    """
    effective_token = github_token or settings.github_token
    if not effective_token:
        raise RuntimeError("GitHub token is required for PR comments")

    body = (
        "## Triaige Visual Regression\n\n"
        "All visual failures have been addressed. Ready to merge."
    )

    client = httpx.Client(
        base_url="https://api.github.com",
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {effective_token}",
        },
        timeout=15.0,
    )
    resp = client.post(
        f"/repos/{repo}/issues/{pr_number}/comments",
        json={"body": body},
    )
    resp.raise_for_status()
    comment_url = resp.json()["html_url"]

    logger.info("Posted gate-passed comment on %s#%d: %s", repo, pr_number, comment_url)
    return comment_url
