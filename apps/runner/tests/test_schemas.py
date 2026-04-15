"""Tests for Pydantic model validation."""

import pytest
from pydantic import ValidationError

from app.schemas import AskRequest, TriageRunRequest


# --- TriageRunRequest validator ---


def test_triage_run_requires_one_input():
    with pytest.raises(ValidationError, match="Provide either report_json or failures"):
        TriageRunRequest()


def test_triage_run_rejects_both_inputs():
    with pytest.raises(ValidationError, match="not both"):
        TriageRunRequest(
            report_json={"stats": {}},
            failures=[AskRequest(question="test")],
        )


def test_triage_run_accepts_report_json():
    req = TriageRunRequest(report_json={"stats": {}})
    assert req.report_json is not None
    assert req.failures is None


def test_triage_run_accepts_failures():
    req = TriageRunRequest(failures=[AskRequest(question="test failed")])
    assert req.failures is not None
    assert req.report_json is None
