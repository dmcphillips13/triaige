// Client component for run detail — manages human approve/reject verdict state
// and renders the list of failure cards.
//
// Verdicts, submissions, and known failure context are loaded from Postgres
// via the runner API. Known failures show which PR introduced the regression
// and any existing open submissions (PRs or issues).
//
// Pre-merge runs are the primary workspace:
//   - Approved → baseline committed directly to PR branch
//   - Rejected → GitHub issues
//   - Pre-existing failures (failing on main) are shown but non-actionable
//   - Merge gate check updated to success when all failures addressed
//
// Post-merge runs:
//   - Approved → baseline update PR
//   - Rejected → GitHub issues
//   - Auto-close when all failures addressed

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ClassificationBadge } from "@/components/classification-badge";
import type {
  HumanVerdict,
  KnownFailureInfo,
  SubmissionResult,
  TriageRunResponse,
} from "@/lib/types";
import {
  fetchVerdicts,
  fetchSubmissions,
  fetchKnownFailures,
  submitFeedback,
  putVerdict,
  putSubmission,
  updateBaselines,
  createIssues,
} from "@/lib/api";
import { FailureCard } from "./failure-card";

export function RunDetail({ run }: { run: TriageRunResponse }) {
  const [verdicts, setVerdicts] = useState<Record<string, HumanVerdict>>({});
  const [submitStatus, setSubmitStatus] = useState<
    "idle" | "loading" | "done" | "error"
  >("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isClosed, setIsClosed] = useState(run.closed ?? false);
  const [submitted, setSubmitted] = useState<Record<string, SubmissionResult>>(
    {}
  );
  const [knownFailures, setKnownFailures] = useState<
    Record<string, KnownFailureInfo>
  >({});

  // Load verdicts, submissions, and known failures from the API on mount
  useEffect(() => {
    fetchVerdicts(run.run_id).then((v) => {
      const mapped: Record<string, HumanVerdict> = {};
      for (const r of run.results) {
        mapped[r.test_name] = (v[r.test_name] as HumanVerdict) ?? null;
      }
      setVerdicts(mapped);
    });
    fetchSubmissions(run.run_id).then(setSubmitted);
    fetchKnownFailures(run.run_id).then(setKnownFailures);
  }, [run]);

  const handleVerdict = useCallback(
    (testName: string, verdict: HumanVerdict) => {
      setVerdicts((prev) => ({ ...prev, [testName]: verdict }));
      if (verdict) {
        putVerdict(run.run_id, testName, verdict).catch(() => {});
        submitFeedback(run.run_id, testName, verdict).catch(() => {});
      }
    },
    [run.run_id]
  );

  const isPreMerge = run.triage_mode === "pre_merge";
  const isPostMerge = run.triage_mode !== "pre_merge";

  // Failures ready to submit: have a verdict, no submission from this run,
  // and no open submission from a previous run
  const pendingApproved = run.results.filter(
    (r) =>
      verdicts[r.test_name] === "approved" &&
      !submitted[r.test_name] &&
      !knownFailures[r.test_name]?.open_submission &&
      r.screenshot_actual &&
      r.snapshot_path
  );
  const pendingRejected = run.results.filter(
    (r) =>
      verdicts[r.test_name] === "rejected" &&
      !submitted[r.test_name] &&
      !knownFailures[r.test_name]?.open_submission
  );
  const hasPending = pendingApproved.length > 0 || pendingRejected.length > 0;

  const handleSubmitChanges = async () => {
    if (!run.repo || !hasPending) return;
    setSubmitStatus("loading");
    setSubmitError(null);

    const newSubmitted: Record<string, SubmissionResult> = {};

    try {
      if (pendingApproved.length > 0) {
        const { pr_url } = await updateBaselines(
          run.run_id,
          pendingApproved.map((r) => r.test_name),
          run.repo
        );
        for (const r of pendingApproved) {
          newSubmitted[r.test_name] = { url: pr_url, type: "pr" };
        }
      }

      if (pendingRejected.length > 0) {
        const { issues } = await createIssues(
          run.run_id,
          pendingRejected.map((r) => r.test_name),
          run.repo
        );
        for (const issue of issues) {
          newSubmitted[issue.test_name] = {
            url: issue.issue_url,
            type: "issue",
          };
        }
      }

      for (const [testName, sub] of Object.entries(newSubmitted)) {
        putSubmission(run.run_id, testName, sub.url, sub.type).catch(() => {});
      }

      setSubmitted((prev) => ({ ...prev, ...newSubmitted }));
      setSubmitStatus("done");
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Failed to submit changes"
      );
      setSubmitStatus("error");
    }
  };

  const date = new Date(run.created_at).toLocaleString();

  const counts: Record<string, number> = {};
  for (const r of run.results) {
    const cls = r.ask_response.classification;
    counts[cls] = (counts[cls] || 0) + 1;
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link
          href="/runs"
          className="group flex items-center gap-1 text-sm font-medium text-zinc-400 transition-colors hover:text-zinc-700"
        >
          <span className="transition-transform group-hover:-translate-x-0.5">&larr;</span>
          Triage Runs
        </Link>
        <span className="text-xs text-zinc-400">{date}</span>
      </div>

      <div className="mt-4">
        <h1 className="text-2xl font-bold text-zinc-900">
          {run.pr_title || `Run ${run.run_id.slice(0, 8)}`}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          {run.pr_url && (
            <a
              href={run.pr_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 hover:bg-zinc-200 transition-colors"
            >
              PR #{run.pr_url.split("/").pop()}
              <span className="text-[10px] opacity-60">↗</span>
            </a>
          )}
          <div className="flex gap-1.5">
            {Object.entries(counts).map(([cls, count]) => (
              <span key={cls} className="flex items-center gap-1">
                <ClassificationBadge classification={cls} />
                <span className="text-xs text-zinc-500">{count}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {isClosed && (
        <div className="mt-6 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-center">
          <p className="text-sm text-zinc-500">This run has been closed.</p>
        </div>
      )}

      {/* Failure list */}
      <ul className="mt-6 space-y-3">
        {run.results.map((result) => {
          const kf = knownFailures[result.test_name];
          // If an open submission exists from a previous run,
          // treat as action-gated (show link, hide approve/reject)
          const existingSubmission =
            kf?.open_submission && !submitted[result.test_name]
              ? kf.open_submission
              : null;

          // Pre-existing failures (failing on main) are non-actionable
          // on pre-merge runs — they're already tracked on main
          const isPreExisting =
            isPreMerge && kf?.failing_since != null;

          return (
            <li key={result.test_name}>
              <FailureCard
                result={result}
                verdict={verdicts[result.test_name] ?? null}
                onVerdict={(v) => handleVerdict(result.test_name, v)}
                readOnly={isClosed || isPostMerge || isPreExisting}
                submitted={submitted[result.test_name] ?? null}
                knownFailure={kf ?? null}
                actionGated={existingSubmission !== null}
                existingSubmission={existingSubmission}
                isPreMerge={isPreMerge}
              />
            </li>
          );
        })}
      </ul>

      {/* Fixed submit bar — sticks to bottom when pending actions exist */}
      {run.repo && !isClosed && !isPostMerge && hasPending && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 backdrop-blur-sm shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
            <div>
              <p className="text-sm font-medium text-zinc-900">
                {pendingApproved.length > 0 &&
                  `${pendingApproved.length} approved`}
                {pendingApproved.length > 0 &&
                  pendingRejected.length > 0 &&
                  ", "}
                {pendingRejected.length > 0 &&
                  `${pendingRejected.length} rejected`}
              </p>
              <p className="mt-0.5 text-xs text-zinc-500">
                {pendingApproved.length > 0 &&
                  (isPreMerge
                    ? "Approved → commit baselines to PR"
                    : "Approved → baseline update PR")}
                {pendingApproved.length > 0 &&
                  pendingRejected.length > 0 &&
                  " · "}
                {pendingRejected.length > 0 && "Rejected → GitHub issues"}
              </p>
            </div>
            <button
              onClick={handleSubmitChanges}
              disabled={submitStatus === "loading"}
              className="rounded-md bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50"
            >
              {submitStatus === "loading"
                ? "Submitting..."
                : "Submit Changes"}
            </button>
          </div>
          {submitStatus === "error" && submitError && (
            <div className="mx-auto max-w-5xl px-6 pb-2">
              <p className="text-xs text-rose-600">{submitError}</p>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
