// Client component for the repo settings page.
// Handles copy-to-clipboard, merge gate toggle, OpenAI key management,
// and the init command display.

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
  openaiKeyMasked: string | null;
}

export function SettingsPanel({
  repo,
  apiKey,
  mergeGate,
  openaiKeyMasked,
}: Props) {
  const [gate, setGate] = useState(mergeGate);
  const [saving, setSaving] = useState(false);

  // OpenAI key state
  const [masked, setMasked] = useState(openaiKeyMasked);
  const [newKey, setNewKey] = useState("");
  const [keyStatus, setKeyStatus] = useState<
    "idle" | "saving" | "success" | "error"
  >("idle");
  const [keyError, setKeyError] = useState("");

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

  async function saveOpenAIKey() {
    if (!newKey.trim()) return;
    setKeyStatus("saving");
    setKeyError("");

    try {
      const res = await fetch(
        `/api/runner/repos/${encodeURIComponent(repo)}/openai-key`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ openai_api_key: newKey.trim() }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setKeyError(data.detail || "Failed to save key");
        setKeyStatus("error");
        return;
      }
      const data = await res.json();
      setMasked(data.masked);
      setNewKey("");
      setKeyStatus("success");
      setTimeout(() => setKeyStatus("idle"), 2000);
    } catch {
      setKeyError("Connection error");
      setKeyStatus("error");
    }
  }

  async function deleteOpenAIKey() {
    setKeyStatus("saving");
    try {
      const res = await fetch(
        `/api/runner/repos/${encodeURIComponent(repo)}/openai-key`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setMasked(null);
        setKeyStatus("idle");
      }
    } catch {
      setKeyStatus("error");
      setKeyError("Failed to delete key");
    }
  }

  return (
    <div className="mt-8 space-y-8">
      {/* Setup warning */}
      {!masked && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-800">
            Setup required
          </p>
          <p className="mt-1 text-xs text-amber-700">
            An OpenAI API key is required before triage runs can classify
            failures. Add your key below to get started.
          </p>
        </div>
      )}

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

      {/* OpenAI API Key */}
      <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">OpenAI API Key</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Required for AI-powered test failure classification. Your key is
          encrypted at rest and used only for classification requests on this
          repo. It is never shared or included in prompts.
        </p>
        <div className="mt-3">
          {masked ? (
            <div className="flex items-center gap-3">
              <code className="flex-1 rounded-md bg-zinc-50 px-3 py-2 font-mono text-sm text-zinc-800 border border-zinc-200">
                {masked}
              </code>
              <button
                onClick={() => setMasked(null)}
                className="rounded-md bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-200"
              >
                Update
              </button>
              <button
                onClick={deleteOpenAIKey}
                disabled={keyStatus === "saving"}
                className="rounded-md bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <input
                  type="password"
                  value={newKey}
                  onChange={(e) => {
                    setNewKey(e.target.value);
                    setKeyError("");
                    setKeyStatus("idle");
                  }}
                  placeholder="sk-..."
                  className="flex-1 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-sm text-zinc-800 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none"
                />
                <button
                  onClick={saveOpenAIKey}
                  disabled={!newKey.trim() || keyStatus === "saving"}
                  className="rounded-md bg-emerald-500 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
                >
                  {keyStatus === "saving"
                    ? "Validating..."
                    : keyStatus === "success"
                      ? "Saved"
                      : "Save"}
                </button>
              </div>
              {keyError && (
                <p className="text-xs text-red-600">{keyError}</p>
              )}
            </div>
          )}
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
