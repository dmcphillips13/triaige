// Layout for authenticated pages — wraps content with the user nav bar.
// Pages in the (app) route group inherit this layout automatically.
// The route group does not affect URL paths (/runs stays /runs, not /app/runs).
//
// Session check: if the JWT is expired or the GitHub token is dead (refresh
// failed), redirects to sign-in. This protects all pages under the (app) group
// in a single place — no need for per-page auth checks.

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { UserNav } from "@/components/user-nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/sign-in");
  }

  return (
    <>
      <UserNav />
      {children}
    </>
  );
}
