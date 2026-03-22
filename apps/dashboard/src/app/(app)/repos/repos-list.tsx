// Repo cards grid — displays connected repos with stats.
// Each card links to /runs?repo=owner/repo.
// Add/remove repos is handled via GitHub's installation settings page.

"use client";

import Link from "next/link";
import type { RepoWithStats } from "./page";

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const seconds = Math.floor((now - then) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export function ReposList({ repos }: { repos: RepoWithStats[] }) {
  // All repos share the same installation
  const installationId = repos[0]?.installation_id;
  const manageUrl = installationId
    ? `https://github.com/settings/installations/${installationId}`
    : "https://github.com/apps/triaige/installations/new";

  if (repos.length === 0) {
    return (
      <div className="mt-12 text-center">
        <p className="text-zinc-500">No repositories connected yet.</p>
        <p className="mt-2 text-sm text-zinc-400">
          Install the Triaige GitHub App on a repository to get started.
        </p>
        <a
          href="https://github.com/apps/triaige/installations/new"
          className="mt-4 inline-block rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
        >
          Connect Repository
        </a>
      </div>
    );
  }

  return (
    <>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {repos.map((repo) => {
          const [owner, name] = repo.full_name.split("/");
          return (
            <div
              key={repo.full_name}
              className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm transition-all hover:border-zinc-300 hover:shadow-md"
            >
              <Link
                href={`/runs?repo=${encodeURIComponent(repo.full_name)}`}
                className="block"
              >
                <div>
                  <span className="text-xs text-zinc-400">{owner}</span>
                  <h2 className="text-base font-semibold text-zinc-900">
                    {name}
                  </h2>
                </div>

                <div className="mt-3 flex items-center gap-3">
                  <span className="text-sm text-zinc-600">
                    {repo.openRuns > 0
                      ? `${repo.openRuns} open run${repo.openRuns !== 1 ? "s" : ""}`
                      : "No runs yet"}
                  </span>

                  {!repo.openaiKeyConfigured && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                      Setup required
                    </span>
                  )}

                  {repo.actionRequired > 0 && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                      {repo.actionRequired} action required
                    </span>
                  )}
                </div>

                <p className="mt-2 text-xs text-zinc-400">
                  {repo.lastActivity
                    ? `Last activity ${relativeTime(repo.lastActivity)}`
                    : "No activity"}
                </p>
              </Link>

              <div className="mt-3 border-t border-zinc-100 pt-3">
                <Link
                  href={`/repos/${owner}/${name}/settings`}
                  className="text-xs text-zinc-400 transition-colors hover:text-zinc-600"
                >
                  Settings
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex items-center gap-4">
        <a
          href={manageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-zinc-500 transition-colors hover:text-zinc-700"
        >
          Add or remove repositories &rarr;
        </a>
      </div>
    </>
  );
}
