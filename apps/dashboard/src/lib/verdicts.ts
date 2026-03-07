// Persistent storage for human approve/reject verdicts using localStorage.
//
// When a human reviews a triage classification, they can approve or reject it.
// This module stores those verdicts locally so they persist across page reloads.
//
// Verdicts are keyed by "{run_id}::{test_name}" and stored as a single JSON
// blob under the "triaige:verdicts" localStorage key.
//
// Step 13 will replace localStorage with API-backed episodic memory: approved
// decisions get stored as episodes in Qdrant and retrieved as few-shot examples
// for future classifications.

import type { HumanVerdict } from "./types";

const STORAGE_KEY = "triaige:verdicts";

type VerdictMap = Record<string, HumanVerdict>;

/** Build a unique key for a verdict: "{runId}::{testName}". */
function makeKey(runId: string, testName: string): string {
  return `${runId}::${testName}`;
}

function load(): VerdictMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function save(map: VerdictMap): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function getVerdict(runId: string, testName: string): HumanVerdict {
  return load()[makeKey(runId, testName)] ?? null;
}

export function setVerdict(
  runId: string,
  testName: string,
  verdict: HumanVerdict
): void {
  const map = load();
  const key = makeKey(runId, testName);
  if (verdict === null) {
    delete map[key];
  } else {
    map[key] = verdict;
  }
  save(map);
}

export function getVerdicts(runId: string, testNames: string[]): VerdictMap {
  const map = load();
  const result: VerdictMap = {};
  for (const name of testNames) {
    const key = makeKey(runId, name);
    result[key] = map[key] ?? null;
  }
  return result;
}
