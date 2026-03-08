// Client-side API helpers for the runner.
//
// These call the /api/runner proxy (not the runner directly), so they work
// from the browser. The proxy handles auth (API key + GitHub token forwarding).

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
