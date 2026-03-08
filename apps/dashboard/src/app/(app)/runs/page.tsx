// Runs list page — async server component that fetches all triage runs from
// the runner and displays them as summary cards.
//
// Each card shows: truncated run ID, timestamp, failure count, and a breakdown
// of classifications as colored badges. Cards link to /runs/[runId] for detail.
//
// Handles two edge cases: runner offline (error message) and no runs (empty state).

import Link from "next/link";
import { fetchRuns } from "@/lib/api";
import { ClassificationBadge } from "@/components/classification-badge";

export default async function RunsPage() {
  let runs;
  try {
    runs = await fetchRuns();
  } catch {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-2xl font-bold text-zinc-900">Triage Runs</h1>
        <p className="mt-4 text-zinc-500">
          Could not connect to the runner service. Make sure it is running.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900">Triage Runs</h1>
        <Link
          href="/"
          className="text-sm text-zinc-500 hover:text-zinc-700"
        >
          Home
        </Link>
      </div>

      {runs.length === 0 ? (
        <p className="mt-8 text-center text-zinc-500">No triage runs found.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {runs.map((run) => {
            const date = new Date(run.created_at).toLocaleString();
            return (
              <li key={run.run_id}>
                <Link
                  href={`/runs/${run.run_id}`}
                  className="block rounded-lg border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-900 font-medium truncate">
                      {run.pr_title || run.run_id.slice(0, 8)}
                    </span>
                    <span className="shrink-0 text-sm text-zinc-400">{date}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <span className="text-sm font-medium text-zinc-900">
                      {run.total_failures} failure{run.total_failures !== 1 && "s"}
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
    </div>
  );
}
