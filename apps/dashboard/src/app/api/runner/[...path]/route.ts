// Proxy route — forwards dashboard requests to the runner backend.
//
// Validates repo access before forwarding: extracts the repo from URL path
// segments, request body, or query params, and checks it against the user's
// GitHub App installations. Returns 404 (not 403) to prevent repo enumeration.
//
// For GET /runs (list), filters the response to only include accessible repos.

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUserAccessibleRepos } from '@/lib/repo-access';

const RUNNER_BASE_URL = process.env.RUNNER_BASE_URL || 'http://localhost:8000';
const RUNNER_API_KEY = process.env.RUNNER_API_KEY || '';

/**
 * Extract repo from URL path segments.
 * Pattern: repos/{owner}/{repo}/... → "owner/repo"
 */
function extractRepoFromPath(segments: string[]): string | null {
  if (segments[0] === 'repos' && segments.length >= 3) {
    return `${segments[1]}/${segments[2]}`;
  }
  return null;
}

/**
 * Extract repo from a query string parameter.
 * Used for run-scoped endpoints where the client passes ?repo=owner/repo.
 */
function extractRepoFromQuery(request: NextRequest): string | null {
  return request.nextUrl.searchParams.get('repo');
}

/**
 * Extract repo from a JSON request body.
 * Used for POST endpoints like /update-baselines and /create-issues.
 */
function extractRepoFromBody(bodyText: string): string | null {
  try {
    const body = JSON.parse(bodyText);
    return body.repo || null;
  } catch {
    return null;
  }
}

/**
 * Build the runner URL, stripping the ?repo= query param (runner doesn't expect it).
 */
function buildRunnerUrl(segments: string[], request: NextRequest): string {
  const base = `${RUNNER_BASE_URL}/${segments.map(encodeURIComponent).join('/')}`;
  // Forward all query params except 'repo' (used for proxy-side access control only)
  const params = new URLSearchParams(request.nextUrl.searchParams);
  params.delete('repo');
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

async function proxyRequest(request: NextRequest, segments: string[]) {
  const session = await getSession();

  // Read body once for methods that have one (reused for repo extraction + forwarding)
  let bodyText: string | undefined;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    bodyText = await request.text();
  }

  // --- Repo access validation ---
  if (session) {
    const accessible = await getUserAccessibleRepos(
      session.github_token,
      session.user_login
    );

    // 1. Repo from URL path (repos/{owner}/{repo}/...)
    const pathRepo = extractRepoFromPath(segments);
    if (pathRepo && !accessible.has(pathRepo)) {
      return NextResponse.json({ detail: 'Not found' }, { status: 404 });
    }

    // 2. Repo from query param (runs/{runId}/...?repo=owner/repo)
    const queryRepo = extractRepoFromQuery(request);
    if (queryRepo && !accessible.has(queryRepo)) {
      return NextResponse.json({ detail: 'Not found' }, { status: 404 });
    }

    // 3. Repo from POST body (update-baselines, create-issues, feedback)
    if (
      bodyText &&
      !pathRepo &&
      (segments[0] === 'update-baselines' ||
        segments[0] === 'create-issues' ||
        segments[0] === 'feedback')
    ) {
      const bodyRepo = extractRepoFromBody(bodyText);
      if (bodyRepo && !accessible.has(bodyRepo)) {
        return NextResponse.json({ detail: 'Not found' }, { status: 404 });
      }
    }
  }

  // --- Build request to runner ---
  const url = buildRunnerUrl(segments, request);

  const headers = new Headers();
  headers.set('Content-Type', 'application/json');
  if (RUNNER_API_KEY) {
    headers.set('Authorization', `Bearer ${RUNNER_API_KEY}`);
  }
  if (session?.github_token) {
    headers.set('X-GitHub-Token', session.github_token);
  }
  if (session?.user_login) {
    headers.set('X-Dashboard-User', session.user_login);
  }

  const init: RequestInit = {
    method: request.method,
    headers,
  };

  if (bodyText !== undefined) {
    init.body = bodyText;
  }

  try {
    const response = await fetch(url, init);
    const contentType = response.headers.get('Content-Type') || '';

    // Stream SSE responses directly instead of buffering
    if (contentType.includes('text/event-stream') && response.body) {
      return new NextResponse(response.body as ReadableStream, {
        status: response.status,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
        },
      });
    }

    const data = await response.text();

    // Filter GET /runs response to only include accessible repos
    if (
      request.method === 'GET' &&
      segments.length === 1 &&
      segments[0] === 'runs' &&
      session &&
      response.ok
    ) {
      try {
        const accessible = await getUserAccessibleRepos(
          session.github_token,
          session.user_login
        );
        const runs = JSON.parse(data);
        if (Array.isArray(runs)) {
          const filtered = runs.filter(
            (r: { repo?: string }) => !r.repo || accessible.has(r.repo)
          );
          return new NextResponse(JSON.stringify(filtered), {
            status: response.status,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      } catch {
        // If filtering fails, return original response rather than breaking
      }
    }

    return new NextResponse(data, {
      status: response.status,
      headers: {
        'Content-Type': contentType || 'application/json',
      },
    });
  } catch (error) {
    console.error('Runner proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to connect to runner service' },
      { status: 502 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyRequest(request, path);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyRequest(request, path);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyRequest(request, path);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyRequest(request, path);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyRequest(request, path);
}
