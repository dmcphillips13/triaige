// GitHub OAuth callback handler.
//
// GitHub redirects here with a ?code= parameter after the user authorizes.
// We exchange the code for an access token, fetch the user's profile,
// create a signed JWT session cookie, and redirect to the dashboard.

import { NextRequest, NextResponse } from "next/server";
import { createSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "OAuth not configured" },
      { status: 500 }
    );
  }

  // Exchange code for access token
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  });

  const tokenData = await tokenRes.json();
  if (tokenData.error) {
    return NextResponse.json(
      { error: tokenData.error_description || tokenData.error },
      { status: 400 }
    );
  }

  const accessToken = tokenData.access_token as string;

  // Fetch user profile
  const userRes = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const user = await userRes.json();

  await createSession({
    github_token: accessToken,
    user_login: user.login,
    user_avatar: user.avatar_url,
  });

  return NextResponse.redirect(new URL("/runs", request.url));
}
