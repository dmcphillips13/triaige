"""Post a triage summary comment on a GitHub PR.

Used for pre-merge triage mode: after processing visual test failures,
posts a markdown comment with the classification summary, known failure
annotations (with links to existing PRs/issues), skipped known failures
note, and a link to the dashboard run detail page.
"""

import logging

import httpx

from app.schemas import TriageRunResponse
from app.settings import settings

logger = logging.getLogger(__name__)


def post_triage_comment(
    repo: str,
    pr_number: int,
    run: TriageRunResponse | None,
    github_token: str | None = None,
    known_failures: dict[str, dict] | None = None,
    skipped_known: list[dict] | None = None,
    skipped_pending: list[dict] | None = None,
) -> str:
    """Post a triage summary comment on a PR.

    Args:
        repo: "owner/repo" format.
        pr_number: Pull request number.
        run: The triage run response with results. None if all failures were known.
        github_token: Per-request token. Falls back to env var.
        known_failures: Known failure context from store.get_known_failures().
        skipped_known: Known failures that were filtered out by net-new filtering.
        skipped_pending: Failures skipped because they have a deferred issue on this PR.

    Returns:
        URL of the created comment.
    """
    effective_token = github_token or settings.github_token
    if not effective_token:
        raise RuntimeError("GitHub token is required for PR comments")

    known = known_failures or {}
    skipped = skipped_known or []
    pending = skipped_pending or []

    lines: list[str] = []

    # If there are triaged results, show the full report
    if run and run.results:
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

        lines.extend([
            "## Triaige Visual Regression Report",
            "",
            f"**{run.total_failures} failure{'s' if run.total_failures != 1 else ''}** triaged: {summary}",
            "",
            "| Test | Classification | Confidence | Status |",
            "|---|---|---|---|",
        ])
        for r in run.results:
            res = r.ask_response
            confidence = f"{round(res.confidence * 100)}%"

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

    # Add skipped known failures section
    if skipped:
        if lines:
            lines.append("")
            lines.append("---")
            lines.append("")

        lines.extend([
            f"**{len(skipped)} known failure{'s' if len(skipped) != 1 else ''}** skipped (already tracked on main):",
            "",
        ])
        for s in skipped:
            issue_url = s.get("issue_url")
            if issue_url:
                lines.append(f"- `{s['test_name']}` — [open issue]({issue_url})")
            else:
                lines.append(f"- `{s['test_name']}`")
        lines.extend([
            "",
            "> These tests are failing on main with open issues. "
            "Please verify these areas manually as visual tests cannot detect "
            "regressions while the baseline is broken.",
        ])

    # Add pending (deferred) issues section
    if pending:
        if lines:
            lines.append("")
            lines.append("---")
            lines.append("")

        lines.extend([
            f"**{len(pending)} failure{'s' if len(pending) != 1 else ''}** with issues pending merge:",
            "",
        ])
        for p in pending:
            lines.append(f"- `{p['test_name']}` — issue will be filed on merge")

    if not lines:
        return ""

    body = "\n".join(lines)

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
