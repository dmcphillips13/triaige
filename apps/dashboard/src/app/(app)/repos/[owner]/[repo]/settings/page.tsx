// Per-repo settings page — shows API key, setup command, and merge gate toggle.
//
// The API key is auto-generated on first visit. Users copy it into `triaige init`
// during onboarding. The merge gate toggle controls whether the GitHub check
// blocks merges until all failures are addressed.

import { fetchRepoApiKey, fetchRepoSettings } from "@/lib/api.server";
import { SettingsPanel } from "./settings-panel";

interface Props {
  params: Promise<{ owner: string; repo: string }>;
}

export default async function RepoSettingsPage({ params }: Props) {
  const { owner, repo } = await params;
  const fullName = `${owner}/${repo}`;

  let apiKey = "";
  let mergeGate = true;
  let error = false;

  try {
    [apiKey, { merge_gate: mergeGate }] = await Promise.all([
      fetchRepoApiKey(fullName),
      fetchRepoSettings(fullName),
    ]);
  } catch {
    error = true;
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-2xl font-bold text-zinc-900">Settings</h1>
        <p className="mt-4 text-zinc-500">
          Could not load settings. The runner may be starting up — try again in
          a moment.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="mb-2">
        <a
          href={`/runs?repo=${encodeURIComponent(fullName)}`}
          className="text-sm text-zinc-500 transition-colors hover:text-zinc-700"
        >
          &larr; {fullName}
        </a>
      </div>
      <h1 className="text-2xl font-bold text-zinc-900">Settings</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Configuration for{" "}
        <span className="font-medium text-zinc-700">{fullName}</span>
      </p>

      <SettingsPanel
        repo={fullName}
        apiKey={apiKey}
        mergeGate={mergeGate}
      />
    </div>
  );
}
