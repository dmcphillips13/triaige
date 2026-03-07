// Run detail page — async server component that fetches a single triage run
// by ID and passes it to the RunDetail client component.
//
// Server/client split: this page fetches data server-side (using RUNNER_BASE_URL),
// then RunDetail handles client-side interactivity (approve/reject, expand/collapse).

import { fetchRun } from "@/lib/api";
import { RunDetail } from "./run-detail";

export default async function RunDetailPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;

  let run;
  try {
    run = await fetchRun(runId);
  } catch {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-2xl font-bold text-zinc-900">Run not found</h1>
        <p className="mt-4 text-zinc-500">
          Could not load this run. It may not exist or the runner may be
          offline.
        </p>
      </div>
    );
  }

  return <RunDetail run={run} />;
}
