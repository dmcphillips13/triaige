"""GitHub REST API client for fetching PR context.

Provides a single public entry point, fetch_pr_context(), that returns a
PRContext populated with title, changed files, commit messages, and diff.
Works without a token (60 req/hr) but uses one when available (5000 req/hr).
"""

import logging

import httpx

from app.schemas import PRContext
from app.settings import settings

logger = logging.getLogger(__name__)

_DIFF_MAX_CHARS = 10_000

_client: httpx.Client | None = None


def _get_client() -> httpx.Client:
    global _client
    if _client is None:
        headers = {"Accept": "application/vnd.github+json"}
        if settings.github_token:
            headers["Authorization"] = f"Bearer {settings.github_token}"
        _client = httpx.Client(
            base_url="https://api.github.com",
            headers=headers,
            timeout=10.0,
        )
    return _client


def _fetch_pr(owner: str, repo: str, pr_number: int) -> dict | None:
    try:
        r = _get_client().get(f"/repos/{owner}/{repo}/pulls/{pr_number}")
        r.raise_for_status()
        return r.json()
    except httpx.HTTPError:
        logger.warning("Failed to fetch PR %s/%s#%d", owner, repo, pr_number)
        return None


def _fetch_changed_files(owner: str, repo: str, pr_number: int) -> list[str] | None:
    try:
        r = _get_client().get(
            f"/repos/{owner}/{repo}/pulls/{pr_number}/files",
            params={"per_page": 100},
        )
        r.raise_for_status()
        return [f["filename"] for f in r.json()]
    except httpx.HTTPError:
        logger.warning("Failed to fetch files for %s/%s#%d", owner, repo, pr_number)
        return None


def _fetch_commits(owner: str, repo: str, pr_number: int) -> list[str] | None:
    try:
        r = _get_client().get(
            f"/repos/{owner}/{repo}/pulls/{pr_number}/commits",
            params={"per_page": 100},
        )
        r.raise_for_status()
        return [c["commit"]["message"] for c in r.json()]
    except httpx.HTTPError:
        logger.warning("Failed to fetch commits for %s/%s#%d", owner, repo, pr_number)
        return None


def _fetch_diff(owner: str, repo: str, pr_number: int) -> str | None:
    try:
        r = _get_client().get(
            f"/repos/{owner}/{repo}/pulls/{pr_number}",
            headers={"Accept": "application/vnd.github.v3.diff"},
        )
        r.raise_for_status()
        diff = r.text
        return diff[:_DIFF_MAX_CHARS] if len(diff) > _DIFF_MAX_CHARS else diff
    except httpx.HTTPError:
        logger.warning("Failed to fetch diff for %s/%s#%d", owner, repo, pr_number)
        return None


def fetch_pr_context(repo: str, pr_number: int) -> PRContext:
    """Fetch PR context from GitHub.

    Args:
        repo: Repository in "owner/repo" format.
        pr_number: Pull request number.

    Returns:
        PRContext populated with whatever data succeeded.
    """
    owner, repo_name = repo.split("/", 1)

    pr_data = _fetch_pr(owner, repo_name, pr_number)
    title = pr_data.get("title") if pr_data else None
    description = pr_data.get("body") if pr_data else None

    changed_files = _fetch_changed_files(owner, repo_name, pr_number)
    commit_messages = _fetch_commits(owner, repo_name, pr_number)
    diff = _fetch_diff(owner, repo_name, pr_number)

    return PRContext(
        title=title,
        description=description,
        changed_files=changed_files,
        commit_messages=commit_messages,
        diff=diff,
        repo=repo,
        pr_number=pr_number,
    )
