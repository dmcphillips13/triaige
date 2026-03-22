// Repo access validation for dashboard multi-tenancy.
//
// Checks whether the logged-in user's GitHub account has access to a repo
// via their GitHub App installations. Results are cached in-memory with a
// 60-second TTL to avoid hitting GitHub API rate limits on every request.
//
// Used by: dashboard proxy (API calls) and server component pages (page loads).

import "server-only";

import { getSession } from "./auth";

// In-memory cache: userLogin -> { repos: Set<full_name>, expiresAt: epoch ms }
const cache = new Map<
  string,
  { repos: Set<string>; expiresAt: number }
>();
const TTL_MS = 60_000;

/**
 * Fetch the set of repo full_names the user can access via GitHub App installations.
 * Cached per userLogin with a 60s TTL.
 */
export async function getUserAccessibleRepos(
  githubToken: string,
  userLogin: string
): Promise<Set<string>> {
  const cached = cache.get(userLogin);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.repos;
  }

  const repos = new Set<string>();

  try {
    const installRes = await fetch(
      "https://api.github.com/user/installations?per_page=100",
      {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: "application/vnd.github+json",
        },
      }
    );
    if (!installRes.ok) return repos;
    const { installations } = await installRes.json();

    for (const install of installations) {
      let page = 1;
      while (page <= 5) {
        const repoRes = await fetch(
          `https://api.github.com/user/installations/${install.id}/repositories?per_page=100&page=${page}`,
          {
            cache: "no-store",
            headers: {
              Authorization: `Bearer ${githubToken}`,
              Accept: "application/vnd.github+json",
            },
          }
        );
        if (!repoRes.ok) break;
        const data = await repoRes.json();
        const batch = data.repositories || [];
        if (batch.length === 0) break;
        for (const r of batch) repos.add(r.full_name);
        page++;
      }
    }
  } catch {
    // If GitHub API is unreachable, return empty set (deny all).
    // The cache won't be populated, so the next request retries.
    return repos;
  }

  cache.set(userLogin, { repos, expiresAt: Date.now() + TTL_MS });
  return repos;
}

/**
 * Populate the cache from an already-fetched repo list (e.g., from the repos page).
 * Avoids a redundant GitHub API call when the data is already available.
 */
export function populateRepoCache(
  userLogin: string,
  repos: Set<string>
): void {
  cache.set(userLogin, { repos, expiresAt: Date.now() + TTL_MS });
}

/**
 * Assert that the current session user has access to the given repo.
 * Throws an error if not — callers should catch and render 404 or redirect.
 */
export async function assertRepoAccess(repo: string): Promise<void> {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized");
  }

  const accessible = await getUserAccessibleRepos(
    session.github_token,
    session.user_login
  );
  if (!accessible.has(repo)) {
    throw new Error("Repo access denied");
  }
}
