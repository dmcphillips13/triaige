import { FailureCardSkeleton } from "@/components/skeleton";

export default function RunDetailLoading() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex items-center justify-between">
        <div className="h-4 w-24 animate-pulse rounded bg-zinc-200/60" />
        <div className="h-4 w-36 animate-pulse rounded bg-zinc-200/60" />
      </div>
      <div className="mt-4">
        <div className="h-7 w-80 animate-pulse rounded bg-zinc-200/60" />
        <div className="mt-3 flex gap-3">
          <div className="h-5 w-16 animate-pulse rounded bg-zinc-200/60" />
          <div className="h-5 w-20 animate-pulse rounded-full bg-zinc-200/60" />
        </div>
      </div>
      <ul className="mt-6 space-y-3">
        <li><FailureCardSkeleton /></li>
        <li><FailureCardSkeleton /></li>
      </ul>
    </div>
  );
}
