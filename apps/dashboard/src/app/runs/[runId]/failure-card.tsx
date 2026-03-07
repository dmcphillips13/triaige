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
import { Check, X, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ClassificationBadge } from "@/components/classification-badge";
import type { TriageFailureResult, HumanVerdict } from "@/lib/types";

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
          {/* Rationale */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Rationale
            </h4>
            <p className="mt-1 text-sm text-zinc-700">{res.rationale}</p>
          </div>

          {/* Citations */}
          {res.citations.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Citations
              </h4>
              <ul className="mt-1 space-y-2">
                {res.citations.map((c, i) => (
                  <li
                    key={i}
                    className="rounded border border-zinc-100 bg-zinc-50 p-2"
                  >
                    <span className="text-xs font-medium text-zinc-600">
                      {c.doc_id}
                    </span>
                    <span className="ml-2 text-xs text-zinc-400">
                      ({c.source})
                    </span>
                    <p className="mt-1 text-xs text-zinc-500">{c.snippet}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Tool calls */}
          {res.tool_calls.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Tool Calls
              </h4>
              <ul className="mt-1 space-y-1">
                {res.tool_calls.map((tc, i) => (
                  <li key={i} className="text-xs text-zinc-600">
                    <span className="font-mono">{tc.tool}</span>
                    <span className="ml-1 text-zinc-400">({tc.query})</span>
                    {!tc.used && (
                      <span className="ml-1 text-zinc-300">— unused</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

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
