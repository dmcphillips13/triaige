from pydantic import BaseModel


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
