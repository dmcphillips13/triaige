// Lists GitHub repos the authenticated user has push access to.
// Used by the settings page to populate the repo linking dropdown.

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

interface GitHubRepo {
  full_name: string;
  private: boolean;
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const repos: { full_name: string; private: boolean }[] = [];
  let page = 1;

  // Paginate through user repos (max 5 pages = 500 repos)
  while (page <= 5) {
    const res = await fetch(
      `https://api.github.com/user/repos?per_page=100&page=${page}&sort=updated&affiliation=owner,collaborator`,
      { headers: { Authorization: `Bearer ${session.github_token}` } }
    );
    if (!res.ok) break;
    const batch: GitHubRepo[] = await res.json();
    if (batch.length === 0) break;
    for (const r of batch) {
      repos.push({ full_name: r.full_name, private: r.private });
    }
    page++;
  }

  return NextResponse.json(repos);
}
