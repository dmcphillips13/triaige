// Expandable failure card for a single test failure within a triage run.
//
// Collapsed view: classification badge, test name, confidence %, recommended action.
// Expanded view: rationale text, citations (doc_id + snippet), tool calls,
//   image diff stats (when available), and debug errors.
//
// Approve/reject buttons toggle the human verdict. Clicking the same verdict
// again clears it (toggles back to null). The card border changes color to
// reflect the current verdict: green (approved), red (rejected), neutral (none).
//
// Props:
//   result   — TriageFailureResult containing test_name and the full AskResponse
//   verdict  — current human verdict for this failure (from parent state)
//   onVerdict — callback to update the verdict (syncs to localStorage via parent)

"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Check, X, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ClassificationBadge } from "@/components/classification-badge";
import { ScreenshotViewer } from "@/components/screenshot-viewer";
import type { Citation, ToolCall, TriageFailureResult, HumanVerdict } from "@/lib/types";

export function FailureCard({
  result,
  verdict,
  onVerdict,
}: {
  result: TriageFailureResult;
  verdict: HumanVerdict;
  onVerdict: (verdict: HumanVerdict) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { ask_response: res } = result;

  return (
    <div
      className={cn(
        "rounded-lg border bg-white transition-colors",
        verdict === "approved" && "border-green-300",
        verdict === "rejected" && "border-red-300",
        !verdict && "border-zinc-200"
      )}
    >
      {/* Collapsed row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-zinc-400" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400" />
        )}
        <ClassificationBadge classification={res.classification} />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-900">
          {result.test_name}
        </span>
        <span className="shrink-0 text-sm text-zinc-500">
          {Math.round(res.confidence * 100)}%
        </span>
        {res.recommended_action && (
          <span className="hidden shrink-0 rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 sm:inline">
            {res.recommended_action.type.replace(/_/g, " ")}
          </span>
        )}
      </button>

      {/* Approve / Reject buttons */}
      <div className="flex gap-1 border-t border-zinc-100 px-4 py-2">
        <button
          onClick={() => onVerdict(verdict === "approved" ? null : "approved")}
          className={cn(
            "inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors",
            verdict === "approved"
              ? "bg-green-100 text-green-800"
              : "text-zinc-500 hover:bg-zinc-100"
          )}
        >
          <Check className="h-3.5 w-3.5" />
          Approve
        </button>
        <button
          onClick={() => onVerdict(verdict === "rejected" ? null : "rejected")}
          className={cn(
            "inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors",
            verdict === "rejected"
              ? "bg-red-100 text-red-800"
              : "text-zinc-500 hover:bg-zinc-100"
          )}
        >
          <X className="h-3.5 w-3.5" />
          Reject
        </button>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="space-y-4 border-t border-zinc-100 px-4 py-4">
          {/* Vision analysis */}
          {res.vision_summary && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Vision Analysis
              </h4>
              <MarkdownContent text={res.vision_summary} />
            </div>
          )}

          {/* Rationale */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Rationale
            </h4>
            <MarkdownContent text={res.rationale} />
          </div>

          {/* Image diff stats */}
          {res.image_diff && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Image Diff
              </h4>
              <div className="mt-1 flex flex-wrap gap-3 text-xs text-zinc-600">
                <span>
                  Diff: {(res.image_diff.diff_ratio * 100).toFixed(1)}%
                </span>
                <span>
                  Changed: {res.image_diff.changed_pixel_count.toLocaleString()} / {res.image_diff.total_pixel_count.toLocaleString()} px
                </span>
                {res.image_diff.changed_regions.length > 0 && (
                  <span>
                    Regions: {res.image_diff.changed_regions.join(", ")}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Screenshots */}
          {result.screenshot_baseline && result.screenshot_actual && (
            <ScreenshotViewer
              baseline={result.screenshot_baseline}
              actual={result.screenshot_actual}
              diffOverlay={res.image_diff?.diff_overlay_base64}
            />
          )}

          {/* Citations — collapsed by default */}
          {res.citations.length > 0 && (
            <CitationsSection citations={res.citations} />
          )}

          {/* Tool calls — collapsed by default */}
          {res.tool_calls.length > 0 && (
            <ToolCallsSection toolCalls={res.tool_calls} />
          )}

          {/* Debug errors */}
          {res.debug && res.debug.errors.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-red-400">
                Errors
              </h4>
              <ul className="mt-1 space-y-1">
                {res.debug.errors.map((e, i) => (
                  <li key={i} className="text-xs text-red-600">
                    {e}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Renders text as markdown with prose styling. */
function MarkdownContent({ text }: { text: string }) {
  return (
    <div className="mt-1 text-sm text-zinc-700 prose-sm prose-zinc prose-li:my-0.5">
      <ReactMarkdown>{text}</ReactMarkdown>
    </div>
  );
}

/** Collapsible citations list — shows doc IDs inline, expands to show snippets. */
function CitationsSection({ citations }: { citations: Citation[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-zinc-400 hover:text-zinc-600"
      >
        {open ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        Citations ({citations.length})
      </button>
      {open && (
        <ul className="mt-1 space-y-2">
          {citations.map((c, i) => (
            <li
              key={i}
              className="rounded border border-zinc-100 bg-zinc-50 p-2"
            >
              <span className="text-xs font-medium text-zinc-600">
                {c.doc_id}
              </span>
              <span className="ml-2 text-xs text-zinc-400">({c.source})</span>
              <p className="mt-1 text-xs text-zinc-500">{c.snippet}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Collapsible tool calls list — matches citations collapse style. */
function ToolCallsSection({ toolCalls }: { toolCalls: ToolCall[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-zinc-400 hover:text-zinc-600"
      >
        {open ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        Tool Calls ({toolCalls.length})
      </button>
      {open && (
        <ul className="mt-1 space-y-1">
          {toolCalls.map((tc, i) => (
            <li key={i} className="text-xs text-zinc-600">
              <span className="font-mono">{tc.tool}</span>
              <span className="ml-1 text-zinc-400">({tc.query})</span>
              {!tc.used && (
                <span className="ml-1 text-zinc-300">— unused</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
