// Settings page — link a GitHub repo for triage runs.
//
// Fetches the user's repos from /api/auth/repos and displays a dropdown.
// The selected repo is stored in localStorage until Postgres is added (Step 18).

"use client";

import { useEffect, useState } from "react";

interface Repo {
  full_name: string;
  private: boolean;
}

const STORAGE_KEY = "triaige:linked_repo";

export default function SettingsPage() {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);
  const [linkedRepo, setLinkedRepo] = useState<string>("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setLinkedRepo(stored);

    fetch("/api/auth/repos")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Repo[]) => setRepos(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = () => {
    if (linkedRepo) {
      localStorage.setItem(STORAGE_KEY, linkedRepo);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-bold text-zinc-900">Settings</h1>

      <div className="mt-8 rounded-lg border border-zinc-200 bg-white p-6">
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
                onChange={(e) => {
                  setLinkedRepo(e.target.value);
                  setSaved(false);
                }}
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
              <button
                onClick={handleSave}
                className="shrink-0 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
              >
                {saved ? "Saved" : "Save"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
