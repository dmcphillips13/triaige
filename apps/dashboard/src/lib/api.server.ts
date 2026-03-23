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
import { getGitHubToken, getSession } from "./auth";

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

export interface ConnectedRepo {
  full_name: string;
  private: boolean;
  installation_id: number;
}

/** Fetch repos the user has granted the Triaige GitHub App access to. */
export async function fetchConnectedRepos(): Promise<ConnectedRepo[]> {
  const session = await getSession();
  if (!session) return [];

  const repos: ConnectedRepo[] = [];

  const installRes = await fetch(
    "https://api.github.com/user/installations?per_page=100",
    {
      cache: "no-store",
      headers: { Authorization: `Bearer ${session.github_token}` },
    }
  );
  if (installRes.status === 401) {
    throw new Error("GitHub authentication expired");
  }
  if (!installRes.ok) return repos;
  const { installations } = await installRes.json();

  for (const install of installations) {
    let page = 1;
    while (page <= 5) {
      const repoRes = await fetch(
        `https://api.github.com/user/installations/${install.id}/repositories?per_page=100&page=${page}`,
        {
          cache: "no-store",
          headers: { Authorization: `Bearer ${session.github_token}` },
        }
      );
      if (!repoRes.ok) break;
      const data = await repoRes.json();
      const batch = data.repositories || [];
      if (batch.length === 0) break;
      for (const r of batch) {
        repos.push({
          full_name: r.full_name,
          private: r.private,
          installation_id: install.id,
        });
      }
      page++;
    }
  }

  return repos;
}

/** Fetch the API key for a repo (auto-generates if none exists). */
export async function fetchRepoApiKey(repo: string): Promise<string> {
  const res = await fetch(
    `${RUNNER_BASE}/repos/${encodeURIComponent(repo)}/api-key`,
    {
      cache: "no-store",
      headers: await authHeaders(),
    }
  );
  if (!res.ok) throw new Error(`Failed to fetch API key: ${res.status}`);
  const data = await res.json();
  return data.api_key;
}

/** Fetch repo settings (merge gate, triage modes). */
export async function fetchRepoSettings(
  repo: string
): Promise<{ pre_merge: boolean; post_merge: boolean; merge_gate: boolean; openai_key_configured: boolean }> {
  const res = await fetch(
    `${RUNNER_BASE}/repos/${encodeURIComponent(repo)}/settings`,
    {
      cache: "no-store",
      headers: await authHeaders(),
    }
  );
  if (!res.ok) throw new Error(`Failed to fetch settings: ${res.status}`);
  return res.json();
}

/** Fetch the masked OpenAI key status for a repo. */
export async function fetchRepoOpenAIKey(
  repo: string
): Promise<{ masked: string | null }> {
  const res = await fetch(
    `${RUNNER_BASE}/repos/${encodeURIComponent(repo)}/openai-key`,
    {
      cache: "no-store",
      headers: await authHeaders(),
    }
  );
  if (!res.ok) throw new Error(`Failed to fetch OpenAI key: ${res.status}`);
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
