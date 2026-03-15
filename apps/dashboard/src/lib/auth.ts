// JWT-based session management for GitHub OAuth.
//
// Signs and verifies a compact JWE token stored in an HTTP-only cookie.
// The token contains the user's GitHub access token, login, and avatar URL.
// Uses the `jose` library which works in both Node.js and Edge runtimes.
//
// GitHub App user access tokens expire after 8 hours. The session stores a
// refresh token (valid 6 months) and auto-refreshes the access token when
// it's within 10 minutes of expiry.

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = "triaige_session";
const REFRESH_BUFFER_MS = 10 * 60 * 1000; // refresh 10 min before expiry

interface Session {
  github_token: string;
  user_login: string;
  user_avatar: string;
}

interface SessionPayload extends Session {
  refresh_token: string;
  token_expires_at: number; // epoch ms
}

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(secret);
}

/** Create a signed JWT and set it as an HTTP-only cookie. */
export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .sign(getSecret());

  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

/** Refresh the GitHub access token using the refresh token. */
async function refreshGitHubToken(
  refreshToken: string
): Promise<{ access_token: string; refresh_token: string; expires_in: number } | null> {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  try {
    const res = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });
    const data = await res.json();
    if (data.error || !data.access_token) return null;
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
    };
  } catch {
    return null;
  }
}

/** Read and verify the session cookie. Auto-refreshes expired tokens. */
export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret());
    const session: Session = {
      github_token: payload.github_token as string,
      user_login: payload.user_login as string,
      user_avatar: payload.user_avatar as string,
    };

    // Check if the GitHub token needs refreshing
    const expiresAt = payload.token_expires_at as number | undefined;
    const refreshToken = payload.refresh_token as string | undefined;

    if (expiresAt && refreshToken && Date.now() > expiresAt - REFRESH_BUFFER_MS) {
      const refreshed = await refreshGitHubToken(refreshToken);
      if (refreshed) {
        const newPayload: SessionPayload = {
          github_token: refreshed.access_token,
          user_login: session.user_login,
          user_avatar: session.user_avatar,
          refresh_token: refreshed.refresh_token,
          token_expires_at: Date.now() + refreshed.expires_in * 1000,
        };
        await createSession(newPayload);
        return {
          github_token: refreshed.access_token,
          user_login: session.user_login,
          user_avatar: session.user_avatar,
        };
      }
      // Refresh failed — return existing session, it may still work
    }

    return session;
  } catch {
    return null;
  }
}

/** Clear the session cookie. */
export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

/** Get the GitHub token from the current session, or null. */
export async function getGitHubToken(): Promise<string | null> {
  const session = await getSession();
  return session?.github_token ?? null;
}
