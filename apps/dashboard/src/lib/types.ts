// TypeScript interfaces mirroring the runner's Pydantic schemas.
//
// Source of truth: apps/runner/app/schemas.py
// These are kept in sync manually. If you change a schema in the runner,
// update the corresponding interface here.
//
// The main data flow:
//   GET /runs         → TriageRunSummary[]   (list page)
//   GET /runs/:id     → TriageRunResponse    (detail page)
//   TriageRunResponse contains TriageFailureResult[], each wrapping an AskResponse
//   from the agent graph.

export interface Citation {
  doc_id: string;
  snippet: string;
  source: string;
}

export interface RecommendedAction {
  type: string;
  executed: boolean;
  url: string | null;
}

export interface ToolCall {
  tool: string;
  query: string;
  used: boolean;
}

export interface ImageDiff {
  diff_ratio: number;
  changed_pixel_count: number;
  total_pixel_count: number;
  changed_regions: string[];
  diff_overlay_base64: string | null;
}

export interface DebugInfo {
  intent: string;
  errors: string[];
}

export interface AskResponse {
  classification: string;
  confidence: number;
  rationale: string;
  citations: Citation[];
  recommended_action: RecommendedAction | null;
  tool_calls: ToolCall[];
  image_diff: ImageDiff | null;
  vision_summary: string | null;
  debug: DebugInfo | null;
}

export interface TriageFailureResult {
  test_name: string;
  ask_response: AskResponse;
}

export interface TriageRunSummary {
  run_id: string;
  created_at: string;
  total_failures: number;
  classifications: Record<string, number>;
}

export interface TriageRunResponse {
  run_id: string;
  created_at: string;
  total_failures: number;
  results: TriageFailureResult[];
}

// Human feedback on a triage classification. Stored in localStorage for now
// (see lib/verdicts.ts). Step 13 wires this to episodic memory in Qdrant,
// where approved decisions become few-shot examples for future classifications.
export type HumanVerdict = "approved" | "rejected" | null;
