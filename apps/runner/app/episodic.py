"""Episodic memory: store human feedback as episodes in Qdrant.

When a human approves or rejects a triage classification, we build a
natural-language episode summary, embed it, and upsert it into Qdrant
with doc_type="episode". The retrieve_episodes node (already in the
agent graph) picks these up as few-shot examples for future classifications.

This is the CoALA episodic memory pattern: the agent learns from past
human decisions without any fine-tuning or prompt engineering changes.

Episode text format (embedded for similarity search):
  "{test_name}: {diff_ratio}% diff. Classified as {classification}
   ({confidence}). Human {verdict}. Rationale: {rationale}"

The text is designed so that similarity search matches on failure context
(test name, diff ratio, failure type) rather than on the verdict itself.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from qdrant_client.models import PointStruct

from app.clients.openai_client import embed_texts
from app.retrieval.qdrant_store import upsert_points
from app.schemas import TriageFailureResult


def store_episode(
    result: TriageFailureResult,
    verdict: str,
    run_id: str,
) -> str:
    """Build an episode from a triage result + human verdict, embed, and upsert.

    Returns the point ID of the stored episode.
    """
    res = result.ask_response
    diff_info = ""
    if res.image_diff:
        diff_info = f" {res.image_diff.diff_ratio * 100:.1f}% diff."

    text = (
        f"{result.test_name}:{diff_info} "
        f"Classified as {res.classification} ({res.confidence:.0%}). "
        f"Human {verdict}. "
        f"Rationale: {res.rationale}"
    )

    situation = f"{result.test_name} failed"
    if diff_info:
        situation += f" with{diff_info}"

    # Extract component from test name (first segment before " > ")
    component = result.test_name.split(" > ")[0].replace(".spec.ts", "").strip()

    doc_id = f"episodes/{run_id}::{result.test_name}"
    point_id = str(uuid.uuid5(uuid.NAMESPACE_URL, doc_id))

    payload = {
        "doc_id": doc_id,
        "doc_type": "episode",
        "component": component,
        "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "tags": [res.classification, verdict],
        "heading": f"{result.test_name} — {verdict}",
        "text": text,
        "situation": situation,
        "classification": res.classification,
        "confidence": res.confidence,
        "human_feedback": verdict,
        "original_rationale": res.rationale,
        "chunk_index": 0,
    }

    vector = embed_texts([text])[0]

    point = PointStruct(id=point_id, vector=vector, payload=payload)
    upsert_points([point])

    return point_id
