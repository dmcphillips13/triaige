import { RunCardSkeleton } from "@/components/skeleton";

export default function RunsLoading() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="h-7 w-36 animate-pulse rounded bg-zinc-200/60" />
      <div className="mt-6 flex gap-1 border-b border-zinc-200 pb-2">
        <div className="h-5 w-12 animate-pulse rounded bg-zinc-200/60" />
        <div className="ml-2 h-5 w-12 animate-pulse rounded bg-zinc-200/60" />
        <div className="ml-2 h-5 w-16 animate-pulse rounded bg-zinc-200/60" />
      </div>
      <ul className="mt-4 space-y-3">
        {[1, 2, 3].map((i) => (
          <li key={i}><RunCardSkeleton /></li>
        ))}
      </ul>
    </div>
  );
}
