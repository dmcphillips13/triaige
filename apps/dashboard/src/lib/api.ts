// Client-side API helpers for the runner.
//
// These call the /api/runner proxy (not the runner directly), so they work
// from the browser. The proxy handles auth (API key + GitHub token forwarding).

import type { SubmissionResult } from "./types";

/** Submit human feedback to the runner for episodic memory storage. */
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

/** Store a human verdict for a failure in Postgres. */
export async function putVerdict(
  runId: string,
  testName: string,
  verdict: "approved" | "rejected"
): Promise<void> {
  await fetch(
    `/api/runner/runs/${runId}/failures/${encodeURIComponent(testName)}/verdict`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verdict }),
    }
  );
}

/** Fetch all verdicts for a run from Postgres. */
export async function fetchVerdicts(
  runId: string
): Promise<Record<string, string>> {
  const res = await fetch(`/api/runner/runs/${runId}/verdicts`);
  if (!res.ok) return {};
  return res.json();
}

/** Store a submission result for a failure in Postgres. */
export async function putSubmission(
  runId: string,
  testName: string,
  url: string,
  type: "pr" | "issue"
): Promise<void> {
  await fetch(
    `/api/runner/runs/${runId}/failures/${encodeURIComponent(testName)}/submission`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, type }),
    }
  );
}

/** Fetch all submissions for a run from Postgres. */
export async function fetchSubmissions(
  runId: string
): Promise<Record<string, SubmissionResult>> {
  const res = await fetch(`/api/runner/runs/${runId}/submissions`);
  if (!res.ok) return {};
  return res.json();
}

/** Create a PR updating baseline screenshots for approved failures. */
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

/** Mark a triage run as closed. */
export async function closeRun(runId: string): Promise<void> {
  const res = await fetch(`/api/runner/runs/${runId}/close`, {
    method: "PATCH",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(err.detail || `Failed: ${res.status}`);
  }
}

/** Create GitHub issues for rejected visual regression failures. */
export async function createIssues(
  runId: string,
  testNames: string[],
  repo: string
): Promise<{ issues: { test_name: string; issue_url: string }[] }> {
  const res = await fetch("/api/runner/create-issues", {
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
