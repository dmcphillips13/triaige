// Runs list with PR / Main / Closed tabs.
//
// PR (default): pre-merge runs from open PRs — primary workspace for triage
// Main: post-merge runs on main branch — diagnostic health dashboard
// Closed: auto-closed or manually closed runs

"use client";

import { useState } from "react";
import Link from "next/link";
import { ClassificationBadge } from "@/components/classification-badge";
import type { TriageRunSummary } from "@/lib/types";

type Tab = "pr" | "main" | "closed";

export function RunsList({ runs }: { runs: TriageRunSummary[] }) {
  const [tab, setTab] = useState<Tab>("pr");

  const mainRuns = runs.filter(
    (r) => r.triage_mode !== "pre_merge" && !r.closed
  );
  const prRuns = runs.filter(
    (r) => r.triage_mode === "pre_merge" && !r.closed
  );
  const closedRuns = runs.filter((r) => r.closed);

  const tabs: { key: Tab; label: string; runs: TriageRunSummary[] }[] = [
    { key: "pr", label: "PR", runs: prRuns },
    { key: "main", label: "Main", runs: mainRuns },
    { key: "closed", label: "Closed", runs: closedRuns },
  ];

  const displayed = tabs.find((t) => t.key === tab)!.runs;

  const emptyMessages: Record<Tab, string> = {
    main: "No runs on main.",
    pr: "No PR runs.",
    closed: "No closed runs.",
  };

  return (
    <>
      <div className="mt-6 flex gap-1 border-b border-zinc-200">
        {tabs.map((t) => (
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
            {t.runs.length > 0 && ` (${t.runs.length})`}
          </button>
        ))}
      </div>

      {displayed.length === 0 ? (
        <p className="mt-8 text-center text-zinc-500">
          {emptyMessages[tab]}
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {displayed.map((run) => {
            const date = new Date(run.created_at).toLocaleString();
            return (
              <li key={run.run_id}>
                <Link
                  href={`/runs/${run.run_id}`}
                  className="block rounded-lg border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
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
      )}
    </>
  );
}
