// Clears the session cookie and redirects to the sign-in page.

import { NextRequest, NextResponse } from "next/server";
import { clearSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  await clearSession();
  return NextResponse.redirect(new URL("/sign-in", request.url));
}
