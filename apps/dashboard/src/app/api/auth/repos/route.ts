// Lists repos the user has granted the Triaige GitHub App access to.
//
// Delegates to fetchConnectedRepos() in api.server.ts so the same logic
// can be called from both API routes and server components.

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { fetchConnectedRepos } from "@/lib/api.server";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const repos = await fetchConnectedRepos();
  return NextResponse.json(repos);
}
