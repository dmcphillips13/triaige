import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(_request: NextRequest) {
  // Placeholder middleware for future auth integration
  // Example: Check for session, redirect to login, etc.
  return NextResponse.next();
}

export const config = {
  // Match all API routes and protected pages
  matcher: ['/api/:path*', '/runs/:path*'],
};
