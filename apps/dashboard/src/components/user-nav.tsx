// User navigation bar — shows avatar, username, and sign-out link.
// Displayed at the top of authenticated pages via the layout.
//
// Fetches the current user from /api/auth/me on mount. If the session
// is missing, the middleware will have already redirected to sign-in.

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Logo } from "./logo";

interface User {
  login: string;
  avatar_url: string;
}

export function UserNav() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then(setUser)
      .catch(() => {});
  }, []);

  if (!user) return null;

  return (
    <nav className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-3">
        <Link href="/runs">
          <Logo />
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href="/settings"
            className="text-sm text-zinc-500 hover:text-zinc-700"
          >
            Settings
          </Link>
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={user.avatar_url}
              alt={user.login}
              className="h-6 w-6 rounded-full"
            />
            <span className="text-sm text-zinc-700">{user.login}</span>
          </div>
          <a
            href="/api/auth/logout"
            className="text-sm text-zinc-400 hover:text-zinc-600"
          >
            Sign out
          </a>
        </div>
      </div>
    </nav>
  );
}
