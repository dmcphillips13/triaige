"""Failure grouping for batch triage.

Groups test failures by component + failure pattern so related failures
can be classified together in a single LLM call. This reduces cost and
latency, and produces more coherent results for related failures.

Grouping is deterministic (no LLM calls). Component is extracted from
the test name, failure pattern from the failure_type + error message.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from app.schemas import AskRequest, RunSummary


@dataclass
class FailureGroup:
    """A cluster of failures sharing the same component and failure pattern."""

    component: str
    failure_pattern: str
    requests: list[AskRequest] = field(default_factory=list)
    test_names: list[str] = field(default_factory=list)


def group_failures(ask_requests: list[AskRequest]) -> list[FailureGroup]:
    """Group failures by (component, failure_pattern) key."""
    groups: dict[tuple[str, str], FailureGroup] = {}

    for req in ask_requests:
        key = _extract_group_key(req)
        test_name = extract_test_name(req)

        if key not in groups:
            groups[key] = FailureGroup(component=key[0], failure_pattern=key[1])
        groups[key].requests.append(req)
        groups[key].test_names.append(test_name)

    return list(groups.values())


def build_group_request(group: FailureGroup) -> AskRequest:
    """Build a single representative AskRequest for a group of related failures."""
    names_list = ", ".join(f"'{n}'" for n in group.test_names)
    question = (
        f"Multiple tests failed with the same pattern in component "
        f"'{group.component}': {names_list}. "
        f"All failures show {group.failure_pattern}."
    )

    # Use run_summary from the first failure that has one (prefer one with screenshots)
    representative_summary = None
    for req in group.requests:
        if req.run_summary:
            if req.run_summary.screenshot_baseline or req.run_summary.screenshot_actual:
                representative_summary = req.run_summary
                break
            if representative_summary is None:
                representative_summary = req.run_summary

    # Use pr_context from the first failure that has one
    representative_pr = None
    for req in group.requests:
        if req.pr_context:
            representative_pr = req.pr_context
            break

    return AskRequest(
        question=question,
        run_summary=representative_summary,
        pr_context=representative_pr,
    )


def extract_test_name(req: AskRequest) -> str:
    """Get the test name from an AskRequest, falling back to the question text."""
    if req.run_summary and req.run_summary.test_name:
        return req.run_summary.test_name
    return req.question[:80]


def _extract_group_key(req: AskRequest) -> tuple[str, str]:
    """Derive a (component, failure_pattern) key from request data."""
    component = _extract_component(req.run_summary)
    pattern = _extract_failure_pattern(req.run_summary)
    return (component, pattern)


def _extract_component(summary: RunSummary | None) -> str:
    """Extract component name from test name by taking the first segment."""
    if not summary or not summary.test_name:
        return "unknown"

    # Split on " > " (Playwright suite > spec naming) and take first segment
    parts = summary.test_name.split(" > ")
    if len(parts) >= 2:
        # First part is usually the file/suite, second is the component area
        return parts[0].strip().lower()

    # No separator — use the whole name, stripped of file extensions
    name = re.sub(r"\.\w+$", "", parts[0]).strip().lower()
    return name or "unknown"


def _extract_failure_pattern(summary: RunSummary | None) -> str:
    """Extract a stable failure pattern from failure_type + error message."""
    if not summary:
        return "unknown"

    failure_type = summary.failure_type or "unknown"

    # For visual diffs, the type alone is the pattern
    if failure_type == "visual_diff":
        return "visual_diff"

    # For errors, normalize the first error message into a stable signature
    notes = summary.playwright_notes or []
    if notes:
        return f"{failure_type}:{_normalize_error(notes[0])}"

    return failure_type


def _normalize_error(error: str) -> str:
    """Strip variable parts from error messages to produce a stable pattern."""
    # Remove line/column numbers
    normalized = re.sub(r":\d+:\d+", "", error)
    # Remove hex colors
    normalized = re.sub(r"#[0-9a-fA-F]{3,8}", "#HEX", normalized)
    # Remove pixel values
    normalized = re.sub(r"\d+px", "Npx", normalized)
    # Remove specific numbers
    normalized = re.sub(r"\b\d+\b", "N", normalized)
    # Truncate
    return normalized[:100].strip()
