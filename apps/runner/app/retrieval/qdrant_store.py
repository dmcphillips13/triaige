"""Qdrant vector database wrapper for upserting and searching chunks.

Provides collection management, deterministic point IDs (uuid5 for
idempotent re-indexing), batch upsert, and filtered dense search.
Qdrant Cloud requires explicit payload indexes for filtered queries,
which ensure_collection creates automatically.
"""

import uuid

from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    FieldCondition,
    Filter,
    MatchValue,
    PayloadSchemaType,
    PointStruct,
    VectorParams,
)

from app.retrieval.service import RetrievedDocument
from app.settings import settings

_client: QdrantClient | None = None


def get_qdrant_client() -> QdrantClient:
    global _client
    if _client is None:
        _client = QdrantClient(
            url=settings.qdrant_url,
            api_key=settings.qdrant_api_key,
        )
    return _client


def ensure_collection(collection: str | None = None) -> None:
    """Create the collection if it doesn't exist, and ensure payload indexes."""
    collection = collection or settings.qdrant_collection
    client = get_qdrant_client()
    if not client.collection_exists(collection):
        client.create_collection(
            collection_name=collection,
            vectors_config=VectorParams(
                size=settings.openai_embeddings_dimensions,
                distance=Distance.COSINE,
            ),
        )
    # Ensure payload indexes exist for filtered search
    for field in ("doc_type", "component"):
        client.create_payload_index(
            collection_name=collection,
            field_name=field,
            field_schema=PayloadSchemaType.KEYWORD,
        )


def make_point_id(doc_id: str, chunk_index: int) -> str:
    """Deterministic UUID so re-running the indexer upserts in place."""
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"{doc_id}::{chunk_index}"))


def upsert_points(
    points: list[PointStruct],
    collection: str | None = None,
    batch_size: int = 100,
) -> None:
    collection = collection or settings.qdrant_collection
    client = get_qdrant_client()
    for i in range(0, len(points), batch_size):
        batch = points[i : i + batch_size]
        client.upsert(collection_name=collection, points=batch)


def search(
    query_vector: list[float],
    top_k: int = 5,
    doc_type: str | None = None,
    component: str | None = None,
    collection: str | None = None,
) -> list[RetrievedDocument]:
    """Dense cosine search with optional doc_type/component filters."""
    collection = collection or settings.qdrant_collection
    client = get_qdrant_client()

    conditions = []
    if doc_type:
        conditions.append(FieldCondition(key="doc_type", match=MatchValue(value=doc_type)))
    if component:
        conditions.append(FieldCondition(key="component", match=MatchValue(value=component)))
    query_filter = Filter(must=conditions) if conditions else None

    results = client.query_points(
        collection_name=collection,
        query=query_vector,
        query_filter=query_filter,
        limit=top_k,
    ).points

    return [
        RetrievedDocument(
            doc_id=pt.payload["doc_id"],
            doc_type=pt.payload["doc_type"],
            component=pt.payload["component"],
            heading=pt.payload["heading"],
            text=pt.payload["text"],
            score=pt.score,
            date=pt.payload.get("date", ""),
            tags=pt.payload.get("tags", []),
            chunk_index=pt.payload.get("chunk_index", 0),
        )
        for pt in results
    ]
