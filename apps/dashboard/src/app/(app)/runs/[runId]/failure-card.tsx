// Expandable failure card for a single test failure within a triage run.
//
// Collapsed view: classification badge, test name, confidence %, recommended action.
// Expanded view: rationale text, citations, tool calls, image diff, screenshots.
//
// Known failure annotation: if the test was failing before this run, shows
// "Failing since PR #X: title" with a link. If an open submission (PR or issue)
// exists from a previous run, shows the link and hides approve/reject buttons.
//
// Action gating: on Main tab, if a failure already has an open PR/issue from a
// previous run, approve/reject buttons are hidden to prevent duplicates.

"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Check, X, ChevronDown, ChevronRight, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ClassificationBadge } from "@/components/classification-badge";
import { ScreenshotViewer } from "@/components/screenshot-viewer";
import type {
  Citation,
  ToolCall,
  TriageFailureResult,
  HumanVerdict,
  SubmissionResult,
  KnownFailureInfo,
} from "@/lib/types";

export function FailureCard({
  result,
  verdict,
  onVerdict,
  readOnly = false,
  submitted = null,
  knownFailure = null,
  actionGated = false,
  existingSubmission = null,
  isPreMerge = false,
}: {
  result: TriageFailureResult;
  verdict: HumanVerdict;
  onVerdict: (verdict: HumanVerdict) => void;
  readOnly?: boolean;
  submitted?: SubmissionResult | null;
  knownFailure?: KnownFailureInfo | null;
  actionGated?: boolean;
  existingSubmission?: SubmissionResult | null;
  isPreMerge?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const { ask_response: res } = result;

  return (
    <div
      className={cn(
        "rounded-lg border bg-white shadow-sm transition-colors",
        verdict === "approved" && "border-emerald-200",
        verdict === "rejected" && "border-rose-200",
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

      {/* Known failure annotation */}
      {knownFailure?.failing_since && (
        <div className="flex items-center gap-2 border-t border-zinc-100 bg-amber-50 px-4 py-2">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
          <span className="text-xs text-amber-700">
            Failing since{" "}
            {knownFailure.failing_since.pr_url ? (
              <a
                href={knownFailure.failing_since.pr_url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium hover:underline"
              >
                {knownFailure.failing_since.pr_title ||
                  knownFailure.failing_since.pr_url}
              </a>
            ) : (
              <span className="font-medium">
                {knownFailure.failing_since.pr_title || "a previous run"}
              </span>
            )}
          </span>
          {/* Show existing open submission link inline */}
          {(existingSubmission || knownFailure.open_submission) && (
            <>
              <span className="text-xs text-amber-400">·</span>
              <a
                href={
                  (existingSubmission || knownFailure.open_submission)!.url
                }
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "text-xs font-medium hover:underline",
                  (existingSubmission || knownFailure.open_submission)!
                    .type === "pr"
                    ? "text-emerald-700"
                    : "text-rose-700"
                )}
              >
                {(existingSubmission || knownFailure.open_submission)!
                  .type === "pr"
                  ? (isPreMerge ? "Baseline committed" : "Baseline PR pending")
                  : "Issue open"}
              </a>
            </>
          )}
        </div>
      )}

      {/* Open submission without failing_since (submission exists but not from a prior run's failure) */}
      {!knownFailure?.failing_since &&
        (existingSubmission || knownFailure?.open_submission) && (
          <div className="flex items-center gap-2 border-t border-zinc-100 bg-zinc-50 px-4 py-2">
            <a
              href={
                (existingSubmission || knownFailure!.open_submission)!.url
              }
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "text-xs font-medium hover:underline",
                (existingSubmission || knownFailure!.open_submission)!
                  .type === "pr"
                  ? "text-emerald-700"
                  : "text-rose-700"
              )}
            >
              {(existingSubmission || knownFailure!.open_submission)!
                .type === "pr"
                ? "Baseline PR pending"
                : "Issue open"}
            </a>
          </div>
        )}

      {/* Approve / Reject buttons */}
      {!readOnly && !actionGated && (
        <div className="flex items-center gap-1 border-t border-zinc-100 px-4 py-2">
          {submitted ? (
            <a
              href={submitted.url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium",
                submitted.type === "pr"
                  ? "bg-emerald-50 text-emerald-700 hover:underline"
                  : "bg-rose-50 text-rose-700 hover:underline"
              )}
            >
              {submitted.type === "pr"
                ? (isPreMerge ? "Baseline committed" : "Baseline PR opened")
                : "Issue created"}
              <span className="text-[10px] opacity-60">&rarr;</span>
            </a>
          ) : (
            <>
              <button
                onClick={() =>
                  onVerdict(verdict === "approved" ? null : "approved")
                }
                className={cn(
                  "inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors",
                  verdict === "approved"
                    ? "bg-emerald-100 text-emerald-800"
                    : "text-zinc-500 hover:bg-zinc-100"
                )}
              >
                <Check className="h-3.5 w-3.5" />
                Approve
              </button>
              <button
                onClick={() =>
                  onVerdict(verdict === "rejected" ? null : "rejected")
                }
                className={cn(
                  "inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors",
                  verdict === "rejected"
                    ? "bg-rose-100 text-rose-800"
                    : "text-zinc-500 hover:bg-zinc-100"
                )}
              >
                <X className="h-3.5 w-3.5" />
                Reject
              </button>
            </>
          )}
        </div>
      )}

      {/* Rationale — always visible */}
      <div className="border-t border-zinc-100 px-4 py-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Rationale
        </h4>
        <MarkdownContent text={res.rationale} />
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="space-y-4 border-t border-zinc-100 px-4 py-4">
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

          {/* Vision analysis — collapsed by default */}
          {res.vision_summary && (
            <VisionAnalysisSection text={res.vision_summary} />
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
              <h4 className="text-xs font-semibold uppercase tracking-wide text-rose-400">
                Errors
              </h4>
              <ul className="mt-1 space-y-1">
                {res.debug.errors.map((e, i) => (
                  <li key={i} className="text-xs text-rose-600">
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
  // Fix inline bullets: ensure "- " at bullet boundaries starts on a new line
  const normalized = text.replace(/ - \*\*/g, "\n- **");
  return (
    <div className="mt-1 text-sm text-zinc-700 prose prose-sm prose-zinc prose-li:my-0.5 prose-ul:list-disc prose-ul:pl-4">
      <ReactMarkdown>{normalized}</ReactMarkdown>
    </div>
  );
}

/** Collapsible vision analysis — collapsed by default. */
function VisionAnalysisSection({ text }: { text: string }) {
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
        Vision Analysis
      </button>
      {open && <MarkdownContent text={text} />}
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
