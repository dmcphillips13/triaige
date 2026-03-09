"""In-memory repo settings persistence.

Stores per-repo triage mode settings (pre_merge / post_merge checkboxes).
Data is lost on restart — acceptable until Postgres is added (Step 19).
"""

from __future__ import annotations

from pydantic import BaseModel


class RepoSettings(BaseModel):
    pre_merge: bool = False
    post_merge: bool = True


_settings: dict[str, RepoSettings] = {}


def get_settings(repo: str) -> RepoSettings:
    """Return settings for a repo, or defaults if not configured."""
    return _settings.get(repo, RepoSettings())


def put_settings(repo: str, s: RepoSettings) -> RepoSettings:
    """Store settings for a repo."""
    _settings[repo] = s
    return s
