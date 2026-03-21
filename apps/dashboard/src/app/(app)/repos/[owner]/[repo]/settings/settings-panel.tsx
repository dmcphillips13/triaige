// Client component for the repo settings page.
// Handles copy-to-clipboard, merge gate toggle, and the init command display.

"use client";

import { useState } from "react";

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      className="rounded-md bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-200"
    >
      {copied ? "Copied!" : label}
    </button>
  );
}

interface Props {
  repo: string;
  apiKey: string;
  mergeGate: boolean;
}

export function SettingsPanel({ repo, apiKey, mergeGate }: Props) {
  const [gate, setGate] = useState(mergeGate);
  const [saving, setSaving] = useState(false);

  const initCommand = `npx triaige init`;

  async function toggleMergeGate() {
    const newValue = !gate;
    setGate(newValue);
    setSaving(true);

    try {
      const res = await fetch(
        `/api/runner/repos/${encodeURIComponent(repo)}/settings`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pre_merge: true,
            post_merge: true,
            merge_gate: newValue,
          }),
        }
      );
      if (!res.ok) {
        setGate(!newValue); // revert on failure
      }
    } catch {
      setGate(!newValue);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-8 space-y-8">
      {/* API Key */}
      <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">API Key</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Used to authenticate your CI workflow with the Triaige runner. Paste
          this when running{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">
            triaige init
          </code>
          .
        </p>
        <div className="mt-3 flex items-center gap-3">
          <code className="flex-1 rounded-md bg-zinc-50 px-3 py-2 font-mono text-sm text-zinc-800 border border-zinc-200">
            {apiKey}
          </code>
          <CopyButton text={apiKey} label="Copy" />
        </div>
      </section>

      {/* Setup Command */}
      <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Quick Setup</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Run this command in your repository to configure Triaige. It sets up
          GitHub Actions workflows, secrets, and branch protection.
        </p>
        <div className="mt-3 flex items-center gap-3">
          <code className="flex-1 rounded-md bg-zinc-50 px-3 py-2 font-mono text-sm text-zinc-800 border border-zinc-200">
            {initCommand}
          </code>
          <CopyButton text={initCommand} label="Copy" />
        </div>
      </section>

      {/* Merge Gate Toggle */}
      <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Merge Gate</h2>
            <p className="mt-1 text-xs text-zinc-500">
              When enabled, PRs cannot merge until all visual failures are
              reviewed. The &ldquo;Triaige Visual Regression&rdquo; check blocks
              merge until every failure has a baseline commit or issue filed.
            </p>
          </div>
          <button
            onClick={toggleMergeGate}
            disabled={saving}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              gate ? "bg-emerald-500" : "bg-zinc-300"
            } ${saving ? "opacity-50" : ""}`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                gate ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </section>
    </div>
  );
}
