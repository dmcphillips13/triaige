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
const RUNNER_API_KEY = process.env.RUNNER_API_KEY || "";

function authHeaders(): HeadersInit {
  if (!RUNNER_API_KEY) return {};
  return { Authorization: `Bearer ${RUNNER_API_KEY}` };
}

/** Fetch all triage runs (summary only, no individual results). */
export async function fetchRuns(): Promise<TriageRunSummary[]> {
  const res = await fetch(`${RUNNER_BASE}/runs`, {
    cache: "no-store",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to fetch runs: ${res.status}`);
  return res.json();
}

/** Fetch a single triage run with full failure results. */
export async function fetchRun(runId: string): Promise<TriageRunResponse> {
  const res = await fetch(`${RUNNER_BASE}/runs/${runId}`, {
    cache: "no-store",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to fetch run: ${res.status}`);
  return res.json();
}

/** Submit human feedback to the runner for episodic memory storage.
 *  Called from the client via the /api/runner proxy. */
export async function submitFeedback(
  runId: string,
  testName: string,
  verdict: "approved" | "rejected"
): Promise<void> {
  await fetch("/api/runner/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ run_id: runId, test_name: testName, verdict }),
  });
}

/** Create a PR updating baseline screenshots for approved failures.
 *  Called from the client via the /api/runner proxy. */
export async function updateBaselines(
  runId: string,
  testNames: string[],
  repo: string
): Promise<{ pr_url: string }> {
  const res = await fetch("/api/runner/update-baselines", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ run_id: runId, test_names: testNames, repo }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(err.detail || `Failed: ${res.status}`);
  }
  return res.json();
}
