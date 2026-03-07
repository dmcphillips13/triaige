from langgraph.graph import END, StateGraph

from app.agent.format import build_response
from app.agent.nodes import (
    classify_query,
    compose_answer,
    compute_image_diff_node,
    fetch_pr_context_node,
    retrieve_episodes,
    retrieve_semantic,
)
from app.agent.state import AgentState
from app.schemas import AskRequest, AskResponse


def _has_screenshots(state: AgentState) -> str:
    rs = state.get("run_summary")
    if rs and rs.screenshot_baseline and rs.screenshot_actual:
        return "compute_diff"
    return "skip_diff"


def _has_pr_info(state: AgentState) -> str:
    pr = state.get("pr_context")
    if pr and pr.repo and pr.pr_number:
        return "fetch_pr"
    return "skip_pr"


def _build_graph() -> StateGraph:
    graph = StateGraph(AgentState)

    graph.add_node("classify_query", classify_query)
    graph.add_node("fetch_pr_context", fetch_pr_context_node)
    graph.add_node("retrieve_semantic", retrieve_semantic)
    graph.add_node("retrieve_episodes", retrieve_episodes)
    graph.add_node("compute_image_diff", compute_image_diff_node)
    graph.add_node("compose_answer", compose_answer)

    graph.set_entry_point("classify_query")

    graph.add_conditional_edges(
        "classify_query",
        _has_pr_info,
        {
            "fetch_pr": "fetch_pr_context",
            "skip_pr": "retrieve_semantic",
        },
    )
    graph.add_edge("fetch_pr_context", "retrieve_semantic")
    graph.add_edge("retrieve_semantic", "retrieve_episodes")
    graph.add_conditional_edges(
        "retrieve_episodes",
        _has_screenshots,
        {
            "compute_diff": "compute_image_diff",
            "skip_diff": "compose_answer",
        },
    )
    graph.add_edge("compute_image_diff", "compose_answer")
    graph.add_edge("compose_answer", END)

    return graph


compiled_graph = _build_graph().compile()


def run_graph(request: AskRequest) -> AskResponse:
    initial_state: AgentState = {
        "question": request.question,
        "run_summary": request.run_summary,
        "pr_context": request.pr_context,
        "errors": [],
        "tool_calls": [],
    }

    final_state = compiled_graph.invoke(initial_state)
    return build_response(final_state)
