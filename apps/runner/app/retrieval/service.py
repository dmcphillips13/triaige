"""Data types returned by the retrieval layer."""

from dataclasses import dataclass, field


@dataclass
class RetrievedDocument:
    """A single chunk returned from Qdrant search.

    Maps to the Citation schema (doc_id -> doc_id, text -> snippet,
    source is always "qdrant") when building API responses.
    """

    doc_id: str  # e.g. "cases/CASE-003.md"
    doc_type: str  # "case" | "runbook" | "known_change" | "episode"
    component: str
    heading: str  # the ## section heading
    text: str  # chunk body text (used as citation snippet)
    score: float  # cosine similarity score from Qdrant
    date: str = ""
    tags: list[str] = field(default_factory=list)
    chunk_index: int = 0
