"""Postgres-backed per-repo triage mode settings.

Stores pre_merge / post_merge / merge_gate toggles in the repo_settings table.
"""

from __future__ import annotations

import json

from pydantic import BaseModel

from app.db import get_pool


class RepoSettings(BaseModel):
    pre_merge: bool = True
    post_merge: bool = True
    merge_gate: bool = True


async def get_settings(repo: str) -> RepoSettings:
    """Return settings for a repo, or defaults if not configured."""
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT pre_merge, post_merge, merge_gate FROM repo_settings WHERE repo = $1", repo
        )
    if not row:
        return RepoSettings()
    return RepoSettings(
        pre_merge=row["pre_merge"],
        post_merge=row["post_merge"],
        merge_gate=row["merge_gate"],
    )


async def put_settings(repo: str, s: RepoSettings) -> RepoSettings:
    """Store settings for a repo (upsert)."""
    pool = get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """INSERT INTO repo_settings (repo, pre_merge, post_merge, merge_gate)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT (repo)
               DO UPDATE SET pre_merge = $2, post_merge = $3, merge_gate = $4""",
            repo, s.pre_merge, s.post_merge, s.merge_gate,
        )
    return s
