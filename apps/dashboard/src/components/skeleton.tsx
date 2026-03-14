// Skeleton loading components for smooth page transitions.

import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-zinc-200/60",
        className
      )}
    />
  );
}

/** Skeleton for a run card in the runs list. */
export function RunCardSkeleton() {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white shadow-sm p-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
    </div>
  );
}

/** Skeleton for a failure card in the run detail page. */
export function FailureCardSkeleton() {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
      <div className="flex items-center gap-3 p-4">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-4 w-64" />
        <div className="flex-1" />
        <Skeleton className="h-4 w-10" />
      </div>
      <div className="border-t border-zinc-100 px-4 py-3">
        <Skeleton className="h-3 w-16 mb-2" />
        <Skeleton className="h-4 w-full mb-1.5" />
        <Skeleton className="h-4 w-3/4 mb-1.5" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  );
}
