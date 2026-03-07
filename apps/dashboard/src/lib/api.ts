// Server-side data fetching helpers for the runner API.
//
// These call the runner directly using RUNNER_BASE_URL (server-side env var),
// bypassing the /api/runner proxy. This is safe because these functions only
// run in Next.js server components, which execute on the server.
//
// The proxy at /api/runner/[...path]/route.ts exists for client-side fetches
// where the browser can't access RUNNER_BASE_URL directly.
//
// All fetches use { cache: "no-store" } because triage data is dynamic.

import type { TriageRunResponse, TriageRunSummary } from "./types";

const RUNNER_BASE = process.env.RUNNER_BASE_URL || "http://localhost:8000";

/** Fetch all triage runs (summary only, no individual results). */
export async function fetchRuns(): Promise<TriageRunSummary[]> {
  const res = await fetch(`${RUNNER_BASE}/runs`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch runs: ${res.status}`);
  return res.json();
}

/** Fetch a single triage run with full failure results. */
export async function fetchRun(runId: string): Promise<TriageRunResponse> {
  const res = await fetch(`${RUNNER_BASE}/runs/${runId}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch run: ${res.status}`);
  return res.json();
}
