from pydantic import BaseModel, model_validator


# --- Request models ---


class RunSummary(BaseModel):
    test_name: str | None = None
    url: str | None = None
    failure_type: str | None = None
    diff_ratio: float | None = None
    changed_regions: list[str] | None = None
    console_errors: list[str] | None = None
    http_errors: list[str] | None = None
    playwright_notes: list[str] | None = None
    screenshot_baseline: str | None = None
    screenshot_actual: str | None = None


class PRContext(BaseModel):
    title: str | None = None
    changed_files: list[str] | None = None
    commit_messages: list[str] | None = None
    diff: str | None = None
    repo: str | None = None
    pr_number: int | None = None


class AskRequest(BaseModel):
    question: str
    run_summary: RunSummary | None = None
    pr_context: PRContext | None = None


# --- Response models ---


class Citation(BaseModel):
    doc_id: str
    snippet: str
    source: str


class RecommendedAction(BaseModel):
    type: str
    executed: bool = False
    url: str | None = None


class ToolCall(BaseModel):
    tool: str
    query: str
    used: bool


class ImageDiff(BaseModel):
    diff_ratio: float
    changed_pixel_count: int
    total_pixel_count: int
    changed_regions: list[str]
    diff_overlay_base64: str | None = None


class DebugInfo(BaseModel):
    intent: str
    errors: list[str] = []


class AskResponse(BaseModel):
    classification: str
    confidence: float
    rationale: str
    citations: list[Citation] = []
    recommended_action: RecommendedAction | None = None
    tool_calls: list[ToolCall] = []
    image_diff: ImageDiff | None = None
    vision_summary: str | None = None
    debug: DebugInfo | None = None


# --- Triage Run models ---


class FeedbackRequest(BaseModel):
    """Human verdict on a triage classification."""

    run_id: str
    test_name: str
    verdict: str  # "approved" or "rejected"


class TriageRunRequest(BaseModel):
    """Accepts either raw Playwright JSON or pre-parsed failures."""

    report_json: dict | None = None
    failures: list[AskRequest] | None = None
    pr_context: PRContext | None = None

    @model_validator(mode="after")
    def _require_one_input(self) -> "TriageRunRequest":
        if not self.report_json and not self.failures:
            raise ValueError("Provide either report_json or failures")
        if self.report_json and self.failures:
            raise ValueError("Provide report_json or failures, not both")
        return self


class TriageFailureResult(BaseModel):
    """One failure's triage result within a run."""

    test_name: str
    ask_response: AskResponse
    group: list[str] | None = None
    screenshot_baseline: str | None = None
    screenshot_actual: str | None = None


class TriageRunSummary(BaseModel):
    """Summary for listing runs."""

    run_id: str
    created_at: str
    total_failures: int
    classifications: dict[str, int]


class TriageRunResponse(BaseModel):
    """Full triage run with all results."""

    run_id: str
    created_at: str
    total_failures: int
    results: list[TriageFailureResult]
