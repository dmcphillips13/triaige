# AGENTS.md — Triaige (Source of Truth for Agents)

This file is the **single source of truth** for building **Triaige**.
All agents (Claude Code, Codex, Cursor, etc.) should follow this document to avoid drift.

---

## Doc roles

- `AGENTS.md`: canonical product + engineering contract.
- `PROJECT_CONTEXT.md`: current status/handoff between sessions.

---

## 0) One-line mission

**Triaige** is an AI-powered visual regression triage system that ingests Playwright test results (including screenshots), classifies failures as **expected / unexpected / uncertain** using Agentic RAG with triage memory, and takes automated actions (update baselines via PR, file bugs, escalate to humans).

---

## 1) Primary build objective (AI Makerspace Demo Day)

Build a **production-ready agentic AI app** that automates visual regression testing end-to-end. The target is a polished, reliable live demo — quality over breadth.

### Product flow
PR opened/updated (sample app repo) → Playwright tests run → failed screenshots + results → Triaige agent classifies failures → developer reviews in dashboard → approved baselines committed to PR branch, unexpected changes filed as issues → merge gate passes once all failures addressed → PR merges. Known failures (tests already failing on main) are tracked on a health dashboard with linked GitHub issues.

### Demo target
Live end-to-end pipeline: open a PR on the sample app repo, Playwright runs, Triaige classifies, results appear in the dashboard with merge gate blocking until addressed. The full product flow is the definition of "demo-ready."

### Sample app (separate repo)
A separate GitHub repo with a moderate dashboard-style web app (3–5 pages: nav, cards, tables, forms) and Playwright visual tests. PRs to this repo trigger the GitHub Actions workflow. The sample app exists solely to generate realistic visual regressions for the demo.

### Non-goals (out of scope)
- Full multi-tenancy (multiple users/orgs)
- Production monitoring / alerting

---

## 2) Architectural decisions (locked)

### 2.1 Deployment (monorepo)
- **Render**: `apps/runner` (FastAPI backend, free tier)
- **Vercel**: `apps/dashboard` (Next.js UI)

### 2.2 Vector database
- **Qdrant Cloud** (external managed instance, free tier).

### 2.3 Orchestration
- **LangGraph** StateGraph with conditional routing.

### 2.4 LLM + Embeddings
- **GPT-4o-mini** for text reasoning (classification, composition).
- **GPT-4o** for vision analysis (screenshot diffs).
- **text-embedding-3-small** (1536 dimensions) for embeddings.

### 2.5 External tools
- **GitHub API** (primary) — read PR context (changed files, commits, diffs) to inform classification; create PRs/issues as automated actions.
- **Programmatic image diff** — deterministic pixel comparison for screenshot pairs (Pillow-based, no external API).

### 2.6 Observability
- **LangSmith** tracing for all agent runs (set env vars, hooks into LangGraph automatically).

### 2.7 Evaluation
- **RAGAS** for evaluation (local/CI only, not deployed).
- Optional for Demo Day — build if time permits.

---

## 3) Repo layout

### Current state
```
triaige/
  AGENTS.md
  PROJECT_CONTEXT.md
  pnpm-workspace.yaml
  package.json
  .gitignore
  apps/dashboard/                    # Next.js dashboard (Vercel)
    src/app/page.tsx
    src/app/(app)/runs/              # Triage run list + detail views
    src/app/api/runner/[...path]/route.ts   # proxy to runner
    .env.example
  apps/runner/                       # FastAPI backend (Render)
    app/main.py                      # FastAPI app
    app/agent/                       # LangGraph workflow, prompts
    app/tools/                       # GitHub, image diff, vision
    app/retrieval/                   # Qdrant client
  packages/shared/                   # TS shared types (unused for now)
  docs/
```

### Target runner layout
```
apps/runner/
  pyproject.toml
  uv.lock
  render.yaml
  .env.example
  .python-version
  app/
    __init__.py
    main.py                         # FastAPI: /health, /ask, CORS
    schemas.py                      # Pydantic request/response models
    settings.py                     # BaseSettings (all env vars)
    agent/
      __init__.py
      state.py                      # AgentState TypedDict
      graph.py                      # StateGraph definition
      nodes.py                      # Node functions (one per step)
      prompts.py                    # System prompts
      format.py                     # Deterministic response builder
    retrieval/
      __init__.py
      qdrant_store.py               # Qdrant client wrapper
      service.py                    # RetrievedDocument dataclass
    tools/
      __init__.py
      github.py                     # GitHub API client (read PRs, create PRs/issues)
      image_diff.py                 # Programmatic pixel diff (Pillow)
      vision.py                     # GPT-4o screenshot analysis
      playwright_parser.py          # Playwright result parser
    clients/
      __init__.py
      openai_client.py              # Embedding + vision client
    pipeline/
      __init__.py
      data_loader.py                # Load markdown docs, chunk by heading, preserve metadata
  data/
    cases/                          # ~15 past regression case docs
    runbooks/                       # ~10 debugging playbook docs
    known_changes/                  # ~5 expected change docs
  scripts/
    index_corpus.py                 # CLI: load → embed → upsert
  eval/                             # optional
    dataset.jsonl
    run_eval.py
```

### Dashboard
- Proxy route at `api/runner/[...path]/route.ts` forwards to runner (avoids CORS).
- Uses `RUNNER_BASE_URL` env var (server-side, not `NEXT_PUBLIC_`).

### Sample app (separate repo)
- Separate GitHub repo (not in this monorepo).
- 4-page dashboard-style web app (Overview, Users, Settings, Reports) with Playwright visual tests.
- Contains GitHub Actions workflow that triggers on PRs (opened/synchronize) and push-to-main: runs Playwright → POSTs failures to Triaige runner for pre-merge triage; on push-to-main calls `/report-clean` for run cleanup.
- Built in Step 2.

---

## 4) Environment variables

### Runner (Render + local)
| Var | Default | Required |
|---|---|---|
| `QDRANT_URL` | — | Yes |
| `QDRANT_API_KEY` | — | Yes |
| `QDRANT_COLLECTION` | `triaige_triage_memory` | No |
| `OPENAI_API_KEY` | — | Yes |
| `OPENAI_MODEL` | `gpt-4o-mini` | No |
| `OPENAI_EMBEDDINGS_MODEL` | `text-embedding-3-small` | No |
| `OPENAI_EMBEDDINGS_DIMENSIONS` | `1536` | No |
| `GITHUB_TOKEN` | — | No (enriches with PR context when set) |
| `LANGSMITH_API_KEY` | — | No (enables tracing) |
| `LANGSMITH_PROJECT` | `triaige` | No |
| `LANGCHAIN_TRACING_V2` | — | No (set to `true` to enable) |
| `CORS_ORIGINS` | `*` | No |

### Dashboard (Vercel + local)
| Var | Default | Required |
|---|---|---|
| `RUNNER_BASE_URL` | `http://localhost:8000` | Yes (Vercel: Render URL) |

---

## 5) API contract

### `GET /health`
```json
{"status": "ok"}
```

### `POST /ask`

#### Request
```json
{
  "question": "The header spacing shifted by 8px after a design system update. Expected or unexpected?",
  "run_summary": {
    "test_name": "header_layout",
    "url": "https://preview.example.com/dashboard",
    "failure_type": "visual_diff",
    "diff_ratio": 0.03,
    "changed_regions": ["header"],
    "console_errors": [],
    "http_errors": [],
    "playwright_notes": [],
    "screenshot_baseline": null,
    "screenshot_actual": null
  },
  "pr_context": {
    "title": "Update design system tokens",
    "changed_files": ["styles/tokens.css"],
    "commit_messages": ["refactor: update spacing scale"],
    "repo": null,
    "pr_number": null
  }
}
```

`run_summary`, `pr_context`, and all their fields are optional. The `screenshot_*` and `repo`/`pr_number` fields are nullable by default and added incrementally.

Screenshot format: `screenshot_baseline` and `screenshot_actual` accept base64-encoded PNG strings. The runner decodes them server-side for image diff and vision analysis.

#### Response
```json
{
  "classification": "expected",
  "confidence": 0.87,
  "rationale": "The design system token update (PR: 'Update design system tokens') directly affects header spacing. Past case CASE-003 shows identical pattern after a token migration.",
  "citations": [
    {"doc_id": "cases/CASE-003.md", "snippet": "Header shifted 6px after design token v2 rollout...", "source": "qdrant"},
    {"doc_id": "known_changes/CHANGE-002.md", "snippet": "Sprint 47: spacing scale updated from 4px to 8px base...", "source": "qdrant"}
  ],
  "recommended_action": {
    "type": "update_baseline",
    "executed": false,
    "url": null
  },
  "tool_calls": [
    {"tool": "github_read_pr", "query": "owner/repo#42", "used": true}
  ],
  "image_diff": null,
  "vision_summary": null,
  "debug": {
    "intent": "triage",
    "errors": []
  }
}
```

### Classification values
- `expected` — known change explains the diff; recommend baseline update
- `unexpected` — no explanation found; recommend filing a bug
- `uncertain` — partial match or low confidence; recommend human review

### Citation mapping
- `doc_id`: relative path of the source markdown file (matches Qdrant payload `doc_id`)
- `snippet`: chunk text from the Qdrant payload `text` field
- `source`: `"qdrant"`, `"github"`, or `"vision"`

### `image_diff` field (Step 10)
When screenshots are provided, the response includes:
```json
{
  "image_diff": {
    "diff_ratio": 0.032,
    "changed_pixel_count": 4821,
    "total_pixel_count": 150528,
    "changed_regions": ["header"],
    "diff_overlay_base64": "iVBORw0KGgo..."
  }
}
```
The `diff_overlay_base64` is a base64-encoded PNG highlighting changed pixels. The dashboard uses this for the diff overlay view in the screenshot comparison viewer.

### `POST /triage-run` (Step 12 — batch triage)
Accepts an array of failures from a test run. Groups related failures by component + failure pattern, then classifies each group through the agent graph.

```json
{
  "failures": [
    {"question": "...", "run_summary": {...}, "pr_context": {...}},
    {"question": "...", "run_summary": {...}, "pr_context": {...}}
  ]
}
```

Response: array of `AskResponse` objects, one per failure group, with an additional `group` field listing which test names were clustered together.

---

## 6) Agent memory (CoALA framework)

Triaige's memory architecture follows the **CoALA (Cognitive Architectures for Language Agents)** framework from AIE9. Each memory type serves a distinct purpose:

| Memory Type | Purpose | Storage | Status |
|---|---|---|---|
| **Semantic** | Institutional knowledge — cases, runbooks, known changes | Qdrant (`doc_type: case/runbook/known_change`) | Core feature |
| **Episodic** | Past triage decisions as few-shot examples | Qdrant (`doc_type: episode`) | Core feature |
| **Procedural** | Self-improving triage instructions via reflection | Qdrant (`doc_type: procedure`) | Stretch |
| **Short-term** | Conversation context within a triage session | LangGraph checkpointer (`MemorySaver`) | Stretch |
| **Long-term** | Project-level config (repo defaults, thresholds) | LangGraph store (`InMemoryStore`) | Stretch |

### 6.1 Semantic memory (triage knowledge base)

The RAG corpus is Triaige's **institutional memory** — like a senior QA engineer's brain. It stores knowledge about past regressions, debugging procedures, and known expected changes so the agent can say "we've seen this before."

**Document types:**
- `data/cases/*.md` — past regression cases: symptom → root cause → resolution
- `data/runbooks/*.md` — debugging playbooks: what to check, commands, common causes
- `data/known_changes/*.md` — expected diffs from planned changes (design system rollouts, experiments)

**Metadata (YAML front matter):**
```yaml
doc_type: case
component: auth
date: 2026-02-01
tags: [login, 403, cookie]
---
# Title...
```

Required fields: `doc_type`, `component`, `date`, `tags`.

**Chunking strategy:** split on Markdown `##` headings. Each chunk preserves the parent doc's metadata plus `heading` and `chunk_index`. This keeps chunks focused while maintaining traceability.

### 6.2 Episodic memory (learning from past decisions)

When a human approves or rejects a triage classification, the decision is stored as an **episode** in Qdrant. At classification time, the agent retrieves similar episodes and injects them as few-shot examples — showing the LLM *how it classified a similar failure before* and whether the human agreed.

**Episode structure:**
```json
{
  "doc_type": "episode",
  "component": "header",
  "date": "2026-03-05",
  "tags": ["visual_diff", "design_system"],
  "text": "header_layout test: 3% diff after PR 'Update design system tokens'. Classified as expected (0.87). Human approved.",
  "situation": "header_layout test failed with 3% diff ratio after design system token update",
  "classification": "expected",
  "confidence": 0.87,
  "human_feedback": "approved",
  "original_rationale": "Design system token update directly affects header spacing..."
}
```

The `text` field is embedded for similarity search. At query time, matching episodes are formatted as few-shot examples in the system prompt:

```
Past decision #1:
Situation: header_layout test failed with 3% diff ratio after design system token update
Classification: expected (confidence: 0.87)
Human feedback: approved
```

This is more powerful than just adding case documents because few-shot examples directly steer LLM classification behavior.

### 6.3 Procedural memory (self-improving instructions) — stretch

The agent stores its own triage instructions in Qdrant (`doc_type: procedure`). After accumulating feedback, a reflection step uses the LLM to rewrite the instructions based on patterns — e.g., if humans consistently override "uncertain" → "expected" for design system changes, the instructions are updated to be more confident about those patterns. Instructions are versioned for audit trail.

---

## 7) Qdrant Cloud

### Collection
- Name: `triaige_triage_memory`
- Vectors: `size=1536, distance=Cosine`

### Payload per point
| Field | Type | Example |
|---|---|---|
| `doc_id` | `str` | `"cases/CASE-003.md"` |
| `doc_type` | `str` | `"case"` / `"runbook"` / `"known_change"` / `"episode"` |
| `component` | `str` | `"auth"` |
| `date` | `str` | `"2026-02-01"` |
| `tags` | `list[str]` | `["login", "403", "cookie"]` |
| `heading` | `str` | `"Root Cause"` |
| `text` | `str` | chunk content |
| `chunk_index` | `int` | `2` |

### ID strategy
`uuid5(NAMESPACE_URL, f"{doc_id}::{chunk_index}")` — deterministic, idempotent upserts.

### Retrieval
- Baseline: dense cosine similarity, top-k=5.
- Filter by `doc_type` and/or `component` when context is available.
- Upgrade path: Qdrant Cloud sparse vectors for hybrid dense+sparse retrieval.

---

## 8) Agentic RAG workflow (LangGraph)

### Initial graph nodes
1. `classify_query` — determine intent and extract failure signals via GPT-4o-mini
2. `fetch_pr_context` — read PR details from GitHub API (changed files, commits, diff) if `repo` and `pr_number` provided
3. `retrieve_semantic` — Qdrant search filtered by `doc_type` in (`case`, `runbook`, `known_change`) and optionally by `component`
4. `retrieve_episodes` — Qdrant search filtered by `doc_type: episode`; results formatted as few-shot examples in the system prompt
5. `compose_answer` — structured classification + rationale grounded in semantic context + episodic few-shot examples

### Additional graph nodes
6. `compute_image_diff` — programmatic pixel comparison of screenshots; outputs feed into vision prompt [conditional]
7. `analyze_screenshots` — GPT-4o vision analysis using baseline, actual, and diff overlay + diff metrics as context [conditional]
8. `devil_advocate` — scope/defect review: checks whether visual changes align with PR description and flags defects
9. `commit_baselines` — commit approved baseline screenshots directly to the PR branch (via GitHub Git Data API); triggered from dashboard "Submit Changes" button
10. `store_episode` — after human feedback, save the decision as an episode in Qdrant [triggered by feedback endpoint]

### Routing rules
- Always retrieve semantic memory and episodic memory from Qdrant (RAG-first).
- Fetch PR context if `repo` and `pr_number` are provided in the request.
- Run image diff + vision only if `screenshot_baseline` and `screenshot_actual` are provided.
- Run devil's advocate review after vision analysis to assess scope alignment and defects.
- Commit baselines to PR branch after human approves failures as expected; triggered from dashboard "Submit Changes".
- Store episode after human approves/rejects a classification via the feedback endpoint.
- Degrade gracefully: accumulate errors in state, never crash on tool failure.

### Tool calling policy
- Tools are **pure data fetchers** — no LLM calls inside tools.
- LLM calls happen only in graph nodes (classify, analyze_screenshots, compose).

---

## 9) Response format

Responses are built deterministically in `format.py` where possible. The LLM generates the rationale text; Python builds the structure.

### Classification badge
- `expected` → recommend `update_baseline`
- `unexpected` → recommend `open_bug`
- `uncertain` → recommend `request_human_review`

### Rationale
Exactly 3 markdown bullets. Each bullet: bold key fact + short explanation after a dash. Max 12 words per bullet. No filler words. Example: `- **Card backgrounds changed** — matches color token update`.

### Citations
List of `{doc_id, snippet, source}` from Qdrant retrieval + GitHub context + vision analysis.

---

## 10) UI theme

### Colors
- **Light theme** — white/light background.
- **Stoplight classification colors**: red (`unexpected`), yellow (`uncertain`), green (`expected`).
- **Black text** — primary text and headings.
- Logo: red cross + "riaige" in dark navy with "ai" highlighted in red (on local machine, will be added to `apps/dashboard/public/`).

### Dashboard views
- **PR tab** (primary): pre-merge runs from open PRs; developers approve/reject failures; merge gate blocks until all addressed.
- **Main tab** (health dashboard): known failures on main, each linked to an open GitHub issue; should be empty if merge gate is working.
- **Closed tab**: archived runs (auto-closed on merge/supersede, or manually closed).
- **Failure card expanded**: rationale (3 bullets) → image diff stats → screenshots (side-by-side, swipe, diff overlay) → vision analysis (collapsed) → citations (collapsed) → tool calls (collapsed).
- **Actions**: approve → baseline committed to PR branch; reject → GitHub issue filed. Both satisfy the merge gate.

---

## 11) Deployment

### Backend (Render)
- Root: `apps/runner`
- Runtime: Python (native, via `render.yaml`)
- Build: `pip install uv && uv sync`
- Start: `uv run uvicorn app.main:app --host 0.0.0.0 --port $PORT`

### Frontend (Vercel)
- Root: `apps/dashboard`
- `RUNNER_BASE_URL` → Render backend URL

### Local development
```bash
pnpm run start:dev
```
Starts both runner (uvicorn, port 8000) and dashboard (next dev, port 3000).

---

## 12) Repo hygiene

### Must NOT commit
- `apps/runner/.venv/`, `__pycache__/`, `*.pyc`
- `apps/dashboard/node_modules/`, `.next/`
- `.env`, `.env.local`
- `.pnpm-store/`

### Must commit
- `apps/runner/.env.example`, `apps/dashboard/.env.example`
- `apps/runner/uv.lock`

---

## 13) How to work with agents (process rules)

When making changes:
1. Make one step at a time.
2. List files changed/created.
3. Provide commands to run to verify.
4. Do not refactor unrelated parts.
5. If uncertain, prefer adding small validation logs over complex abstractions.
6. Stop after each step for review before committing.
7. Add documentation to every new file (Python and TypeScript/TSX). For Python: module docstrings and one-line docstrings on public functions. For TypeScript/TSX: a top-of-file `//` comment block explaining the file's purpose, key design decisions, and how it fits into the system. For React components: document props and non-obvious behavior. Keep it concise — enough that a new reader understands the "what" and "why" without reading every line.

Commit messages: plain imperative sentences (e.g., "Add GitHub API client for PR context"). No conventional-commit prefixes. No co-authorship attribution. No references to plan steps.

---

## 14) Build steps

1. Runner scaffold: `pyproject.toml`, FastAPI with stub `/health` and `/ask`, settings, schemas
2. Sample app + Playwright suite: separate repo, 3–5 page dashboard app, Playwright visual tests, baseline screenshots
3. Triage memory corpus: ~30 synthetic markdown docs with YAML front matter metadata
4. Qdrant indexing pipeline: data loader, chunking, embedding, upsert script, dense retriever
5. GitHub API tool: read PR context (changed files, commits, diff)
6. LangGraph agentic workflow wired to `/ask`
7. Playwright result ingestion + `/triage-run` endpoint with persistence
8. Dashboard triage UI: display triage runs, detail view, approve/reject
9. Programmatic image diff: deterministic pixel comparison (Pillow) — diff ratio, changed regions, overlay image
10. GPT-4o vision: screenshot analysis node using baseline, actual, diff overlay + metrics as context
11. Batch triage: failure grouping by component + pattern, group-level classification
12. Screenshot comparison viewer: side-by-side, swipe slider (`react-compare-slider`), diff overlay (GitHub Desktop-style)
13. Human-in-the-loop + episodic memory: approve/reject in dashboard; store decisions as episodes in Qdrant (`doc_type: episode`); retrieve similar episodes as few-shot examples at classification time (CoALA episodic memory pattern)
14. GitHub automated actions: label runs by triggering PR (title + link on run list and detail); "Update Baselines" button batches all approved expected failures into a single PR via Git Data API; adds `snapshot_path` to `RunSummary`/`TriageFailureResult` and `pr_title`/`pr_url`/`repo` to `TriageRunResponse`/`TriageRunSummary`
15. Deploy runner to Render (ops-only — render.yaml ready, needs service creation + env vars; deploy includes steps 9-14, unblocks OAuth callback URL)
16. GitHub App OAuth + repo linking: GitHub App (not OAuth App) for per-repo access control, sign-in flow, JWT session cookie, token forwarding to runner, "link a repo" UI with installation-scoped repo dropdown
17. GitHub Actions workflow: merged PR in sample app repo → Playwright → POST /triage-run → results in dashboard
18. Triage mode settings + submission actions: pre-merge/post-merge checkboxes per repo; PR comment posting for pre-merge runs; "Submit Changes" replaces "Update Baselines" — approved failures create baseline update PR, rejected failures create GitHub issues with bug reports linking to dashboard; submission results persisted in localStorage; open/closed run tabs with close run button; pre-merge runs are read-only (no approve/reject, no submit, no close)
19. Runner-side Postgres persistence: Neon free tier, asyncpg, 5 tables (runs, failure_results, verdicts, submissions, repo_settings), swap dashboard from localStorage to API-backed storage; runs survive server restarts
20. Runs page redesign — Main/PR/Closed tabs with known failure annotations and submission-aware action gating:
    - **Main tab** (default): post-merge runs on main branch, fully actionable (approve/reject, submit changes, close)
    - **PR tab**: pre-merge runs from open PRs, informational only (read-only, no actions)
    - **Closed tab**: runs manually closed by reviewer (read-only archive)
    - **Known failure annotations** (both Main and PR tabs): if a test has been failing since a previous merged run, show "Failing since PR #X: title" with link to the PR that introduced the regression; on PR runs this tells the developer which failures are pre-existing vs caused by their changes
    - **Open submission links**: if an open baseline PR or GitHub issue exists for a failing test, show the link on the failure card so reviewers know action is already in progress; also include these links in the PR comment posted for pre-merge runs
    - **Action gating on Main tab**: if a failure already has an open PR or issue from a previous run, hide approve/reject buttons to prevent duplicate submissions; known failures with no open submission allow normal approve/reject
20.1. Net-new failure filtering: both post-merge and pre-merge runs only show failures not present in previous open post-merge runs for the same repo; if zero new failures remain, skip run creation entirely (no empty runs on dashboard); post-merge runs can only be closed when all failures are addressed — every failure must have a baseline update PR or issue opened before close is allowed; pre-merge runs are non-actionable (read-only) and auto-close when a newer run for the same PR supersedes them or when the PR merges and a post-merge run is created; PR comments also only show net-new failures; default triage mode to both pre-merge and post-merge enabled
21. Actionable pre-merge workflow with merge gate:
    - **Pre-merge runs become the primary workspace**: developers review failures on the PR tab and must address every failure before merging
    - **Expected changes → approve → baseline committed to PR branch**: approved baselines are committed directly to the PR branch (not a separate PR); grouped approvals go in one commit, later approvals as separate commits; tests re-run against updated baselines
    - **Unexpected changes → file issue**: opens a GitHub issue acknowledging the bug; satisfies the merge gate without requiring a fix in this PR
    - **Merge gate (on by default)**: a GitHub check status stays pending until every net-new failure has either a baseline commit or an issue; pre-existing failures (already failing on main with an open issue) do not count toward the gate; toggle added to `repo_settings` (default on) so teams can opt out
    - **Pre-existing failures shown but not actionable**: PR runs show all failures, but pre-existing ones (failing on main with an open issue) are visually distinct and non-actionable — just show the issue link as context; only net-new failures require action
    - **Main tab becomes a health dashboard**: shows tests currently failing on main, each linked to an open issue; no approve/reject — action already happened in the PR; should be empty if the gate is working; only unexpected changes with open issues appear here
    - **Post-merge runs are diagnostic only**: capture the current state of main after each merge; no triage workflow, just a snapshot feeding the Main tab health view
    - **Auto-close pre-merge runs**: same as today — superseded by newer run for same PR, or when PR merges
22. Failure card UX + rationale format: reorder expanded sections (rationale first, vision analysis collapsed), improve rationale prompt (3 short bullets, 12-word max, bold key facts), fix markdown bullet rendering
23. Classification improvements: two-signal classification (visual diff + git diff + PR description), mixed-scope separation, temperature=0, git diff context, few-shot calibration, per-component analysis
24. Repos landing page + add repo flow: after login, land on a repos page showing linked repos as cards (repo name, last run status, failure count, setup status); click a repo → see its runs; "Connect Repo" flow installs the GitHub App on selected repos; each repo card shows a setup checklist (GitHub App installed, API key generated, `triaige init` run — detected by first successful run); unconfigured repos are rejected by the runner
25. Settings UI: per-repo configuration page in dashboard; auto-generates API key and displays runner URL for easy copy-paste into CLI; triage mode toggles, merge gate toggle (on by default); shows the exact `npx triaige init` command with inline instructions; all config that currently lives in env vars moves here
26. Repo setup CLI (`npx triaige init`): guided setup run inside a target repo that handles all configuration for a frictionless first run:
    - **Prerequisites check**: verifies `gh` CLI installed and authenticated (if missing, guides user to install and run `gh auth login`; falls back to manual `.env.example` if `gh` unavailable)
    - **Dashboard connection**: verifies repo is connected on the Triaige dashboard; checks GitHub App is installed on the repo with required permissions (Contents, Pull Requests, Checks read/write — warns if Checks permission is missing since merge gate will silently fail)
    - **Secrets setup**: prompts for API key and runner URL (copied from dashboard settings), sets them as GitHub repo secrets via `gh secret set` (`TRIAIGE_RUNNER_URL`, `TRIAIGE_API_KEY`)
    - **Playwright config**: detects existing Playwright config; verifies JSON reporter is configured (`reporter: [['json', { outputFile: 'test-results/results.json' }]]`) since `post-failures.sh` depends on this path; adds it if missing; detects monorepo structure and adjusts paths
    - **Workflow scaffolding**: generates `.github/workflows/visual-regression.yml` with correct permissions block (`contents: write`, `pull-requests: write`, `checks: write`), baseline commit skip condition (`if: "!contains(github.event.head_commit.message, 'triaige/update-baselines')"`), and app build/start commands (prompted from user); generates `scripts/post-failures.sh` and sets executable bit (`chmod +x`)
    - **Branch protection setup**: if merge gate is enabled (default), offers to add "Triaige Visual Regression" as a required status check on the default branch via `gh api` with `strict: true` (require branches to be up-to-date before merging); uses the user's own `gh` credentials (no extra GitHub App permissions needed); skips gracefully if branch protection already exists or if user declines
    - **Initial baselines**: offers to generate initial baselines (`npx playwright test --update-snapshots`) if app can be started locally; commits them so the first PR run has a clean comparison
    - **Validation**: runs a dry-run check — verifies secrets are set, workflow file is valid YAML, script is executable, Playwright config has JSON reporter, branch protection is configured; prints a summary of what's ready and what needs manual attention
27. Polish + Loom prep
28 (stretch). Issue attribution agent: a separate async agent that runs after issues are filed; scans recent merge history and adds attribution comments to issues linking the likely responsible PR and author
29 (stretch). Baseline knowledge doc: LLM auto-generates semantic descriptions of each page from baseline screenshots and app code; classifier references during triage for richer context
30 (stretch). Separate test repo support: allow linking a dedicated Playwright/baselines repo separate from the UI repo; baseline commits and issues target the test repo; merge gate still applies to the UI repo's PRs; configured via a "baseline target repo" setting in repo_settings
31 (stretch). Auto-approve baselines above confidence threshold (needs discussion; default should always be human-in-the-loop)
32 (stretch). Procedural memory: agent reflection on feedback patterns → self-updating triage instructions, versioned in Qdrant
33 (stretch). Component ownership lookup
34 (stretch). Auto-close main dashboard failures when linked GitHub issue closes: webhook endpoint for `issues` closed events
35 (stretch). RAGAS evaluation

---

## 15) Testing

Automated tests are deferred to post-Demo Day unless they help development. Focus dev time on features and polish.

---

## 16) Session continuity

- `PROJECT_CONTEXT.md` — current status, file inventory, key decisions
- Update after substantial changes

---
