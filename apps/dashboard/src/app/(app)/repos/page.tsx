// Repos landing page — shows connected repos as cards with run stats.
//
// Fetches repos from the GitHub App installation API and runs from the
// runner, then computes per-repo stats (open runs, action required, last
// activity). Clicking a card navigates to /runs?repo=owner/repo.

import { fetchConnectedRepos, fetchRuns, fetchRepoSettings } from "@/lib/api.server";
import type { ConnectedRepo } from "@/lib/api.server";
import type { TriageRunSummary } from "@/lib/types";
import { ReposList } from "./repos-list";

export interface RepoWithStats {
  full_name: string;
  private: boolean;
  installation_id: number;
  openRuns: number;
  actionRequired: number;
  lastActivity: string | null;
  openaiKeyConfigured: boolean;
}

export default async function ReposPage() {
  let repos: ConnectedRepo[] = [];
  let runs: TriageRunSummary[] = [];
  let error = false;

  try {
    [repos, runs] = await Promise.all([fetchConnectedRepos(), fetchRuns()]);
  } catch {
    // If runner is unreachable, still try to show repos without stats
    try {
      repos = await fetchConnectedRepos();
    } catch {
      error = true;
    }
  }

  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="text-2xl font-bold text-zinc-900">Repositories</h1>
        <p className="mt-4 text-zinc-500">
          Could not load repositories. Please try again.
        </p>
      </div>
    );
  }

  // Group runs by repo to compute per-repo stats
  const runsByRepo = new Map<string, TriageRunSummary[]>();
  for (const run of runs) {
    if (!run.repo) continue;
    const existing = runsByRepo.get(run.repo) || [];
    existing.push(run);
    runsByRepo.set(run.repo, existing);
  }

  // Fetch settings per repo in parallel (for openai_key_configured status)
  const settingsResults = await Promise.allSettled(
    repos.map((repo) => fetchRepoSettings(repo.full_name))
  );
  const settingsByRepo = new Map<string, { openai_key_configured: boolean }>();
  repos.forEach((repo, i) => {
    const result = settingsResults[i];
    if (result.status === "fulfilled") {
      settingsByRepo.set(repo.full_name, result.value);
    }
  });

  const reposWithStats: RepoWithStats[] = repos.map((repo) => {
    const repoRuns = runsByRepo.get(repo.full_name) || [];
    const openRuns = repoRuns.filter(
      (r) => r.triage_mode === "pre_merge" && !r.closed
    );
    const actionRequired = openRuns.filter(
      (r) => r.gate_status === "action_required"
    );
    const lastRun = repoRuns.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];
    const settings = settingsByRepo.get(repo.full_name);

    return {
      full_name: repo.full_name,
      private: repo.private,
      installation_id: repo.installation_id,
      openRuns: openRuns.length,
      actionRequired: actionRequired.length,
      lastActivity: lastRun?.created_at || null,
      openaiKeyConfigured: settings?.openai_key_configured ?? false,
    };
  });

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-2xl font-bold text-zinc-900">Repositories</h1>
      <ReposList repos={reposWithStats} />
    </div>
  );
}
