from app.agent.state import AgentState
from app.schemas import (
    AskResponse,
    Citation,
    DebugInfo,
    RecommendedAction,
    ToolCall,
)

_ACTION_MAP = {
    "expected": "update_baseline",
    "unexpected": "open_bug",
    "uncertain": "request_human_review",
}


def build_response(state: AgentState) -> AskResponse:
    classification = state.get("classification", "uncertain")
    action_type = _ACTION_MAP.get(classification, "request_human_review")

    # Build citations from semantic + episode docs
    citations = []
    seen_ids: set[str] = set()
    for doc in [*state.get("semantic_docs", []), *state.get("episode_docs", [])]:
        if doc.doc_id not in seen_ids:
            seen_ids.add(doc.doc_id)
            citations.append(Citation(
                doc_id=doc.doc_id,
                snippet=doc.text[:300],
                source="qdrant",
            ))

    # Build tool_calls
    tool_calls = [
        ToolCall(tool=tc["tool"], query=tc["query"], used=tc["used"])
        for tc in state.get("tool_calls", [])
    ]

    return AskResponse(
        classification=classification,
        confidence=state.get("confidence", 0.0),
        rationale=state.get("rationale", "No rationale available."),
        citations=citations,
        recommended_action=RecommendedAction(
            type=action_type,
            executed=False,
            url=None,
        ),
        tool_calls=tool_calls,
        image_diff=state.get("image_diff"),
        vision_summary=None,
        debug=DebugInfo(
            intent=state.get("intent", "triage"),
            errors=state.get("errors", []),
        ),
    )
