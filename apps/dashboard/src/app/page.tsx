// Root page — redirects authenticated users to /runs.
// Unauthenticated users are caught by middleware and sent to /sign-in.

import { redirect } from "next/navigation";

export default function Home() {
  redirect("/runs");
}
