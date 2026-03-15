// Root page — redirects authenticated users to /repos.
// Unauthenticated users are caught by middleware and sent to /sign-in.

import { redirect } from "next/navigation";

export default function Home() {
  redirect("/repos");
}
