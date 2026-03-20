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

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Check, X, ChevronDown, ChevronRight, Maximize2 } from "lucide-react";
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
  actionsLoaded = true,
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
  actionsLoaded?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [errorExpanded, setErrorExpanded] = useState(false);
  const [screenshotFullscreen, setScreenshotFullscreen] = useState(false);
  const { ask_response: res } = result;
  const isFunctional = result.failure_type === "error";

  useEffect(() => {
    if (!screenshotFullscreen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setScreenshotFullscreen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [screenshotFullscreen]);

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
      <div className="flex w-full items-center gap-3 p-4">
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
      </div>

      {/* Submission display — unified for both current and existing submissions */}
      {!actionsLoaded ? (
        <div className="border-t border-zinc-100 bg-zinc-50 px-4 py-2">
          <div className="h-4 w-32 animate-pulse rounded bg-zinc-200/60" />
        </div>
      ) : (() => {
        const sub = submitted || existingSubmission || knownFailure?.open_submission || null;
        if (sub) {
          const isDeferred = sub.url.startsWith("deferred:");
          return (
            <div className="flex items-center gap-2 border-t border-zinc-100 bg-zinc-50 px-4 py-2">
              {isDeferred ? (
                <span className="text-xs font-medium text-amber-600">
                  Issue will be filed on merge
                </span>
              ) : (
                <a
                  href={sub.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "text-xs font-medium hover:underline",
                    sub.type === "pr" ? "text-emerald-700" : "text-rose-700"
                  )}
                >
                  {sub.type === "pr" ? "Baseline committed" : "Issue open"}
                </a>
              )}
            </div>
          );
        }
        if (!readOnly && !actionGated) {
          if (isFunctional) {
            return (
              <div className="border-t border-zinc-100 px-4 py-2">
                <p className="mb-2 text-xs text-zinc-500">
                  If this change is expected, update the test in your PR to match. If this is unexpected, fix the underlying bug or open an issue to track it.
                </p>
                <button
                  onClick={() =>
                    onVerdict(verdict === "rejected" ? null : "rejected")
                  }
                  className={cn(
                    "inline-flex w-full items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-all duration-200",
                    verdict === "rejected"
                      ? "border-rose-300 bg-rose-100 text-rose-800"
                      : "border-rose-200 bg-rose-50/50 text-rose-700 hover:bg-rose-100 hover:border-rose-300"
                  )}
                >
                  <X className="h-3.5 w-3.5 shrink-0" />
                  <span className="whitespace-nowrap">
                    {verdict === "rejected" ? "Rejected (click to undo)" : "Open GH issue to track bug"}
                  </span>
                </button>
              </div>
            );
          }
          return (
            <div className="flex items-center gap-1 border-t border-zinc-100 px-4 py-2">
              <button
                onClick={() =>
                  onVerdict(verdict === "approved" ? null : "approved")
                }
                className={cn(
                  "inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-all duration-200",
                  verdict === "approved"
                    ? "border-emerald-300 bg-emerald-100 text-emerald-800"
                    : verdict === "rejected"
                      ? "max-w-0 overflow-hidden border-transparent px-0 opacity-0"
                      : "border-emerald-200 bg-emerald-50/50 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300"
                )}
              >
                <Check className="h-3.5 w-3.5 shrink-0" />
                <span className="whitespace-nowrap">
                  {verdict === "approved"
                    ? "Approved (click to undo)"
                    : "Approve baseline update"}
                </span>
              </button>
              <button
                onClick={() =>
                  onVerdict(verdict === "rejected" ? null : "rejected")
                }
                className={cn(
                  "inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-all duration-200",
                  verdict === "rejected"
                    ? "border-rose-300 bg-rose-100 text-rose-800"
                    : verdict === "approved"
                      ? "max-w-0 overflow-hidden border-transparent px-0 opacity-0"
                      : "border-rose-200 bg-rose-50/50 text-rose-700 hover:bg-rose-100 hover:border-rose-300"
                )}
              >
                <X className="h-3.5 w-3.5 shrink-0" />
                <span className="whitespace-nowrap">
                  {verdict === "rejected" ? "Rejected (click to undo)" : "Reject and open GH issue"}
                </span>
              </button>
            </div>
          );
        }
        return null;
      })()}

      {/* Rationale + screenshots — collapse when verdict is selected */}
      {!verdict && (
        <>
          <div className="border-t border-zinc-100 px-4 py-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Rationale
            </h4>
            <MarkdownContent text={res.rationale} />
          </div>

          {/* Error details for functional failures */}
          {isFunctional && res.error_message && (
            <div className="border-t border-zinc-100 px-4 py-3">
              <button
                onClick={() => setErrorExpanded(!errorExpanded)}
                className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-zinc-400 hover:text-zinc-600"
              >
                {errorExpanded ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
                Error Details
              </button>
              {errorExpanded && (
                <pre className="mt-2 overflow-x-auto rounded bg-zinc-50 p-3 text-xs text-zinc-700 font-mono whitespace-pre-wrap">
                  {res.error_message}
                </pre>
              )}
            </div>
          )}

          {/* Failure screenshot for functional tests (single image, no comparison) */}
          {isFunctional && !result.screenshot_baseline && result.screenshot_actual && (
            <div className="border-t border-zinc-100 px-4 py-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  Failure Screenshot
                </h4>
                <button
                  onClick={() => setScreenshotFullscreen(true)}
                  className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
                >
                  <Maximize2 className="h-3 w-3" />
                  Expand
                </button>
              </div>
              <div className="mt-2 max-w-md">
                <img
                  src={`data:image/png;base64,${result.screenshot_actual}`}
                  alt="Failure screenshot"
                  className="max-h-[250px] w-full object-contain rounded border border-zinc-200 cursor-pointer"
                  onClick={() => setScreenshotFullscreen(true)}
                />
              </div>
            </div>
          )}

          {/* Screenshot comparison for visual tests */}
          {!isFunctional && result.screenshot_baseline && result.screenshot_actual && (
            <div className="border-t border-zinc-100 px-4 py-4">
              <ScreenshotViewer
                baseline={result.screenshot_baseline}
                actual={result.screenshot_actual}
                diffOverlay={res.image_diff?.diff_overlay_base64}
              />
            </div>
          )}
        </>
      )}

      {/* Show/hide details toggle */}
      <div className="border-t border-zinc-100 px-4 py-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
        >
          {expanded ? "Hide details" : "Show details"}
        </button>
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
      {/* Fullscreen modal for functional failure screenshot */}
      {screenshotFullscreen && result.screenshot_actual && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-sm"
          onClick={() => setScreenshotFullscreen(false)}
        >
          <div
            className="flex flex-1 flex-col p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-end mb-4">
              <button
                onClick={() => setScreenshotFullscreen(false)}
                className="rounded-md p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto flex items-center justify-center">
              <img
                src={`data:image/png;base64,${result.screenshot_actual}`}
                alt="Failure screenshot"
                className="max-h-[80vh] max-w-full object-contain rounded border border-zinc-700"
              />
            </div>
          </div>
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
    <div className="mt-1 text-[15px] leading-relaxed text-zinc-700 prose prose-zinc prose-li:my-0.5 prose-ul:list-disc prose-ul:pl-4">
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
