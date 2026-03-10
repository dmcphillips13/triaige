// Client component for run detail — manages human approve/reject verdict state
// and renders the list of failure cards.
//
// Verdicts and submissions are persisted in Postgres via the runner API.
// "Submit Changes" processes all verdicted failures:
//   - Approved → baseline update PR (batched into one PR)
//   - Rejected → GitHub issues (one per failure)
// After submission, each failure shows its link and is disabled.

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ClassificationBadge } from "@/components/classification-badge";
import type { HumanVerdict, SubmissionResult, TriageRunResponse } from "@/lib/types";
import {
  fetchVerdicts,
  fetchSubmissions,
  submitFeedback,
  putVerdict,
  putSubmission,
  updateBaselines,
  createIssues,
  closeRun,
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

  // Load verdicts and submissions from the API on mount
  useEffect(() => {
    fetchVerdicts(run.run_id).then((v) => {
      const mapped: Record<string, HumanVerdict> = {};
      for (const r of run.results) {
        mapped[r.test_name] = (v[r.test_name] as HumanVerdict) ?? null;
      }
      setVerdicts(mapped);
    });
    fetchSubmissions(run.run_id).then(setSubmitted);
  }, [run]);

  const handleVerdict = useCallback(
    (testName: string, verdict: HumanVerdict) => {
      setVerdicts((prev) => ({ ...prev, [testName]: verdict }));
      if (verdict) {
        // Persist verdict in Postgres and store episode in Qdrant (both fire-and-forget)
        putVerdict(run.run_id, testName, verdict).catch(() => {});
        submitFeedback(run.run_id, testName, verdict).catch(() => {});
      }
    },
    [run.run_id]
  );

  const isPreMerge = run.triage_mode === "pre_merge";

  // Failures ready to submit (have a verdict and haven't been submitted yet)
  const pendingApproved = run.results.filter(
    (r) =>
      verdicts[r.test_name] === "approved" &&
      !submitted[r.test_name] &&
      r.screenshot_actual &&
      r.snapshot_path
  );
  const pendingRejected = run.results.filter(
    (r) => verdicts[r.test_name] === "rejected" && !submitted[r.test_name]
  );
  const hasPending = pendingApproved.length > 0 || pendingRejected.length > 0;

  const handleSubmitChanges = async () => {
    if (!run.repo || !hasPending) return;
    setSubmitStatus("loading");
    setSubmitError(null);

    const newSubmitted: Record<string, SubmissionResult> = {};

    try {
      // Process approved failures → baseline PR
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

      // Process rejected failures → GitHub issues
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

      // Persist submissions in Postgres
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

  // Classification summary counts
  const counts: Record<string, number> = {};
  for (const r of run.results) {
    const cls = r.ask_response.classification;
    counts[cls] = (counts[cls] || 0) + 1;
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link
          href="/runs"
          className="text-sm text-zinc-500 hover:text-zinc-700"
        >
          &larr; All Runs
        </Link>
        <span className="text-sm text-zinc-400">{date}</span>
      </div>

      <div className="mt-4">
        <h1 className="text-2xl font-bold text-zinc-900">
          {run.pr_title || `Run ${run.run_id.slice(0, 8)}`}
        </h1>
        {run.pr_url && (
          <a
            href={run.pr_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block text-sm text-blue-600 hover:underline"
          >
            View PR &rarr;
          </a>
        )}
        <div className="mt-2 flex items-center gap-3">
          <span className="text-sm text-zinc-600">
            {run.total_failures} failure{run.total_failures !== 1 && "s"}
          </span>
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

      {/* Failure list */}
      <ul className="mt-6 space-y-3">
        {run.results.map((result) => (
          <li key={result.test_name}>
            <FailureCard
              result={result}
              verdict={verdicts[result.test_name] ?? null}
              onVerdict={(v) => handleVerdict(result.test_name, v)}
              readOnly={isPreMerge}
              submitted={submitted[result.test_name] ?? null}
            />
          </li>
        ))}
      </ul>

      {/* Submit Changes button — only for post-merge runs */}
      {run.repo && !isPreMerge && hasPending && (
        <div className="mt-8 rounded-lg border border-zinc-200 bg-white p-4">
          <div className="flex items-center justify-between">
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
                {pendingApproved.length > 0 && "Approved → baseline update PR"}
                {pendingApproved.length > 0 &&
                  pendingRejected.length > 0 &&
                  " · "}
                {pendingRejected.length > 0 && "Rejected → GitHub issues"}
              </p>
            </div>
            <button
              onClick={handleSubmitChanges}
              disabled={submitStatus === "loading"}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50"
            >
              {submitStatus === "loading"
                ? "Submitting..."
                : "Submit Changes"}
            </button>
          </div>
          {submitStatus === "error" && submitError && (
            <p className="mt-2 text-xs text-red-600">{submitError}</p>
          )}
        </div>
      )}

      {/* Close Run */}
      {!isPreMerge && !isClosed && (
        <div className="mt-8 flex justify-end">
          <button
            onClick={async () => {
              try {
                await closeRun(run.run_id);
                setIsClosed(true);
              } catch {
                // ignore
              }
            }}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            Close Run
          </button>
        </div>
      )}

      {isClosed && (
        <div className="mt-8 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-center">
          <p className="text-sm text-zinc-500">This run has been closed.</p>
        </div>
      )}
    </div>
  );
}
