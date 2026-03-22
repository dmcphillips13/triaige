"""Index the triage memory corpus into Qdrant.

Usage:
    cd apps/runner && uv run python scripts/index_corpus.py

Requires OPENAI_API_KEY in the environment (admin script, not user-facing).
"""

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# Set the contextvar before importing any app modules that use it.
# get_openai_client() requires a BYOK key in context — admin scripts
# provide it from the environment.
from app.request_context import openai_api_key_var

_admin_key = os.environ.get("OPENAI_API_KEY")
if not _admin_key:
    print("Error: OPENAI_API_KEY environment variable is required")
    sys.exit(1)
openai_api_key_var.set(_admin_key)

from qdrant_client.models import PointStruct

from app.clients.openai_client import embed_texts
from app.pipeline.data_loader import load_corpus
from app.retrieval.qdrant_store import ensure_collection, make_point_id, upsert_points

BATCH_SIZE = 100


def main() -> None:
    data_dir = Path(__file__).resolve().parent.parent / "data"
    print(f"Loading corpus from {data_dir}")
    chunks = load_corpus(data_dir)
    print(f"Loaded {len(chunks)} chunks from {len(set(c.doc_id for c in chunks))} docs")

    ensure_collection()
    print("Collection ready")

    points: list[PointStruct] = []
    for i in range(0, len(chunks), BATCH_SIZE):
        batch = chunks[i : i + BATCH_SIZE]
        texts = [f"{c.heading}\n\n{c.text}" for c in batch]
        vectors = embed_texts(texts)
        for chunk, vector in zip(batch, vectors):
            points.append(
                PointStruct(
                    id=make_point_id(chunk.doc_id, chunk.chunk_index),
                    vector=vector,
                    payload={
                        "doc_id": chunk.doc_id,
                        "doc_type": chunk.doc_type,
                        "component": chunk.component,
                        "date": chunk.date,
                        "tags": chunk.tags,
                        "heading": chunk.heading,
                        "text": chunk.text,
                        "chunk_index": chunk.chunk_index,
                    },
                )
            )
        print(f"Embedded {min(i + BATCH_SIZE, len(chunks))}/{len(chunks)} chunks")

    upsert_points(points)
    print(f"Upserted {len(points)} points to Qdrant")


if __name__ == "__main__":
    main()
