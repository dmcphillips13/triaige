// Skeleton shown while the repos page server component loads.

import { Skeleton } from "@/components/skeleton";

function RepoCardSkeleton() {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <Skeleton className="h-3 w-16" />
      <Skeleton className="mt-1.5 h-5 w-32" />
      <div className="mt-3 flex items-center gap-3">
        <Skeleton className="h-4 w-24" />
      </div>
      <Skeleton className="mt-2 h-3 w-28" />
    </div>
  );
}

export default function ReposLoading() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-2xl font-bold text-zinc-900">Repositories</h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <RepoCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
