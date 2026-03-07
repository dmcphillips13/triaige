// Human approve/reject verdicts with dual persistence:
//
// 1. localStorage — immediate UI state that survives page reloads.
// 2. POST /feedback — stores the decision as an episode in Qdrant so the
//    agent can retrieve it as a few-shot example for future classifications
//    (CoALA episodic memory pattern).
//
// The API call is fire-and-forget: if the runner is unreachable, the UI
// still works via localStorage. Episodes accumulate in Qdrant over time
// and are retrieved by the retrieve_episodes agent node.

import type { HumanVerdict } from "./types";
import { submitFeedback } from "./api";

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
    // Fire-and-forget: store as episode in Qdrant for future few-shot retrieval
    submitFeedback(runId, testName, verdict).catch(() => {});
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
