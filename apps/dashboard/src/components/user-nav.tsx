// User navigation bar — shows logo and avatar dropdown.
// Displayed at the top of authenticated pages via the layout.
//
// Fetches the current user from /api/auth/me on mount. If the session
// is missing, the middleware will have already redirected to sign-in.

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Logo } from "./logo";

interface User {
  login: string;
  avatar_url: string;
}

export function UserNav() {
  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then(setUser)
      .catch(() => {});
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (!user) return null;

  return (
    <nav className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <Link href="/repos">
          <Logo />
        </Link>
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2 rounded-full p-1 transition-colors hover:bg-zinc-100"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={user.avatar_url}
              alt={user.login}
              className="h-7 w-7 rounded-full"
            />
          </button>
          {menuOpen && (
            <div className="absolute right-0 mt-2 w-48 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
              <div className="border-b border-zinc-100 px-4 py-2">
                <p className="text-sm font-medium text-zinc-900">{user.login}</p>
              </div>
              <a
                href="/api/auth/logout"
                className="block px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50"
              >
                Sign out
              </a>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
