"""Tests for failure grouping logic."""

from app.grouping import (
    _extract_component,
    _extract_failure_pattern,
    _normalize_error,
    build_group_request,
    extract_test_name,
    group_failures,
)
from app.schemas import AskRequest, PRContext, RunSummary


def _make_request(
    test_name: str = "suite > spec",
    failure_type: str = "visual_diff",
    question: str = "Test failed",
    playwright_notes: list[str] | None = None,
    screenshot_baseline: str | None = None,
    screenshot_actual: str | None = None,
    pr_context: PRContext | None = None,
) -> AskRequest:
    return AskRequest(
        question=question,
        run_summary=RunSummary(
            test_name=test_name,
            failure_type=failure_type,
            playwright_notes=playwright_notes,
            screenshot_baseline=screenshot_baseline,
            screenshot_actual=screenshot_actual,
        ),
        pr_context=pr_context,
    )


# --- extract_test_name ---


def test_extract_test_name_from_summary():
    req = _make_request(test_name="login > shows error")
    assert extract_test_name(req) == "login > shows error"


def test_extract_test_name_falls_back_to_question():
    req = AskRequest(question="A very long question about a test failure")
    assert extract_test_name(req) == "A very long question about a test failure"


def test_extract_test_name_truncates_long_question():
    req = AskRequest(question="x" * 200)
    assert len(extract_test_name(req)) == 80


# --- _extract_component ---


def test_extract_component_with_separator():
    summary = RunSummary(test_name="header.spec.ts > Navigation > shows logo")
    assert _extract_component(summary) == "header.spec.ts"


def test_extract_component_no_separator():
    summary = RunSummary(test_name="checkout-flow.spec.ts")
    assert _extract_component(summary) == "checkout-flow.spec"


def test_extract_component_none():
    assert _extract_component(None) == "unknown"


def test_extract_component_empty_name():
    summary = RunSummary(test_name="")
    assert _extract_component(summary) == "unknown"


# --- _extract_failure_pattern ---


def test_failure_pattern_visual_diff():
    summary = RunSummary(failure_type="visual_diff")
    assert _extract_failure_pattern(summary) == "visual_diff"


def test_failure_pattern_error_with_notes():
    summary = RunSummary(
        failure_type="error",
        playwright_notes=["Timeout waiting for selector .btn"],
    )
    assert _extract_failure_pattern(summary) == "error:Timeout waiting for selector .btn"


def test_failure_pattern_error_no_notes():
    summary = RunSummary(failure_type="error")
    assert _extract_failure_pattern(summary) == "error"


def test_failure_pattern_none():
    assert _extract_failure_pattern(None) == "unknown"


# --- _normalize_error ---


def test_normalize_strips_line_numbers():
    assert "file" in _normalize_error("file:42:10 threw error")
    assert ":42:10" not in _normalize_error("file:42:10 threw error")


def test_normalize_replaces_hex_colors():
    assert "#HEX" in _normalize_error("expected color #ff00aa but got #00ff00")


def test_normalize_replaces_pixel_values():
    assert "Npx" in _normalize_error("expected width 200px")


def test_normalize_replaces_numbers():
    assert "N" in _normalize_error("expected 42 items")


def test_normalize_truncates_long_errors():
    result = _normalize_error("x" * 200)
    assert len(result) <= 100


# --- group_failures ---


def test_group_failures_empty():
    assert group_failures([]) == []


def test_group_failures_single():
    groups = group_failures([_make_request()])
    assert len(groups) == 1
    assert len(groups[0].requests) == 1


def test_group_failures_groups_by_component_and_pattern():
    requests = [
        _make_request(test_name="header > logo", failure_type="visual_diff"),
        _make_request(test_name="header > nav", failure_type="visual_diff"),
        _make_request(test_name="footer > links", failure_type="visual_diff"),
    ]
    groups = group_failures(requests)
    # header and footer are different components
    assert len(groups) == 2
    header_group = next(g for g in groups if g.component == "header")
    assert len(header_group.requests) == 2
    assert set(header_group.test_names) == {"header > logo", "header > nav"}


def test_group_failures_separates_by_pattern():
    requests = [
        _make_request(test_name="header > logo", failure_type="visual_diff"),
        _make_request(test_name="header > logo error", failure_type="error", playwright_notes=["timeout"]),
    ]
    groups = group_failures(requests)
    assert len(groups) == 2


# --- build_group_request ---


def test_build_group_request_includes_all_names():
    from app.grouping import FailureGroup

    group = FailureGroup(
        component="header",
        failure_pattern="visual_diff",
        requests=[
            _make_request(test_name="header > logo"),
            _make_request(test_name="header > nav"),
        ],
        test_names=["header > logo", "header > nav"],
    )
    result = build_group_request(group)
    assert "header > logo" in result.question
    assert "header > nav" in result.question


def test_build_group_request_prefers_screenshots():
    from app.grouping import FailureGroup

    group = FailureGroup(
        component="header",
        failure_pattern="visual_diff",
        requests=[
            _make_request(test_name="header > a"),
            _make_request(test_name="header > b", screenshot_baseline="base64data", screenshot_actual="base64data"),
        ],
        test_names=["header > a", "header > b"],
    )
    result = build_group_request(group)
    assert result.run_summary is not None
    assert result.run_summary.screenshot_baseline == "base64data"


def test_build_group_request_uses_first_pr_context():
    from app.grouping import FailureGroup

    ctx = PRContext(title="Fix header")
    group = FailureGroup(
        component="header",
        failure_pattern="visual_diff",
        requests=[
            _make_request(test_name="header > a"),
            _make_request(test_name="header > b", pr_context=ctx),
        ],
        test_names=["header > a", "header > b"],
    )
    result = build_group_request(group)
    assert result.pr_context is not None
    assert result.pr_context.title == "Fix header"
