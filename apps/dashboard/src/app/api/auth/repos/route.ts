// Lists repos the user has granted the Triaige GitHub App access to.
//
// Uses the installation API rather than listing all user repos, so only
// repos the user explicitly selected during App installation are shown.

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

interface InstallationRepo {
  full_name: string;
  private: boolean;
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const repos: { full_name: string; private: boolean }[] = [];

  // Get all installations of the GitHub App accessible to this user
  const installRes = await fetch(
    "https://api.github.com/user/installations?per_page=100",
    { headers: { Authorization: `Bearer ${session.github_token}` } }
  );
  if (!installRes.ok) {
    return NextResponse.json(repos);
  }
  const { installations } = await installRes.json();

  // For each installation, list the repos the user can access
  for (const install of installations) {
    let page = 1;
    while (page <= 5) {
      const repoRes = await fetch(
        `https://api.github.com/user/installations/${install.id}/repositories?per_page=100&page=${page}`,
        { headers: { Authorization: `Bearer ${session.github_token}` } }
      );
      if (!repoRes.ok) break;
      const data = await repoRes.json();
      const batch: InstallationRepo[] = data.repositories || [];
      if (batch.length === 0) break;
      for (const r of batch) {
        repos.push({ full_name: r.full_name, private: r.private });
      }
      page++;
    }
  }

  return NextResponse.json(repos);
}
