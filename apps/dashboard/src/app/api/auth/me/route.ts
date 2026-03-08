// Returns the current user's profile from the session cookie.
// Used by client components to display the user avatar and login.

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  return NextResponse.json({
    login: session.user_login,
    avatar_url: session.user_avatar,
  });
}
