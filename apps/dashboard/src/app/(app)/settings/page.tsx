// Settings page — link a GitHub repo and configure triage mode.
//
// Fetches the user's repos from /api/auth/repos and displays a dropdown.
// The selected repo is stored in localStorage until Postgres is added (Step 19).
// Triage mode (before/after merge) is stored on the runner via API.

"use client";

import { useEffect, useState } from "react";

interface Repo {
  full_name: string;
  private: boolean;
}

interface RepoSettings {
  pre_merge: boolean;
}

const STORAGE_KEY = "triaige:linked_repo";

export default function SettingsPage() {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);
  const [linkedRepo, setLinkedRepo] = useState<string>("");
  const [preMerge, setPreMerge] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setLinkedRepo(stored);
      loadSettings(stored);
    }

    fetch("/api/auth/repos")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Repo[]) => setRepos(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const loadSettings = (repo: string) => {
    if (!repo) return;
    fetch(`/api/runner/repos/${encodeURIComponent(repo)}/settings`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: RepoSettings | null) => {
        if (data) {
          setPreMerge(data.pre_merge);
        }
      })
      .catch(() => {});
  };

  const handleRepoChange = (repo: string) => {
    setLinkedRepo(repo);
    setSaved(false);
    setPreMerge(false);
    loadSettings(repo);
  };

  const handleSave = async () => {
    if (linkedRepo) {
      localStorage.setItem(STORAGE_KEY, linkedRepo);
      await fetch(
        `/api/runner/repos/${encodeURIComponent(linkedRepo)}/settings`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pre_merge: preMerge }),
        }
      );
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-2xl font-bold text-zinc-900">Settings</h1>

      <div className="mt-8 rounded-lg border border-zinc-200 bg-white shadow-sm p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Linked Repository</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Select the repo whose Playwright test failures will be triaged.
          Baseline update PRs will be created in this repo.
        </p>

        <div className="mt-4 flex items-center gap-3">
          {loading ? (
            <p className="text-sm text-zinc-400">Loading repos...</p>
          ) : (
            <>
              <select
                value={linkedRepo}
                onChange={(e) => handleRepoChange(e.target.value)}
                className="w-full max-w-md rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              >
                <option value="">Select a repository...</option>
                {repos.map((repo) => (
                  <option key={repo.full_name} value={repo.full_name}>
                    {repo.full_name}
                    {repo.private ? " (private)" : ""}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
      </div>

      {linkedRepo && (
        <div className="mt-6 rounded-lg border border-zinc-200 bg-white shadow-sm p-6">
          <h2 className="text-lg font-semibold text-zinc-900">Triage Mode</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Choose when Triaige runs visual regression triage for this repo.
          </p>

          <div className="mt-4 flex flex-col gap-3">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={preMerge}
                onChange={(e) => {
                  setPreMerge(e.target.checked);
                  setSaved(false);
                }}
                className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500"
              />
              <div>
                <span className="text-sm font-medium text-zinc-900">Before merge</span>
                <p className="text-xs text-zinc-500">
                  Run on open PRs and post results as a PR comment
                </p>
              </div>
            </label>

          </div>
        </div>
      )}

      <div className="mt-6">
        <button
          onClick={handleSave}
          disabled={!linkedRepo}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saved ? "Saved" : "Save"}
        </button>
      </div>
    </div>
  );
}
