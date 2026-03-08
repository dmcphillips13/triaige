// JWT-based session management for GitHub OAuth.
//
// Signs and verifies a compact JWE token stored in an HTTP-only cookie.
// The token contains the user's GitHub access token, login, and avatar URL.
// Uses the `jose` library which works in both Node.js and Edge runtimes.

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = "triaige_session";

interface Session {
  github_token: string;
  user_login: string;
  user_avatar: string;
}

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(secret);
}

/** Create a signed JWT and set it as an HTTP-only cookie. */
export async function createSession(session: Session): Promise<void> {
  const token = await new SignJWT(session as unknown as Record<string, unknown>)
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

/** Read and verify the session cookie. Returns null if missing or invalid. */
export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret());
    return {
      github_token: payload.github_token as string,
      user_login: payload.user_login as string,
      user_avatar: payload.user_avatar as string,
    };
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
