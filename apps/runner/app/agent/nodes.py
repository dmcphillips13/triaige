import json
import logging

from langchain_openai import ChatOpenAI

from app.agent.prompts import (
    CLASSIFY_SYSTEM_PROMPT,
    COMPOSE_SYSTEM_PROMPT,
    DEVIL_ADVOCATE_SYSTEM_PROMPT,
)
from app.agent.state import AgentState
from app.clients.openai_client import embed_texts
from app.retrieval import qdrant_store
from app.retrieval.service import RetrievedDocument
from app.settings import settings
from app.tools.github import fetch_pr_context
from app.tools.image_diff import compute_diff
from app.tools.vision import build_vision_messages

logger = logging.getLogger(__name__)


def _get_llm() -> ChatOpenAI:
    return ChatOpenAI(
        model=settings.openai_model,
        api_key=settings.openai_api_key,
        temperature=0,
        model_kwargs={"response_format": {"type": "json_object"}},
    )


def classify_query(state: AgentState) -> dict:
    """Extract intent, component, and failure signals from the question."""
    errors = list(state.get("errors", []))
    try:
        llm = _get_llm()
        question = state["question"]
        run_summary = state.get("run_summary")

        user_msg = question
        if run_summary:
            summary_data = run_summary.model_dump(
                exclude={"screenshot_baseline", "screenshot_actual"}
            )
            user_msg += f"\n\nRun summary: {json.dumps(summary_data)}"

        response = llm.invoke([
            {"role": "system", "content": CLASSIFY_SYSTEM_PROMPT},
            {"role": "user", "content": user_msg},
        ])
        data = json.loads(response.content)
        return {
            "intent": data.get("intent", "triage"),
            "component": data.get("component"),
            "failure_signals": data.get("failure_signals", []),
        }
    except Exception as e:
        logger.warning("classify_query failed: %s", e)
        errors.append(f"classify_query: {e}")
        return {
            "intent": "triage",
            "component": None,
            "failure_signals": [],
            "errors": errors,
        }


def fetch_pr_context_node(state: AgentState) -> dict:
    """Enrich PR context from GitHub API if repo and pr_number are available."""
    errors = list(state.get("errors", []))
    tool_calls = list(state.get("tool_calls", []))
    pr = state.get("pr_context")

    if not pr or not pr.repo or not pr.pr_number:
        return {}

    try:
        enriched = fetch_pr_context(pr.repo, pr.pr_number)
        tool_calls.append({
            "tool": "github.fetch_pr_context",
            "query": f"{pr.repo}#{pr.pr_number}",
            "used": True,
        })
        return {
            "enriched_pr_context": enriched,
            "tool_calls": tool_calls,
        }
    except Exception as e:
        logger.warning("fetch_pr_context_node failed: %s", e)
        errors.append(f"fetch_pr_context_node: {e}")
        tool_calls.append({
            "tool": "github.fetch_pr_context",
            "query": f"{pr.repo}#{pr.pr_number}",
            "used": False,
        })
        return {"errors": errors, "tool_calls": tool_calls}


def compute_image_diff_node(state: AgentState) -> dict:
    """Run pixel-level image diff when both screenshots are available."""
    errors = list(state.get("errors", []))
    tool_calls = list(state.get("tool_calls", []))
    run_summary = state.get("run_summary")

    baseline = run_summary.screenshot_baseline if run_summary else None
    actual = run_summary.screenshot_actual if run_summary else None

    if not baseline or not actual:
        return {}

    try:
        result = compute_diff(baseline, actual)
        tool_calls.append({
            "tool": "image_diff.compute_diff",
            "query": "baseline vs actual",
            "used": True,
        })
        return {"image_diff": result, "tool_calls": tool_calls}
    except Exception as e:
        logger.warning("compute_image_diff_node failed: %s", e)
        errors.append(f"compute_image_diff: {e}")
        tool_calls.append({
            "tool": "image_diff.compute_diff",
            "query": "baseline vs actual",
            "used": False,
        })
        return {"image_diff": None, "errors": errors, "tool_calls": tool_calls}


def analyze_screenshots(state: AgentState) -> dict:
    """Run GPT-4o vision analysis on baseline, actual, and diff overlay."""
    from app.clients.openai_client import get_openai_client

    errors = list(state.get("errors", []))
    tool_calls = list(state.get("tool_calls", []))
    run_summary = state.get("run_summary")

    baseline = run_summary.screenshot_baseline if run_summary else None
    actual = run_summary.screenshot_actual if run_summary else None
    image_diff = state.get("image_diff")
    overlay = image_diff.diff_overlay_base64 if image_diff else None

    if not baseline or not actual:
        return {}

    pr_context = state.get("enriched_pr_context") or state.get("pr_context")

    try:
        messages = build_vision_messages(baseline, actual, overlay, image_diff, pr_context)
        client = get_openai_client()
        response = client.chat.completions.create(
            model=settings.openai_vision_model,
            messages=messages,
            max_tokens=300,
            temperature=0,
        )
        summary = response.choices[0].message.content or ""
        tool_calls.append({
            "tool": "openai.vision",
            "query": f"analyze screenshots ({settings.openai_vision_model})",
            "used": True,
        })
        return {"vision_summary": summary.strip(), "tool_calls": tool_calls}
    except Exception as e:
        logger.warning("analyze_screenshots failed: %s", e)
        errors.append(f"analyze_screenshots: {e}")
        tool_calls.append({
            "tool": "openai.vision",
            "query": f"analyze screenshots ({settings.openai_vision_model})",
            "used": False,
        })
        return {"vision_summary": None, "errors": errors, "tool_calls": tool_calls}


def retrieve_semantic(state: AgentState) -> dict:
    """Embed query and search Qdrant for case/runbook/known_change docs."""
    errors = list(state.get("errors", []))
    try:
        question = state["question"]
        signals = state.get("failure_signals", [])
        query_text = question
        if signals:
            query_text += " " + " ".join(signals)

        vectors = embed_texts([query_text])
        query_vector = vectors[0]

        all_docs: list[RetrievedDocument] = []
        for doc_type in ("case", "runbook", "known_change"):
            try:
                docs = qdrant_store.search(
                    query_vector=query_vector,
                    top_k=5,
                    doc_type=doc_type,
                )
                all_docs.extend(docs)
            except Exception as e:
                logger.warning("Qdrant search for %s failed: %s", doc_type, e)
                errors.append(f"retrieve_semantic({doc_type}): {e}")

        # Merge and take top 5 by score
        all_docs.sort(key=lambda d: d.score, reverse=True)
        top_docs = all_docs[:5]

        result: dict = {
            "semantic_docs": top_docs,
            "_query_vector": query_vector,
        }
        if errors:
            result["errors"] = errors
        return result
    except Exception as e:
        logger.warning("retrieve_semantic failed: %s", e)
        errors.append(f"retrieve_semantic: {e}")
        return {
            "semantic_docs": [],
            "_query_vector": [],
            "errors": errors,
        }


def retrieve_episodes(state: AgentState) -> dict:
    """Search Qdrant for episode docs using the pre-computed query vector."""
    errors = list(state.get("errors", []))
    query_vector = state.get("_query_vector", [])

    if not query_vector:
        return {"episode_docs": []}

    try:
        docs = qdrant_store.search(
            query_vector=query_vector,
            top_k=3,
            doc_type="episode",
        )
        return {"episode_docs": docs}
    except Exception as e:
        logger.warning("retrieve_episodes failed: %s", e)
        errors.append(f"retrieve_episodes: {e}")
        return {"episode_docs": [], "errors": errors}


def compose_answer(state: AgentState) -> dict:
    """Two-pass classification: devil's advocate review then final judgement."""
    errors = list(state.get("errors", []))
    try:
        llm = _get_llm()

        # Build user message (shared by both passes)
        pr = state.get("enriched_pr_context") or state.get("pr_context")
        user_parts = [f"Question: {state['question']}"]
        if pr:
            user_parts.append(f"PR context: {pr.model_dump_json(exclude={'diff'})}")
            if pr.diff:
                diff_text = pr.diff[:5000].rsplit("\n", 1)[0]
                if len(pr.diff) > 5000:
                    diff_text += "\n... (truncated)"
                user_parts.append(f"GIT DIFF (actual code changes in this PR):\n{diff_text}")

        run_summary = state.get("run_summary")
        if run_summary:
            summary_data = run_summary.model_dump(
                exclude={"screenshot_baseline", "screenshot_actual"}
            )
            user_parts.append(f"Run summary: {json.dumps(summary_data)}")

        vision_summary = state.get("vision_summary")
        if vision_summary:
            user_parts.append(f"Vision analysis of screenshots: {vision_summary}")

        image_diff = state.get("image_diff")
        if image_diff and image_diff.changed_regions:
            user_parts.append(
                f"PIXEL DIFF REGIONS (where pixels actually changed): {', '.join(image_diff.changed_regions)}"
            )

        user_msg = "\n\n".join(user_parts)

        # --- Pass 1: Scope & defect review ---
        # Give the reviewer the vision analysis, PR title, and PR description
        # so it can assess whether this page is in the PR's stated scope.
        devil_parts = [f"Test: {state['question']}"]
        if pr and pr.title:
            devil_parts.append(f"PR title: {pr.title}")
        if pr and pr.description:
            devil_parts.append(f"PR description: {pr.description}")
        else:
            devil_parts.append("PR description: (none provided)")
        if pr and pr.diff:
            diff_text = pr.diff[:3000].rsplit("\n", 1)[0]
            if len(pr.diff) > 3000:
                diff_text += "\n... (truncated)"
            devil_parts.append(f"GIT DIFF (actual code changes):\n{diff_text}")
        if vision_summary:
            devil_parts.append(f"Vision analysis of screenshots: {vision_summary}")

        if image_diff and image_diff.changed_regions:
            devil_parts.append(
                f"PIXEL DIFF REGIONS (where pixels actually changed): {', '.join(image_diff.changed_regions)}"
            )

        devil_response = llm.invoke([
            {"role": "system", "content": DEVIL_ADVOCATE_SYSTEM_PROMPT},
            {"role": "user", "content": "\n\n".join(devil_parts)},
        ])
        devil_review = devil_response.content
        logger.info("Devil's advocate review: %s", devil_review)

        # --- Pass 2: Final classification with both perspectives ---
        semantic_docs = state.get("semantic_docs", [])
        if semantic_docs:
            context_lines = []
            for doc in semantic_docs:
                context_lines.append(
                    f"[{doc.doc_type}] {doc.heading} (score={doc.score:.2f}):\n{doc.text}"
                )
            context_blocks = "\n\n".join(context_lines)
        else:
            context_blocks = "(No relevant documents found)"

        episode_docs = state.get("episode_docs", [])
        if episode_docs:
            episode_lines = []
            for doc in episode_docs:
                episode_lines.append(
                    f"[episode] {doc.heading} (score={doc.score:.2f}):\n{doc.text}"
                )
            episode_blocks = "\n\n".join(episode_lines)
        else:
            episode_blocks = "(No past episodes found)"

        system_prompt = COMPOSE_SYSTEM_PROMPT.format(
            context_blocks=context_blocks,
            episode_blocks=episode_blocks,
        )

        # Append devil's advocate review to user message
        final_user_msg = (
            user_msg
            + f"\n\nDevil's advocate QA review: {devil_review}"
        )

        response = llm.invoke([
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": final_user_msg},
        ])
        data = json.loads(response.content)
        return {
            "classification": data.get("classification", "uncertain"),
            "confidence": float(data.get("confidence", 0.0)),
            "rationale": data.get("rationale", "No rationale provided."),
        }
    except Exception as e:
        logger.warning("compose_answer failed: %s", e, exc_info=True)
        errors.append(f"compose_answer: {e}")
        return {
            "classification": "uncertain",
            "confidence": 0.0,
            "rationale": "Failed to generate classification.",
            "errors": errors,
        }
