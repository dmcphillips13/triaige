"""Tests for Playwright JSON report parsing."""

from app.tools.playwright_parser import (
    _clean_error_message,
    _extract_screenshots,
    parse_report,
    parsed_result_to_ask_request,
)


def _minimal_report(suites=None, stats=None):
    """Build a minimal Playwright JSON report structure."""
    return {
        "config": {"version": "1.45.0"},
        "stats": stats or {"expected": 1, "unexpected": 1, "skipped": 0, "duration": 5000},
        "suites": suites or [],
    }


def _failing_suite(title="tests/header.spec.ts", spec_title="shows logo", error_msg="Expected pixel match"):
    """Build a suite with one failing spec."""
    return {
        "title": title,
        "file": "tests/header.spec.ts",
        "specs": [{
            "title": spec_title,
            "ok": False,
            "tests": [{
                "results": [{
                    "status": "failed",
                    "duration": 1200,
                    "errors": [{"message": error_msg}],
                    "attachments": [],
                    "retry": 0,
                }]
            }]
        }],
        "suites": [],
    }


# --- parse_report ---


def test_parse_report_empty_suites():
    report = _minimal_report(suites=[], stats={"expected": 0, "unexpected": 0, "skipped": 0, "duration": 0})
    result = parse_report(report)
    assert result.failures == []
    assert result.total_tests == 0


def test_parse_report_extracts_failures():
    report = _minimal_report(suites=[_failing_suite()])
    result = parse_report(report)
    assert len(result.failures) == 1
    assert result.failures[0].test_name == "tests/header.spec.ts > shows logo"
    assert result.failures[0].error_messages == ["Expected pixel match"]


def test_parse_report_skips_passing_specs():
    suite = {
        "title": "tests/header.spec.ts",
        "specs": [
            {"title": "passes", "ok": True, "tests": []},
            {"title": "fails", "ok": False, "tests": [{
                "results": [{"status": "failed", "duration": 100, "errors": [], "attachments": []}]
            }]},
        ],
        "suites": [],
    }
    result = parse_report(_minimal_report(suites=[suite]))
    assert len(result.failures) == 1
    assert result.failures[0].test_name == "tests/header.spec.ts > fails"


def test_parse_report_nested_suites():
    suite = {
        "title": "tests/auth.spec.ts",
        "specs": [],
        "suites": [{
            "title": "login form",
            "specs": [{
                "title": "validates email",
                "ok": False,
                "tests": [{
                    "results": [{"status": "failed", "duration": 500, "errors": []}]
                }]
            }],
            "suites": [],
        }],
    }
    result = parse_report(_minimal_report(suites=[suite]))
    assert len(result.failures) == 1
    assert result.failures[0].test_name == "tests/auth.spec.ts > login form > validates email"


def test_parse_report_stats():
    report = _minimal_report(stats={"expected": 10, "unexpected": 2, "skipped": 1, "duration": 30000})
    result = parse_report(report)
    assert result.total_tests == 13
    assert result.passed == 10
    assert result.failed == 2
    assert result.skipped == 1


# --- _clean_error_message ---


def test_clean_strips_ansi():
    msg = "\x1b[31mError\x1b[0m: something failed"
    assert _clean_error_message(msg) == "Error: something failed"


def test_clean_deduplicates_retries():
    lines = [
        "Call log:",
        "  - unexpected value \"foo\"",
        "  - unexpected value \"foo\"",
        "  - unexpected value \"foo\"",
        "  - unexpected value \"bar\"",
    ]
    result = _clean_error_message("\n".join(lines))
    assert "(2 retries omitted)" in result
    assert "foo" in result
    assert "bar" in result


def test_clean_preserves_normal_text():
    msg = "Expected 'Hello' to equal 'World'"
    assert _clean_error_message(msg) == msg


# --- _extract_screenshots ---


def test_extract_screenshots_expected_actual():
    attachments = [
        {"name": "expected", "body": "baseline_data", "path": "/home/runner/work/repo/repo/tests/snapshots/logo.png"},
        {"name": "actual", "body": "actual_data"},
    ]
    baseline, actual, path = _extract_screenshots(attachments)
    assert baseline == "baseline_data"
    assert actual == "actual_data"
    assert path == "tests/snapshots/logo.png"


def test_extract_screenshots_newer_naming():
    attachments = [
        {"name": "logo-expected.png", "body": "base", "path": "tests/snapshots/logo.png"},
        {"name": "logo-actual.png", "body": "act"},
    ]
    baseline, actual, _ = _extract_screenshots(attachments)
    assert baseline == "base"
    assert actual == "act"


def test_extract_screenshots_failure_only():
    """On-failure screenshot (no visual diff pair) maps to actual."""
    attachments = [{"name": "screenshot", "body": "failure_shot"}]
    baseline, actual, path = _extract_screenshots(attachments)
    assert baseline is None
    assert actual == "failure_shot"
    assert path is None


def test_extract_screenshots_empty():
    baseline, actual, path = _extract_screenshots([])
    assert baseline is None
    assert actual is None
    assert path is None


# --- parsed_result_to_ask_request ---


def test_parsed_result_visual_diff():
    from app.tools.playwright_parser import ParsedTestResult

    result = ParsedTestResult(
        test_name="header > logo",
        file="tests/header.spec.ts",
        status="failed",
        duration_ms=1000,
        error_messages=["Screenshot mismatch"],
        attachments=[
            {"name": "expected", "body": "baseline", "path": "tests/snapshots/logo.png"},
            {"name": "actual", "body": "actual"},
        ],
    )
    ask = parsed_result_to_ask_request(result)
    assert ask.run_summary is not None
    assert ask.run_summary.failure_type == "visual_diff"
    assert ask.run_summary.screenshot_baseline == "baseline"
    assert ask.run_summary.screenshot_actual == "actual"


def test_parsed_result_functional_failure():
    from app.tools.playwright_parser import ParsedTestResult

    result = ParsedTestResult(
        test_name="checkout > submit",
        file="tests/checkout.spec.ts",
        status="failed",
        duration_ms=5000,
        error_messages=["Timeout waiting for selector"],
        attachments=[{"name": "screenshot", "body": "failure_shot"}],
    )
    ask = parsed_result_to_ask_request(result)
    assert ask.run_summary is not None
    assert ask.run_summary.failure_type == "error"
    assert ask.run_summary.screenshot_actual == "failure_shot"
    assert ask.run_summary.screenshot_baseline is None
