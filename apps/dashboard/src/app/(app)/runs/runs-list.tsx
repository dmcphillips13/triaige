// Runs list with PR / Issues / Closed Runs / Closed Issues tabs.
//
// PR (default): pre-merge runs from open PRs — primary workspace for triage
// Issues: known failures health dashboard — open issues on failing tests
// Closed Runs: auto-closed or manually closed runs
// Closed Issues: closed known failures

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ClassificationBadge } from "@/components/classification-badge";
import { ScreenshotViewer } from "@/components/screenshot-viewer";
import { RunCardSkeleton } from "@/components/skeleton";
import {
  fetchRuns,
  fetchRepoKnownFailures,
  fetchClosedKnownFailures,
  closeKnownFailure,
} from "@/lib/api";
import { useTriaigeEvents } from "@/hooks/use-triaige-events";
import type { TriageRunSummary } from "@/lib/types";

type Tab = "pr" | "issues" | "closed_runs" | "closed_issues";

const HASH_TO_TAB: Record<string, Tab> = {
  "#pr": "pr",
  "#issues": "issues",
  "#closed-runs": "closed_runs",
  "#closed-issues": "closed_issues",
};

const TAB_TO_HASH: Record<Tab, string> = {
  pr: "#pr",
  issues: "#issues",
  closed_runs: "#closed-runs",
  closed_issues: "#closed-issues",
};

function getInitialTab(): Tab {
  if (typeof window === "undefined") return "pr";
  return HASH_TO_TAB[window.location.hash] || "pr";
}

interface KnownFailure {
  id: number;
  test_name: string;
  issue_url: string;
  issue_number: number;
  screenshot_base64: string | null;
  screenshot_baseline: string | null;
  created_at: string;
}

interface ClosedKnownFailure {
  id: number;
  test_name: string;
  issue_url: string;
  issue_number: number;
  screenshot_base64: string | null;
  screenshot_baseline: string | null;
  created_at: string;
  closed_at: string;
}

export function RunsList({
  runs,
  repo,
}: {
  runs: TriageRunSummary[];
  repo?: string;
}) {
  const [tab, setTab] = useState<Tab>(getInitialTab);
  const [liveRuns, setLiveRuns] = useState(runs);
  const [knownFailures, setKnownFailures] = useState<KnownFailure[]>([]);
  const [closedKnownFailures, setClosedKnownFailures] = useState<
    ClosedKnownFailure[]
  >([]);
  const [loadingKnown, setLoadingKnown] = useState(false);
  const [loadingClosedKnown, setLoadingClosedKnown] = useState(false);
  const [closingId, setClosingId] = useState<number | null>(null);

  // Refetch runs from API on SSE events
  const refetchRuns = useCallback(() => {
    fetchRuns().then((fresh) => {
      if (fresh.length > 0) setLiveRuns(fresh);
    });
  }, []);

  useTriaigeEvents(
    useCallback(
      (event) => {
        if (!repo || event.repo === repo) {
          refetchRuns();
        }
      },
      [repo, refetchRuns]
    )
  );

  // Filter runs by repo when scoped
  const scopedRuns = repo
    ? liveRuns.filter((r) => r.repo === repo)
    : liveRuns;

  const prRuns = scopedRuns.filter(
    (r) => r.triage_mode === "pre_merge" && !r.closed
  );
  const closedRuns = scopedRuns.filter((r) => r.closed);

  // Repo is always provided via ?repo= query param (page redirects without it)
  const derivedRepo = repo || null;

  const handleTabChange = (newTab: Tab) => {
    setTab(newTab);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", TAB_TO_HASH[newTab]);
    }
  };

  // Load known failures eagerly on mount (for tab counts) and refetch when tab is active
  useEffect(() => {
    if (!derivedRepo) return;
    // Always fetch on mount; refetch when switching to the Issues tab
    if (knownFailures.length === 0 || tab === "issues") {
      setLoadingKnown(true);
      fetchRepoKnownFailures(derivedRepo)
        .then(setKnownFailures)
        .catch(() => setKnownFailures([]))
        .finally(() => setLoadingKnown(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, derivedRepo]);

  // Load closed known failures eagerly on mount and refetch when tab is active
  useEffect(() => {
    if (!derivedRepo) return;
    if (closedKnownFailures.length === 0 || tab === "closed_issues") {
      setLoadingClosedKnown(true);
      fetchClosedKnownFailures(derivedRepo)
        .then(setClosedKnownFailures)
        .catch(() => setClosedKnownFailures([]))
        .finally(() => setLoadingClosedKnown(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, derivedRepo]);

  const handleCloseKnownFailure = async (failure: KnownFailure) => {
    if (!derivedRepo) return;
    setClosingId(failure.id);
    try {
      await closeKnownFailure(derivedRepo, failure.id);
      setKnownFailures((prev) => prev.filter((f) => f.id !== failure.id));
    } catch (e) {
      console.error("Failed to close known failure:", e);
    } finally {
      setClosingId(null);
    }
  };

  const tabItems = [
    { key: "pr" as Tab, label: "PR", count: prRuns.length, showCount: true },
    { key: "issues" as Tab, label: "Issues", count: knownFailures.length, showCount: true },
    { key: "closed_runs" as Tab, label: "Closed Runs", count: closedRuns.length, showCount: true },
    { key: "closed_issues" as Tab, label: "Closed Issues", count: closedKnownFailures.length, showCount: true },
  ];

  return (
    <>
      <div className="mt-6 flex border-b border-zinc-200">
        {tabItems.map((t) => (
          <button
            key={t.key}
            onClick={() => handleTabChange(t.key)}
            className={`flex-1 px-3 py-2 text-center text-sm font-medium transition-colors ${
              tab === t.key
                ? "border-b-2 border-zinc-900 text-zinc-900"
                : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            {t.label}
            {t.showCount && t.count > 0 && ` (${t.count})`}
          </button>
        ))}
      </div>

      {tab === "issues" ? (
        <IssuesTab
          knownFailures={knownFailures}
          loading={loadingKnown}
          closingId={closingId}
          onClose={handleCloseKnownFailure}
        />
      ) : tab === "closed_issues" ? (
        <ClosedIssuesTab
          closedKnownFailures={closedKnownFailures}
          loading={loadingClosedKnown}
        />
      ) : (
        <RunsTab
          runs={tab === "pr" ? prRuns : closedRuns}
          emptyMessage={
            tab === "pr"
              ? "No open PR runs. Triage runs appear here when a PR triggers visual regression tests."
              : "No closed runs yet. Runs move here after being merged or manually closed."
          }
        />
      )}
    </>
  );
}

function IssuesTab({
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
      <ul className="mt-4 space-y-3">
        {[1, 2, 3].map((i) => (
          <li key={i}><RunCardSkeleton /></li>
        ))}
      </ul>
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
              {/* Screenshot comparison or single screenshot fallback */}
              {failure.screenshot_baseline && failure.screenshot_base64 ? (
                <div className="border-b border-zinc-100 px-4 py-4">
                  <ScreenshotViewer
                    baseline={failure.screenshot_baseline}
                    actual={failure.screenshot_base64}
                  />
                </div>
              ) : failure.screenshot_base64 ? (
                <div className="border-b border-zinc-100 bg-zinc-50 p-3">
                  <img
                    src={`data:image/png;base64,${failure.screenshot_base64}`}
                    alt={failure.test_name}
                    className="mx-auto max-h-48 rounded border border-zinc-200 object-contain"
                  />
                </div>
              ) : null}

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

function ClosedIssuesTab({
  closedKnownFailures,
  loading,
}: {
  closedKnownFailures: ClosedKnownFailure[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <ul className="mt-4 space-y-3">
        {[1, 2, 3].map((i) => (
          <li key={i}><RunCardSkeleton /></li>
        ))}
      </ul>
    );
  }

  if (closedKnownFailures.length === 0) {
    return (
      <p className="mt-8 text-center text-zinc-500">
        No closed issues yet. Issues move here when resolved.
      </p>
    );
  }

  return (
    <ul className="mt-4 space-y-3">
      {closedKnownFailures.map((failure) => {
        const closedDate = new Date(failure.closed_at).toLocaleString();
        return (
          <li key={failure.id}>
            <div className="rounded-lg border border-zinc-200 bg-white shadow-sm overflow-hidden">
              {/* Issue link bar */}
              <div className="flex items-center gap-2 bg-zinc-50 px-4 py-2">
                <a
                  href={failure.issue_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-zinc-500 hover:underline"
                >
                  Issue #{failure.issue_number} — closed
                </a>
              </div>

              {/* Screenshot */}
              {failure.screenshot_base64 && (
                <div className="border-t border-zinc-100 bg-zinc-50 p-3">
                  <img
                    src={`data:image/png;base64,${failure.screenshot_base64}`}
                    alt={failure.test_name}
                    className="mx-auto max-h-48 rounded border border-zinc-200 object-contain"
                  />
                </div>
              )}

              <div className="border-t border-zinc-100 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-zinc-900">
                    {failure.test_name}
                  </span>
                  <span className="shrink-0 text-xs text-zinc-400">
                    Closed {closedDate}
                  </span>
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
      <p className="mt-8 text-center text-sm text-zinc-400">{emptyMessage}</p>
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
              className="block rounded-lg border border-zinc-200 bg-white shadow-sm p-4 transition-all hover:border-zinc-300 hover:shadow-md"
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
                {run.gate_status === "action_required" && (
                  <span className="ml-auto rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                    Action required
                  </span>
                )}
                {run.gate_status === "ready_to_merge" && (
                  <span className="ml-auto rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                    Ready to merge
                  </span>
                )}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
