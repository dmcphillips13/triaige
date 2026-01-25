export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <main className="flex flex-col items-center gap-8 px-6 text-center">
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">
            Triaige
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-400">
            Autonomous CI Regression Resolution
          </p>
        </div>

        <p className="max-w-md text-zinc-500 dark:text-zinc-500">
          AI-powered regression triage that detects, classifies, and resolves CI failures
          automatically.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row">
          <a
            href="/runs/new"
            className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-900 px-6 text-sm font-medium text-zinc-50 transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            New Run
          </a>
          <a
            href="/runs"
            className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-200 bg-white px-6 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 dark:hover:bg-zinc-800"
          >
            View Runs
          </a>
        </div>
      </main>
    </div>
  );
}
