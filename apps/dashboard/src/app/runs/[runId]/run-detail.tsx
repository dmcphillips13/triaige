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
import { FailureCard } from "./failure-card";

export function RunDetail({ run }: { run: TriageRunResponse }) {
  const [verdicts, setVerdicts] = useState<Record<string, HumanVerdict>>({});

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
          Run {run.run_id.slice(0, 8)}
        </h1>
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
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
