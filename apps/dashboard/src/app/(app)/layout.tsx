// Layout for authenticated pages — wraps content with the user nav bar.
// Pages in the (app) route group inherit this layout automatically.
// The route group does not affect URL paths (/runs stays /runs, not /app/runs).

import { UserNav } from "@/components/user-nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <UserNav />
      {children}
    </>
  );
}
