"""Postgres-backed per-repo triage mode settings and API keys.

Stores pre_merge / post_merge / merge_gate toggles, per-repo API keys,
and encrypted user-provided OpenAI API keys (BYOK) in the repo_settings table.
"""

from __future__ import annotations

import logging
import secrets

from pydantic import BaseModel

from app.db import get_pool
from app.settings import settings

logger = logging.getLogger(__name__)


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


def generate_api_key() -> str:
    """Generate a cryptographically random API key."""
    return f"tr_{secrets.token_urlsafe(32)}"


async def get_or_create_api_key(repo: str) -> str:
    """Return the API key for a repo, generating one if it doesn't exist."""
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT api_key FROM repo_settings WHERE repo = $1", repo
        )
        if row and row["api_key"]:
            return row["api_key"]

        # Generate a new key and upsert — explicitly set boolean columns
        # to avoid relying on DB defaults (which may not match schema.sql)
        key = generate_api_key()
        await conn.execute(
            """INSERT INTO repo_settings (repo, api_key, pre_merge, post_merge, merge_gate)
               VALUES ($1, $2, TRUE, TRUE, TRUE)
               ON CONFLICT (repo)
               DO UPDATE SET api_key = $2""",
            repo, key,
        )
        return key


async def validate_repo_api_key(api_key: str) -> str | None:
    """Check if an API key matches any repo. Returns the repo name or None."""
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT repo FROM repo_settings WHERE api_key = $1", api_key
        )
        return row["repo"] if row else None


# --- BYOK OpenAI key management ---


def _require_encryption_key() -> str:
    """Return the BYOK encryption key or raise if not configured."""
    if not settings.byok_encryption_key:
        raise RuntimeError(
            "BYOK_ENCRYPTION_KEY env var is not set — cannot encrypt/decrypt OpenAI keys"
        )
    return settings.byok_encryption_key


def mask_key(key: str) -> str:
    """Mask an API key for display: sk-...xxxx."""
    if len(key) <= 7:
        return "sk-...****"
    return f"{key[:3]}...{key[-4:]}"


async def store_openai_key(repo: str, plaintext_key: str) -> None:
    """Encrypt and store a user-provided OpenAI API key for a repo."""
    enc_key = _require_encryption_key()
    pool = get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """INSERT INTO repo_settings (repo, openai_api_key_encrypted)
               VALUES ($1, pgp_sym_encrypt($2, $3))
               ON CONFLICT (repo)
               DO UPDATE SET openai_api_key_encrypted = pgp_sym_encrypt($2, $3)""",
            repo, plaintext_key, enc_key,
        )
    logger.info("Stored encrypted OpenAI key for %s", repo)


async def get_openai_key(repo: str) -> str | None:
    """Decrypt and return the stored OpenAI API key for a repo, or None."""
    enc_key = _require_encryption_key()
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """SELECT pgp_sym_decrypt(openai_api_key_encrypted, $2) AS key
               FROM repo_settings
               WHERE repo = $1 AND openai_api_key_encrypted IS NOT NULL""",
            repo, enc_key,
        )
    if not row:
        return None
    return row["key"]


async def delete_openai_key(repo: str) -> None:
    """Remove the stored OpenAI API key for a repo."""
    pool = get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE repo_settings SET openai_api_key_encrypted = NULL WHERE repo = $1",
            repo,
        )
    logger.info("Deleted OpenAI key for %s", repo)
