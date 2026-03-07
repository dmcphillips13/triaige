from typing import TypedDict

from app.retrieval.service import RetrievedDocument
from app.schemas import ImageDiff, PRContext, RunSummary


class AgentState(TypedDict, total=False):
    # Input
    question: str
    run_summary: RunSummary | None
    pr_context: PRContext | None

    # classify_query output
    intent: str
    component: str | None
    failure_signals: list[str]

    # fetch_pr_context output
    enriched_pr_context: PRContext | None

    # compute_image_diff output
    image_diff: ImageDiff | None

    # Retrieval output
    semantic_docs: list[RetrievedDocument]
    episode_docs: list[RetrievedDocument]
    _query_vector: list[float]

    # compose_answer output
    classification: str
    confidence: float
    rationale: str

    # Observability
    errors: list[str]
    tool_calls: list[dict]
