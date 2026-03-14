// Runs list page — async server component that fetches all triage runs from
// the runner and passes them to a client component with Open/Closed tabs.

import { fetchRuns } from "@/lib/api.server";
import { RunsList } from "./runs-list";

export default async function RunsPage() {
  let runs;
  try {
    runs = await fetchRuns();
  } catch {
    return (
      <div className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="text-2xl font-bold text-zinc-900">Triage Runs</h1>
        <p className="mt-4 text-zinc-500">
          Could not connect to the runner service. Make sure it is running.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-2xl font-bold text-zinc-900">Triage Runs</h1>

      {runs.length === 0 ? (
        <p className="mt-8 text-center text-zinc-500">No triage runs found.</p>
      ) : (
        <RunsList runs={runs} />
      )}
    </div>
  );
}
