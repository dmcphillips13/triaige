"""OpenAI API client for embeddings and vision.

Uses a lazy singleton for the project key (shared embeddings infrastructure).
For BYOK requests, returns a per-request client using the user's key from
contextvars — the key is never included in prompts or model inputs, only in
the Authorization header to OpenAI's API.
"""

from openai import OpenAI

from app.request_context import openai_api_key_var
from app.settings import settings

_client: OpenAI | None = None


def get_openai_client() -> OpenAI:
    """Return an OpenAI client, using the BYOK key if set."""
    byok_key = openai_api_key_var.get()
    if byok_key:
        return OpenAI(api_key=byok_key)

    global _client
    if _client is None:
        _client = OpenAI(api_key=settings.openai_api_key)
    return _client


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed a list of texts, returning vectors in the same order."""
    client = get_openai_client()
    response = client.embeddings.create(
        model=settings.openai_embeddings_model,
        input=texts,
        dimensions=settings.openai_embeddings_dimensions,
    )
    # OpenAI may return embeddings out of order; sort by index to match input
    sorted_data = sorted(response.data, key=lambda x: x.index)
    return [item.embedding for item in sorted_data]
