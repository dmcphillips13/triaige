// Client-side API helpers for the runner.
//
// These call the /api/runner proxy (not the runner directly), so they work
// from the browser. The proxy handles auth (API key + GitHub token forwarding).

import type { SubmissionResult } from "./types";

/** Fetch all triage runs (client-side, for live updates). */
export async function fetchRuns(): Promise<
  {
    run_id: string;
    repo: string;
    total_failures: number;
    classifications: Record<string, number>;
    created_at: string;
    closed: boolean;
    triage_mode: string;
    pr_title: string | null;
    gate_status: string | null;
  }[]
> {
  const res = await fetch("/api/runner/runs");
  if (!res.ok) return [];
  return res.json();
}

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

/** Fetch known failure context for a run (failing since, open submissions). */
export async function fetchKnownFailures(
  runId: string
): Promise<
  Record<
    string,
    {
      failing_since: {
        run_id: string;
        pr_title: string | null;
        pr_url: string | null;
        created_at: string;
      } | null;
      open_submission: { url: string; type: "pr" | "issue" } | null;
    }
  >
> {
  const res = await fetch(`/api/runner/runs/${runId}/known-failures`);
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

/** Fetch open known failures for a repo (Main tab health dashboard). */
export async function fetchRepoKnownFailures(
  repo: string
): Promise<
  {
    id: number;
    test_name: string;
    issue_url: string;
    issue_number: number;
    screenshot_base64: string | null;
    created_at: string;
  }[]
> {
  const res = await fetch(
    `/api/runner/repos/${encodeURIComponent(repo)}/known-failures`
  );
  if (!res.ok) return [];
  return res.json();
}

/** Fetch closed known failures for a repo. */
export async function fetchClosedKnownFailures(
  repo: string
): Promise<
  {
    id: number;
    test_name: string;
    issue_url: string;
    issue_number: number;
    screenshot_base64: string | null;
    created_at: string;
    closed_at: string;
  }[]
> {
  const res = await fetch(
    `/api/runner/repos/${encodeURIComponent(repo)}/known-failures/closed`
  );
  if (!res.ok) return [];
  return res.json();
}

/** Close a known failure and its GitHub issue. */
export async function closeKnownFailure(
  repo: string,
  failureId: number
): Promise<void> {
  const res = await fetch(
    `/api/runner/repos/${encodeURIComponent(repo)}/known-failures/${failureId}/close`,
    { method: "PATCH" }
  );
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
