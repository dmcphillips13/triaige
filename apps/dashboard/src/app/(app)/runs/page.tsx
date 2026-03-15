// Runs list page — async server component that fetches all triage runs from
// the runner and passes them to a client component with Open/Closed tabs.
//
// Requires ?repo=owner/repo to scope runs to a repository.
// Redirects to /repos if no repo param is provided.

import Link from "next/link";
import { redirect } from "next/navigation";
import { fetchRuns } from "@/lib/api.server";
import { RunsList } from "./runs-list";

export default async function RunsPage({
  searchParams,
}: {
  searchParams: Promise<{ repo?: string }>;
}) {
  const { repo } = await searchParams;

  if (!repo) {
    redirect("/repos");
  }

  let runs;
  try {
    runs = await fetchRuns();
  } catch {
    return (
      <div className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="text-2xl font-bold text-zinc-900">Triage Runs</h1>
        <p className="mt-4 text-zinc-500">
          Could not connect to the runner service. Make sure it is running.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <Link
        href="/repos"
        className="inline-flex items-center gap-1 text-sm text-zinc-500 transition-colors hover:text-zinc-700"
      >
        &larr; All repositories
      </Link>
      <h1 className="mt-1 text-2xl font-bold text-zinc-900">
        {repo.split("/")[1]}
      </h1>
      <p className="text-sm text-zinc-400">{repo}</p>

      <RunsList runs={runs} repo={repo} />
    </div>
  );
}
