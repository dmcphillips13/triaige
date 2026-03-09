// Client component for run detail — manages human approve/reject verdict state
// and renders the list of failure cards.
//
// Verdict state is loaded from localStorage on mount and synced back on change.
// This component owns the verdict state for all failures in the run and passes
// individual verdicts + callbacks down to each FailureCard.
//
// Props:
//   run — full TriageRunResponse from the server component parent.

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ClassificationBadge } from "@/components/classification-badge";
import type { HumanVerdict, TriageRunResponse } from "@/lib/types";
import { getVerdict, setVerdict } from "@/lib/verdicts";
import { updateBaselines } from "@/lib/api";
import { FailureCard } from "./failure-card";

export function RunDetail({ run }: { run: TriageRunResponse }) {
  const [verdicts, setVerdicts] = useState<Record<string, HumanVerdict>>({});
  const [baselineStatus, setBaselineStatus] = useState<
    "idle" | "loading" | "done" | "error"
  >("idle");
  const [baselinePrUrl, setBaselinePrUrl] = useState<string | null>(null);
  const [baselineError, setBaselineError] = useState<string | null>(null);

  // Load verdicts from localStorage on mount
  useEffect(() => {
    const loaded: Record<string, HumanVerdict> = {};
    for (const r of run.results) {
      loaded[r.test_name] = getVerdict(run.run_id, r.test_name);
    }
    setVerdicts(loaded);
  }, [run]);

  const handleVerdict = useCallback(
    (testName: string, verdict: HumanVerdict) => {
      setVerdict(run.run_id, testName, verdict);
      setVerdicts((prev) => ({ ...prev, [testName]: verdict }));
    },
    [run.run_id]
  );

  // Approved failures that have screenshots and a snapshot path
  const approvedBaselines = run.results.filter(
    (r) =>
      verdicts[r.test_name] === "approved" &&
      r.screenshot_actual &&
      r.snapshot_path
  );

  const handleUpdateBaselines = async () => {
    if (!run.repo || approvedBaselines.length === 0) return;
    setBaselineStatus("loading");
    setBaselineError(null);
    try {
      const { pr_url } = await updateBaselines(
        run.run_id,
        approvedBaselines.map((r) => r.test_name),
        run.repo
      );
      setBaselinePrUrl(pr_url);
      setBaselineStatus("done");
    } catch (err) {
      setBaselineError(err instanceof Error ? err.message : "Failed to create PR");
      setBaselineStatus("error");
    }
  };

  const isPreMerge = run.triage_mode === "pre_merge";
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
            />
          </li>
        ))}
      </ul>

      {/* Update Baselines button — only for post-merge runs */}
      {run.repo && approvedBaselines.length > 0 && baselineStatus !== "done" && !isPreMerge && (
        <div className="mt-8 rounded-lg border border-zinc-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-900">
                {approvedBaselines.length} approved baseline
                {approvedBaselines.length !== 1 && "s"} ready to update
              </p>
              <p className="mt-0.5 text-xs text-zinc-500">
                Creates a PR in {run.repo} with the new screenshots
              </p>
            </div>
            <button
              onClick={handleUpdateBaselines}
              disabled={baselineStatus === "loading"}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50"
            >
              {baselineStatus === "loading"
                ? "Creating PR..."
                : "Update Baselines"}
            </button>
          </div>
          {baselineStatus === "error" && baselineError && (
            <p className="mt-2 text-xs text-red-600">{baselineError}</p>
          )}
        </div>
      )}

      {/* Baseline PR link */}
      {baselineStatus === "done" && baselinePrUrl && (
        <div className="mt-8 rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="text-sm font-medium text-green-900">
            Baseline update PR created
          </p>
          <a
            href={baselinePrUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block text-sm text-green-700 hover:underline"
          >
            {baselinePrUrl}
          </a>
        </div>
      )}
    </div>
  );
}
