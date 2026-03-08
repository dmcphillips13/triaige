"""Parse Playwright JSON test reports into structured data for the triage agent.

Playwright's JSON reporter produces a nested structure:
  config.projects[] -> suites[] -> specs[] -> tests[] -> results[]

This module extracts failed tests and converts them into AskRequest objects
that can be fed directly into the existing agent graph.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from app.schemas import AskRequest, PRContext, RunSummary


@dataclass
class ParsedTestResult:
    """A single failed test extracted from a Playwright JSON report."""

    test_name: str
    file: str
    status: str
    duration_ms: int
    error_messages: list[str] = field(default_factory=list)
    stdout: list[str] = field(default_factory=list)
    stderr: list[str] = field(default_factory=list)
    attachments: list[dict] = field(default_factory=list)
    retry: int = 0


@dataclass
class ParsedPlaywrightReport:
    """Parsed summary of a full Playwright JSON report."""

    failures: list[ParsedTestResult]
    total_tests: int
    passed: int
    failed: int
    skipped: int
    duration_ms: float
    playwright_version: str


def parse_report(report_json: dict) -> ParsedPlaywrightReport:
    """Parse a Playwright JSON report dict into structured data."""
    stats = report_json.get("stats", {})
    config = report_json.get("config", {})
    failures: list[ParsedTestResult] = []

    for suite in report_json.get("suites", []):
        _walk_suite(suite, [], failures)

    return ParsedPlaywrightReport(
        failures=failures,
        total_tests=stats.get("expected", 0) + stats.get("unexpected", 0) + stats.get("skipped", 0),
        passed=stats.get("expected", 0),
        failed=stats.get("unexpected", 0),
        skipped=stats.get("skipped", 0),
        duration_ms=stats.get("duration", 0),
        playwright_version=config.get("version", "unknown"),
    )


def _walk_suite(
    suite: dict,
    parent_titles: list[str],
    failures: list[ParsedTestResult],
) -> None:
    """Recursively walk suites to find failed specs."""
    titles = parent_titles + [suite["title"]] if suite.get("title") else parent_titles

    for spec in suite.get("specs", []):
        if spec.get("ok"):
            continue
        for test in spec.get("tests", []):
            for result in test.get("results", []):
                if result.get("status") in ("passed", "skipped"):
                    continue
                test_name = " > ".join([*titles, spec.get("title", "")])
                failures.append(ParsedTestResult(
                    test_name=test_name,
                    file=spec.get("file", suite.get("file", "")),
                    status=result.get("status", "failed"),
                    duration_ms=result.get("duration", 0),
                    error_messages=[
                        e.get("message", "") for e in result.get("errors", []) if e.get("message")
                    ],
                    stdout=[
                        entry.get("text", "") for entry in result.get("stdout", []) if isinstance(entry, dict)
                    ],
                    stderr=[
                        entry.get("text", "") for entry in result.get("stderr", []) if isinstance(entry, dict)
                    ],
                    attachments=result.get("attachments", []),
                    retry=result.get("retry", 0),
                ))

    for child in suite.get("suites", []):
        _walk_suite(child, titles, failures)


def _extract_screenshots(attachments: list[dict]) -> tuple[str | None, str | None, str | None]:
    """Extract baseline/actual screenshot base64 and snapshot path from attachments.

    Returns (baseline_b64, actual_b64, snapshot_path).
    The snapshot_path is the repo-relative path to the expected (baseline) image,
    used by the update-baselines endpoint to commit replacements.
    """
    baseline = None
    actual = None
    snapshot_path = None
    for att in attachments:
        name = att.get("name", "")
        body = att.get("body")
        # Playwright names attachments as either "expected"/"actual" (older versions)
        # or "{snapshot}-expected.png"/"{snapshot}-actual.png" (newer versions)
        is_expected = name == "expected" or name.endswith("-expected.png")
        is_actual = name == "actual" or name.endswith("-actual.png")
        if is_expected:
            if body:
                baseline = body
            # The path field points to the baseline file in the repo.
            # In CI, this is an absolute path (e.g. /home/runner/work/repo/repo/tests/...).
            # Strip to repo-relative by finding the tests/ prefix.
            if att.get("path"):
                raw = att["path"]
                idx = raw.find("tests/")
                snapshot_path = raw[idx:] if idx != -1 else raw
        elif is_actual:
            if body:
                actual = body
    return baseline, actual, snapshot_path


def parsed_result_to_ask_request(
    result: ParsedTestResult,
    pr_context: PRContext | None = None,
) -> AskRequest:
    """Convert a ParsedTestResult into an AskRequest for the agent graph."""
    baseline, actual, snapshot_path = _extract_screenshots(result.attachments)
    has_screenshots = baseline is not None or actual is not None

    question = f"Test '{result.test_name}' failed with status '{result.status}'."
    if result.error_messages:
        question += f" Error: {result.error_messages[0][:500]}"

    return AskRequest(
        question=question,
        run_summary=RunSummary(
            test_name=result.test_name,
            failure_type="visual_diff" if has_screenshots else "error",
            playwright_notes=result.error_messages,
            screenshot_baseline=baseline,
            screenshot_actual=actual,
            snapshot_path=snapshot_path,
        ),
        pr_context=pr_context,
    )
