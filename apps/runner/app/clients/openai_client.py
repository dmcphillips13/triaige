"""OpenAI API client for embeddings (and later, vision).

Uses a lazy singleton so the client is only created when first needed.
Model and dimension settings come from app.settings.
"""

from openai import OpenAI

from app.settings import settings

_client: OpenAI | None = None


def get_openai_client() -> OpenAI:
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
