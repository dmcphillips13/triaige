"""Validate an OpenAI API key before storing it.

Hits the /v1/models endpoint to confirm the key is valid and has
access to the OpenAI API. Does not log or store the key.
"""

import httpx


async def validate_openai_key(api_key: str) -> bool:
    """Return True if the key authenticates successfully against OpenAI."""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://api.openai.com/v1/models",
                headers={"Authorization": f"Bearer {api_key}"},
                timeout=10,
            )
            return resp.status_code == 200
    except httpx.HTTPError:
        return False
