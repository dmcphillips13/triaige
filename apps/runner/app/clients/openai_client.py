"""OpenAI API client for embeddings and vision.

All user-facing calls require a BYOK key set in request context via
contextvars. The project owner's global key is never used for user requests.
Admin scripts (e.g. index_corpus.py) must set the contextvar explicitly
from their own environment before calling any functions in this module.
"""

from openai import OpenAI

from app.request_context import openai_api_key_var
from app.settings import settings


def get_openai_client() -> OpenAI:
    """Return an OpenAI client using the BYOK key from request context.

    Raises RuntimeError if no BYOK key is set. This ensures user requests
    never silently fall back to the project owner's global API key.
    Admin scripts (e.g. index_corpus.py) must set the contextvar explicitly.
    """
    byok_key = openai_api_key_var.get()
    if not byok_key:
        raise RuntimeError(
            "OpenAI API key required. Set it in dashboard settings or pass X-OpenAI-Key header."
        )
    return OpenAI(api_key=byok_key)


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
