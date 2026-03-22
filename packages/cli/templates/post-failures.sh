#!/usr/bin/env bash
# post-failures.sh — Parse Playwright JSON results and POST to Triaige runner
#
# Reads the Playwright JSON report, embeds screenshot files as base64 into the
# attachment bodies (Playwright only writes paths, not inline data), extracts
# PR context from the most recent merge commit, and sends everything to the
# Triaige /triage-run endpoint.
#
# Environment variables:
#   TRIAIGE_RUNNER_URL  — Runner base URL (e.g. https://triaige-runner.onrender.com)
#   TRIAIGE_API_KEY     — Shared API key for runner auth
#   GITHUB_REPOSITORY   — owner/repo (set automatically by GitHub Actions)
#   GITHUB_SHA          — Commit SHA that triggered the workflow
#   TRIAIGE_PR_NUMBER   — (optional) PR number override, useful for retriggers
#                         where the commit message isn't a merge commit

set -euo pipefail

# Clean up temp files on exit (screenshots + payload should not persist on shared runners)
cleanup() { rm -f /tmp/results-enriched.json /tmp/triaige-payload.json; }
trap cleanup EXIT

RESULTS_FILE="${1:-test-results/results.json}"

if [ ! -f "$RESULTS_FILE" ]; then
  echo "No results file found at $RESULTS_FILE"
  exit 0
fi

# Check if there are any failures
UNEXPECTED=$(jq '.stats.unexpected // 0' "$RESULTS_FILE")
if [ "$UNEXPECTED" -eq 0 ]; then
  echo "All tests passed — reporting clean to Triaige"

  # Resolve the PR head SHA for the passing check run
  CLEAN_HEAD_SHA="${TRIAIGE_HEAD_SHA:-$GITHUB_SHA}"
  CLEAN_PR_NUMBER="${TRIAIGE_PR_NUMBER:-}"
  if [ -n "$CLEAN_PR_NUMBER" ] && command -v gh &>/dev/null; then
    PR_SHA=$(gh pr view "$CLEAN_PR_NUMBER" --json headRefOid --jq '.headRefOid' 2>/dev/null || echo "")
    if [ -n "$PR_SHA" ]; then
      CLEAN_HEAD_SHA="$PR_SHA"
    fi
  fi

  # For push-to-main events, extract PR number from merge commit message
  CLEAN_EVENT="${GITHUB_EVENT_NAME:-}"
  if [ "$CLEAN_EVENT" = "push" ] && [ -z "$CLEAN_PR_NUMBER" ]; then
    MERGE_MSG=$(git log -1 --format="%s" "$GITHUB_SHA" 2>/dev/null || echo "")
    if [[ "$MERGE_MSG" =~ Merge\ pull\ request\ \#([0-9]+) ]]; then
      CLEAN_PR_NUMBER="${BASH_REMATCH[1]}"
    fi
  fi

  curl -s -X POST "${TRIAIGE_RUNNER_URL}/report-clean" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TRIAIGE_API_KEY}" \
    -d "{\"repo\": \"${GITHUB_REPOSITORY}\", \"head_sha\": \"${CLEAN_HEAD_SHA}\", \"pr_number\": ${CLEAN_PR_NUMBER:-null}, \"event\": \"${CLEAN_EVENT}\"}" || true

  exit 0
fi

# For push-to-main events (merges), don't create triage runs — just clean up.
# Pre-merge runs are auto-closed via /report-clean.
if [ "${GITHUB_EVENT_NAME:-}" = "push" ]; then
  echo "Push to main with $UNEXPECTED failure(s) — closing pre-merge runs only"

  MERGE_MSG=$(git log -1 --format="%s" "$GITHUB_SHA" 2>/dev/null || echo "")
  PUSH_PR_NUMBER=""
  if [[ "$MERGE_MSG" =~ Merge\ pull\ request\ \#([0-9]+) ]]; then
    PUSH_PR_NUMBER="${BASH_REMATCH[1]}"
  fi

  curl -s -X POST "${TRIAIGE_RUNNER_URL}/report-clean" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TRIAIGE_API_KEY}" \
    -d "{\"repo\": \"${GITHUB_REPOSITORY}\", \"head_sha\": \"${GITHUB_SHA}\", \"pr_number\": ${PUSH_PR_NUMBER:-null}, \"event\": \"push\"}" || true

  exit 0
fi

echo "Found $UNEXPECTED unexpected test failure(s), posting to Triaige..."

# Embed screenshot files as base64 into attachment bodies.
# Playwright's JSON reporter only writes file paths, not inline data.
ENRICHED_FILE="/tmp/results-enriched.json"
python3 -c "
import json, base64, os

with open('$RESULTS_FILE') as f:
    data = json.load(f)

def enrich_attachments(obj):
    if isinstance(obj, dict):
        if 'attachments' in obj and isinstance(obj['attachments'], list):
            for att in obj['attachments']:
                path = att.get('path', '')
                content_type = att.get('contentType', '')
                if path and os.path.isfile(path) and 'image' in content_type and not att.get('body'):
                    with open(path, 'rb') as img:
                        att['body'] = base64.b64encode(img.read()).decode()
        for v in obj.values():
            enrich_attachments(v)
    elif isinstance(obj, list):
        for item in obj:
            enrich_attachments(item)

enrich_attachments(data)

with open('$ENRICHED_FILE', 'w') as f:
    json.dump(data, f)
"

# Extract PR context from the merge commit message or env var override
COMMIT_MSG=$(git log -1 --format="%s" "$GITHUB_SHA" 2>/dev/null || echo "")
PR_NUMBER="${TRIAIGE_PR_NUMBER:-}"
PR_TITLE=""
CHANGED_FILES="[]"
COMMIT_MESSAGES="[]"

# Try to extract PR number from merge commit if not provided via env var
if [ -z "$PR_NUMBER" ] && [[ "$COMMIT_MSG" =~ Merge\ pull\ request\ \#([0-9]+) ]]; then
  PR_NUMBER="${BASH_REMATCH[1]}"
fi

if [ -n "$PR_NUMBER" ]; then
  echo "Using PR #$PR_NUMBER"

  # Fetch PR details using gh CLI
  if command -v gh &>/dev/null; then
    PR_TITLE=$(gh pr view "$PR_NUMBER" --json title --jq '.title' 2>/dev/null || echo "")
    CHANGED_FILES=$(gh pr view "$PR_NUMBER" --json files --jq '[.files[].path]' 2>/dev/null || echo "[]")
    COMMIT_MESSAGES=$(gh pr view "$PR_NUMBER" --json commits --jq '[.commits[].messageHeadline]' 2>/dev/null || echo "[]")
  fi
fi

# Fall back to commit message as PR title if we couldn't get it
if [ -z "$PR_TITLE" ]; then
  PR_TITLE="$COMMIT_MSG"
fi

# Get the PR head SHA for merge gate check runs.
# For workflow_dispatch retriggers, TRIAIGE_HEAD_SHA is the main branch SHA,
# so resolve the actual PR head SHA from the PR number.
HEAD_SHA="${TRIAIGE_HEAD_SHA:-$GITHUB_SHA}"
if [ -n "$PR_NUMBER" ] && command -v gh &>/dev/null; then
  PR_HEAD_SHA=$(gh pr view "$PR_NUMBER" --json headRefOid --jq '.headRefOid' 2>/dev/null || echo "")
  if [ -n "$PR_HEAD_SHA" ]; then
    HEAD_SHA="$PR_HEAD_SHA"
  fi
fi

# Build the pr_context JSON
PR_CONTEXT=$(jq -n \
  --arg title "$PR_TITLE" \
  --argjson changed_files "$CHANGED_FILES" \
  --argjson commit_messages "$COMMIT_MESSAGES" \
  --arg repo "$GITHUB_REPOSITORY" \
  --argjson pr_number "${PR_NUMBER:-null}" \
  --arg head_sha "$HEAD_SHA" \
  '{
    title: $title,
    changed_files: $changed_files,
    commit_messages: $commit_messages,
    repo: $repo,
    pr_number: (if $pr_number == null then null else ($pr_number | tonumber) end),
    head_sha: $head_sha
  }')

# Determine triage mode from GitHub event type
# workflow_dispatch with a pr_number input is a PR retrigger, treat as pre_merge
if [ "${GITHUB_EVENT_NAME:-}" = "pull_request" ]; then
  TRIAGE_MODE="pre_merge"
elif [ "${GITHUB_EVENT_NAME:-}" = "workflow_dispatch" ] && [ -n "${TRIAIGE_PR_NUMBER:-}" ]; then
  TRIAGE_MODE="pre_merge"
else
  TRIAGE_MODE="post_merge"
fi

# Build the full payload: enriched Playwright JSON + PR context + triage mode
# Write to file because base64 screenshots make the payload too large for shell args
PAYLOAD_FILE="/tmp/triaige-payload.json"
jq -n \
  --slurpfile report "$ENRICHED_FILE" \
  --argjson pr_context "$PR_CONTEXT" \
  --arg triage_mode "$TRIAGE_MODE" \
  '{
    report_json: $report[0],
    pr_context: $pr_context,
    triage_mode: $triage_mode
  }' > "$PAYLOAD_FILE"

# POST to runner (use @file to avoid "argument list too long")
RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST "${TRIAIGE_RUNNER_URL}/triage-run" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TRIAIGE_API_KEY}" \
  -H "X-GitHub-Token: ${GH_TOKEN:-}" \
  -H "X-OpenAI-Key: ${OPENAI_API_KEY:-}" \
  -d @"$PAYLOAD_FILE")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
  STATUS=$(echo "$BODY" | jq -r '.status // empty')
  if [ "$STATUS" = "setup_required" ]; then
    echo "Triaige: OpenAI API key not configured."
    echo "  Configure your key at the Triaige dashboard settings page"
    echo "  or set the OPENAI_API_KEY secret in this repository."
    exit 0
  fi
  RUN_ID=$(echo "$BODY" | jq -r '.run_id // "unknown"')
  echo "Triage run created: $RUN_ID"
  echo "View results at the Triaige dashboard"
else
  echo "Failed to post to Triaige runner (HTTP $HTTP_CODE)"
  echo "$BODY"
  exit 1
fi
