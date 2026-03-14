// Auth middleware — redirects unauthenticated users to the sign-in page.
//
// Checks for the session cookie (JWT). If missing, redirects to /sign-in.
// Allows public paths (sign-in, OAuth callback, health) through without auth.
// Also allows the runner proxy through since it uses its own API key auth.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/sign-in", "/api/auth/"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();

  const session = request.cookies.get("triaige_session");
  if (!session?.value) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match everything except static files and Next.js internals
    "/((?!_next/static|_next/image|favicon.ico|logo.png).*)",
  ],
};
