// OAuth login route — generates a CSRF state parameter and redirects to GitHub.
//
// Sets a short-lived HTTP-only cookie with the state value. The callback
// route verifies this cookie against the state returned by GitHub to
// prevent CSRF attacks on the OAuth flow.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const STATE_COOKIE = "oauth_state";

export async function GET() {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const redirectUri = `${appUrl}/api/auth/callback`;

  if (!clientId) {
    return NextResponse.json(
      { error: "OAuth not configured" },
      { status: 500 }
    );
  }

  // Generate random state for CSRF protection
  const state = crypto.randomUUID();

  // Store state in HTTP-only cookie (expires in 10 minutes)
  const jar = await cookies();
  jar.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 minutes
  });

  const githubUrl =
    `https://github.com/login/oauth/authorize` +
    `?client_id=${clientId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${state}`;

  return NextResponse.redirect(githubUrl);
}
