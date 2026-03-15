"""GitHub automated actions via the Git Data API.

Creates a PR that updates baseline screenshots by:
1. Getting the default branch HEAD SHA
2. Creating blobs for each new baseline (base64 encoded)
3. Building a tree with the updated files
4. Creating a commit on a new branch
5. Opening a PR back to the default branch

This avoids cloning the repo — everything happens via REST API calls.
Requires a GitHub token with repo write permissions.
"""

import logging

import httpx

from app.settings import settings

logger = logging.getLogger(__name__)


def _get_client(token: str | None = None) -> httpx.Client:
    """Authenticated GitHub API client. Prefers per-request token, falls back to env var."""
    effective_token = token or settings.github_token
    if not effective_token:
        raise RuntimeError("GitHub token is required for automated actions")
    return httpx.Client(
        base_url="https://api.github.com",
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {effective_token}",
        },
        timeout=30.0,
    )


def create_baseline_pr(
    repo: str,
    run_id: str,
    baselines: list[dict],
    source_pr_title: str | None = None,
    github_token: str | None = None,
) -> str:
    """Create a PR updating baseline screenshots.

    Args:
        repo: "owner/repo" format.
        run_id: Triage run ID (used for branch naming).
        baselines: List of dicts with 'path', 'content_base64', 'test_name'.
        source_pr_title: Title of the PR that triggered the triage run.
        github_token: Per-request token (from OAuth user). Falls back to env var.

    Returns:
        URL of the created pull request.
    """
    client = _get_client(github_token)
    run_short = run_id[:8]

    # 1. Get default branch and its HEAD SHA
    repo_resp = client.get(f"/repos/{repo}")
    repo_resp.raise_for_status()
    repo_info = repo_resp.json()
    default_branch = repo_info["default_branch"]
    ref_resp = client.get(f"/repos/{repo}/git/ref/heads/{default_branch}")
    ref_resp.raise_for_status()
    ref_data = ref_resp.json()
    base_sha = ref_data["object"]["sha"]

    # 2. Create blobs for each baseline screenshot
    tree_items = []
    for bl in baselines:
        blob_resp = client.post(
            f"/repos/{repo}/git/blobs",
            json={"content": bl["content_base64"], "encoding": "base64"},
        )
        blob_resp.raise_for_status()
        blob_sha = blob_resp.json()["sha"]
        tree_items.append({
            "path": bl["path"],
            "mode": "100644",
            "type": "blob",
            "sha": blob_sha,
        })

    # 3. Create tree
    tree_resp = client.post(
        f"/repos/{repo}/git/trees",
        json={"base_tree": base_sha, "tree": tree_items},
    )
    tree_resp.raise_for_status()
    tree_sha = tree_resp.json()["sha"]

    # 4. Create commit
    test_count = len(baselines)
    commit_message = f"Update {test_count} baseline screenshot{'s' if test_count != 1 else ''}"
    if source_pr_title:
        commit_message += f"\n\nTriggered by: {source_pr_title}"
    commit_message += f"\nTriage run: {run_id}"

    commit_resp = client.post(
        f"/repos/{repo}/git/commits",
        json={
            "message": commit_message,
            "tree": tree_sha,
            "parents": [base_sha],
        },
    )
    commit_resp.raise_for_status()
    commit_sha = commit_resp.json()["sha"]

    # 5. Create branch
    branch_name = f"triaige/update-baselines-{run_short}"
    ref_resp = client.post(
        f"/repos/{repo}/git/refs",
        json={"ref": f"refs/heads/{branch_name}", "sha": commit_sha},
    )
    ref_resp.raise_for_status()

    # 6. Open PR
    body_lines = [
        "## Updated baselines",
        "",
        f"Triage run `{run_id}` classified these failures as **expected**",
        "and a human approved the updates.",
        "",
        "| Test | Snapshot |",
        "|---|---|",
    ]
    for bl in baselines:
        body_lines.append(f"| {bl['test_name']} | `{bl['path']}` |")

    if source_pr_title:
        body_lines.extend(["", f"Source PR: {source_pr_title}"])

    pr_title = f"Update {test_count} baseline screenshot{'s' if test_count != 1 else ''}"
    pr_resp = client.post(
        f"/repos/{repo}/pulls",
        json={
            "title": pr_title,
            "body": "\n".join(body_lines),
            "head": branch_name,
            "base": default_branch,
        },
    )
    pr_resp.raise_for_status()
    pr_url = pr_resp.json()["html_url"]

    logger.info("Created baseline PR: %s", pr_url)
    return pr_url


def commit_baselines_to_branch(
    repo: str,
    pr_number: int,
    baselines: list[dict],
    github_token: str | None = None,
) -> str:
    """Commit updated baselines directly to a PR's head branch.

    Used for pre-merge runs where approved baselines go into the open PR
    rather than creating a separate baseline PR.

    Args:
        repo: "owner/repo" format.
        pr_number: PR number to commit to.
        baselines: List of dicts with 'path', 'content_base64', 'test_name'.
        github_token: Per-request token (from OAuth user).

    Returns:
        SHA of the created commit.
    """
    client = _get_client(github_token)

    # 1. Get the PR's head branch and its current SHA
    pr_resp = client.get(f"/repos/{repo}/pulls/{pr_number}")
    pr_resp.raise_for_status()
    pr_data = pr_resp.json()
    branch = pr_data["head"]["ref"]
    base_sha = pr_data["head"]["sha"]

    # 2. Create blobs for each baseline screenshot
    tree_items = []
    for bl in baselines:
        blob_resp = client.post(
            f"/repos/{repo}/git/blobs",
            json={"content": bl["content_base64"], "encoding": "base64"},
        )
        blob_resp.raise_for_status()
        blob_sha = blob_resp.json()["sha"]
        tree_items.append({
            "path": bl["path"],
            "mode": "100644",
            "type": "blob",
            "sha": blob_sha,
        })

    # 3. Create tree
    tree_resp = client.post(
        f"/repos/{repo}/git/trees",
        json={"base_tree": base_sha, "tree": tree_items},
    )
    tree_resp.raise_for_status()
    tree_sha = tree_resp.json()["sha"]

    # 4. Create commit on the PR branch
    test_count = len(baselines)
    commit_message = f"triaige/update-baselines: update {test_count} baseline{'s' if test_count != 1 else ''}"

    commit_resp = client.post(
        f"/repos/{repo}/git/commits",
        json={
            "message": commit_message,
            "tree": tree_sha,
            "parents": [base_sha],
        },
    )
    commit_resp.raise_for_status()
    commit_sha = commit_resp.json()["sha"]

    # 5. Update the branch ref to point to the new commit
    ref_resp = client.patch(
        f"/repos/{repo}/git/refs/heads/{branch}",
        json={"sha": commit_sha},
    )
    ref_resp.raise_for_status()

    logger.info("Committed %d baseline(s) to %s @ %s: %s", test_count, branch, commit_sha[:8], [bl["path"] for bl in baselines])
    return commit_sha
