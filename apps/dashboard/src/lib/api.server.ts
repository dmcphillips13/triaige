// Server-side data fetching helpers for the runner API.
//
// These call the runner directly using RUNNER_BASE_URL (server-side env var),
// bypassing the /api/runner proxy. This is safe because these functions only
// run in Next.js server components, which execute on the server.
//
// Separated from api.ts because this file imports next/headers (via auth.ts),
// which cannot be bundled into client components.

import "server-only";

import type { TriageRunResponse, TriageRunSummary } from "./types";
import { getGitHubToken } from "./auth";

const RUNNER_BASE = process.env.RUNNER_BASE_URL || "http://localhost:8000";
const RUNNER_API_KEY = process.env.RUNNER_API_KEY || "";

async function authHeaders(): Promise<HeadersInit> {
  const headers: Record<string, string> = {};
  if (RUNNER_API_KEY) {
    headers["Authorization"] = `Bearer ${RUNNER_API_KEY}`;
  }
  const ghToken = await getGitHubToken();
  if (ghToken) {
    headers["X-GitHub-Token"] = ghToken;
  }
  return headers;
}

/** Fetch all triage runs (summary only, no individual results). */
export async function fetchRuns(): Promise<TriageRunSummary[]> {
  const res = await fetch(`${RUNNER_BASE}/runs`, {
    cache: "no-store",
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to fetch runs: ${res.status}`);
  return res.json();
}

/** Fetch a single triage run with full failure results. */
export async function fetchRun(runId: string): Promise<TriageRunResponse> {
  const res = await fetch(`${RUNNER_BASE}/runs/${runId}`, {
    cache: "no-store",
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to fetch run: ${res.status}`);
  return res.json();
}
