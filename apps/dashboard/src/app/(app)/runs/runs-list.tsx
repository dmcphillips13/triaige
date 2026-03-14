// Runs list with PR / Main / Closed tabs.
//
// PR (default): pre-merge runs from open PRs — primary workspace for triage
// Main: known failures health dashboard — open issues on failing tests
// Closed: auto-closed or manually closed runs

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ClassificationBadge } from "@/components/classification-badge";
import { fetchRepoKnownFailures, closeKnownFailure } from "@/lib/api";
import type { TriageRunSummary } from "@/lib/types";

type Tab = "pr" | "main" | "closed";

interface KnownFailure {
  id: number;
  test_name: string;
  issue_url: string;
  issue_number: number;
  screenshot_base64: string | null;
  created_at: string;
}

export function RunsList({ runs }: { runs: TriageRunSummary[] }) {
  const [tab, setTab] = useState<Tab>("pr");
  const [knownFailures, setKnownFailures] = useState<KnownFailure[]>([]);
  const [loadingKnown, setLoadingKnown] = useState(false);
  const [closingId, setClosingId] = useState<number | null>(null);

  const prRuns = runs.filter(
    (r) => r.triage_mode === "pre_merge" && !r.closed
  );
  const closedRuns = runs.filter((r) => r.closed);

  // Load known failures when Main tab is selected
  useEffect(() => {
    if (tab !== "main") return;
    const repo = localStorage.getItem("triaige:linked_repo");
    if (!repo) return;
    setLoadingKnown(true);
    fetchRepoKnownFailures(repo)
      .then(setKnownFailures)
      .catch(() => setKnownFailures([]))
      .finally(() => setLoadingKnown(false));
  }, [tab]);

  const handleCloseKnownFailure = async (failure: KnownFailure) => {
    const repo = localStorage.getItem("triaige:linked_repo");
    if (!repo) return;
    setClosingId(failure.id);
    try {
      await closeKnownFailure(repo, failure.id);
      setKnownFailures((prev) => prev.filter((f) => f.id !== failure.id));
    } catch (e) {
      console.error("Failed to close known failure:", e);
    } finally {
      setClosingId(null);
    }
  };

  const tabItems = [
    { key: "pr" as Tab, label: "PR", count: prRuns.length },
    { key: "main" as Tab, label: "Main", count: knownFailures.length },
    { key: "closed" as Tab, label: "Closed", count: closedRuns.length },
  ];

  return (
    <>
      <div className="mt-6 flex gap-1 border-b border-zinc-200">
        {tabItems.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? "border-b-2 border-zinc-900 text-zinc-900"
                : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            {t.label}
            {t.count > 0 && ` (${t.count})`}
          </button>
        ))}
      </div>

      {tab === "main" ? (
        <MainTab
          knownFailures={knownFailures}
          loading={loadingKnown}
          closingId={closingId}
          onClose={handleCloseKnownFailure}
        />
      ) : (
        <RunsTab
          runs={tab === "pr" ? prRuns : closedRuns}
          emptyMessage={tab === "pr" ? "No PR runs." : "No closed runs."}
        />
      )}
    </>
  );
}

function MainTab({
  knownFailures,
  loading,
  closingId,
  onClose,
}: {
  knownFailures: KnownFailure[];
  loading: boolean;
  closingId: number | null;
  onClose: (f: KnownFailure) => void;
}) {
  if (loading) {
    return (
      <p className="mt-8 text-center text-zinc-500">Loading...</p>
    );
  }

  if (knownFailures.length === 0) {
    return (
      <p className="mt-8 text-center text-zinc-500">
        No known failures. All baselines are passing.
      </p>
    );
  }

  return (
    <ul className="mt-4 space-y-3">
      {knownFailures.map((failure) => {
        const date = new Date(failure.created_at).toLocaleString();
        return (
          <li key={failure.id}>
            <div className="rounded-lg border border-zinc-200 bg-white shadow-sm overflow-hidden">
              {/* Screenshot */}
              {failure.screenshot_base64 && (
                <div className="border-b border-zinc-100 bg-zinc-50 p-3">
                  <img
                    src={`data:image/png;base64,${failure.screenshot_base64}`}
                    alt={failure.test_name}
                    className="mx-auto max-h-48 rounded border border-zinc-200 object-contain"
                  />
                </div>
              )}

              <div className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-zinc-900">
                    {failure.test_name}
                  </span>
                  <span className="shrink-0 text-xs text-zinc-400">
                    {date}
                  </span>
                </div>

                <div className="mt-2 flex items-center justify-between">
                  <a
                    href={failure.issue_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-rose-700 hover:underline"
                  >
                    <span className="inline-block h-2 w-2 rounded-full bg-rose-500" />
                    Issue #{failure.issue_number}
                    <span className="text-[10px] opacity-60">&rarr;</span>
                  </a>

                  <button
                    onClick={() => onClose(failure)}
                    disabled={closingId === failure.id}
                    className="rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50"
                  >
                    {closingId === failure.id ? "Closing..." : "Close"}
                  </button>
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function RunsTab({
  runs,
  emptyMessage,
}: {
  runs: TriageRunSummary[];
  emptyMessage: string;
}) {
  if (runs.length === 0) {
    return (
      <p className="mt-8 text-center text-zinc-500">{emptyMessage}</p>
    );
  }

  return (
    <ul className="mt-4 space-y-3">
      {runs.map((run) => {
        const date = new Date(run.created_at).toLocaleString();
        return (
          <li key={run.run_id}>
            <Link
              href={`/runs/${run.run_id}`}
              className="block rounded-lg border border-zinc-200 bg-white shadow-sm p-4 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-zinc-900 truncate">
                  {run.pr_title || run.run_id.slice(0, 8)}
                </span>
                <span className="shrink-0 text-sm text-zinc-400">
                  {date}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <span className="text-sm font-medium text-zinc-900">
                  {run.total_failures} failure
                  {run.total_failures !== 1 && "s"}
                </span>
                <div className="flex gap-1.5">
                  {Object.entries(run.classifications).map(
                    ([cls, count]) => (
                      <span key={cls} className="flex items-center gap-1">
                        <ClassificationBadge classification={cls} />
                        <span className="text-xs text-zinc-500">
                          {count}
                        </span>
                      </span>
                    )
                  )}
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
