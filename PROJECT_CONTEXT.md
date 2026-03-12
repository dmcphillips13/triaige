# PROJECT_CONTEXT.md — Triaige (Session Handoff)

Last updated: 2026-03-09

---

## Current status

**Phase:** Core pipeline complete through Step 18. Final week — Postgres persistence, repo management UX, setup CLI, then polish.

### Completed
- [x] Project planning and scoping
- [x] Architecture decisions locked (see AGENTS.md §2)
- [x] API contract defined (see AGENTS.md §5)
- [x] AGENTS.md rewritten for Demo Day scope
- [x] PROJECT_CONTEXT.md created
- [x] Step 1: Runner scaffold (pyproject.toml, FastAPI stubs, settings, schemas)
- [x] Step 2: Sample app + Playwright suite (separate repo)
- [x] Step 3: Triage memory corpus (~30 docs)
- [x] Step 4: Qdrant Cloud provisioning + indexing pipeline + dense retriever
- [x] Step 5: GitHub API tool (read PR context)
- [x] Step 6: LangGraph agentic workflow wired to /ask
- [x] Step 7: Playwright result ingestion + /triage-run endpoint with persistence
- [x] Step 8: Dashboard triage UI — display triage runs, detail view, approve/reject
- [x] Step 9: Programmatic image diff (Pillow pixel comparison, region detection, overlay)
- [x] Step 10: GPT-4o vision analysis (multi-modal screenshot analysis node)
- [x] Step 11: Batch triage with failure grouping by component + pattern
- [x] Step 12: Screenshot comparison viewer (side-by-side, swipe slider, diff overlay)
- [x] Step 13: Human-in-the-loop + episodic memory (approve/reject → Qdrant episodes → few-shot retrieval)
- [x] Step 14: GitHub automated actions — PR-labeled runs + "Update Baselines" PR for approved expected failures via Git Data API
- [x] Step 15: Deploy runner to Render + dashboard to Vercel
- [x] Step 16: GitHub App OAuth + repo linking (sign-in flow, per-repo access control, token forwarding, link a repo UI)
- [x] Step 17: GitHub Actions workflow (merged PR in sample app → Playwright → POST /triage-run)
- [x] Step 18: Triage mode settings + submission actions — pre-merge/post-merge checkboxes, PR comment posting, "Submit Changes" (approved → baseline update PR, rejected → GitHub issue with bug report), submission results persisted in localStorage, open/closed run tabs with close run button, pre-merge runs are read-only

### Up next (final week — all items are must-haves)
- [x] Step 19: Runner-side Postgres persistence — Neon free tier, asyncpg, 5 tables (runs, failure_results, verdicts, submissions, repo_settings), swap dashboard from localStorage to API
- [x] Step 20: Runs page redesign — Main/PR/Closed tabs; known failure annotations; submission-aware action gating
    - **Main tab** (default): post-merge runs on main branch, fully actionable (approve/reject, submit changes, close)
    - **PR tab**: pre-merge runs from open PRs, informational only (read-only, no actions)
    - **Closed tab**: runs manually closed by reviewer (read-only archive)
    - **Known failure annotations** (both Main and PR tabs): if a test has been failing since a previous merged run, show "Failing since PR #X: title" with a link to the PR that introduced the regression
    - **Open submission links**: if an open baseline PR or GitHub issue exists for a failing test, show the link on the failure card; also include these links in the PR comment posted for pre-merge runs
    - **Action gating on Main tab**: if a failure already has an open PR or issue, hide approve/reject buttons (prevents duplicate submissions); if it's a known failure with no open submission, allow approve/reject normally
- [ ] Step 20.1: Auto-close superseded runs — when a new post-merge run comes in for the same repo, automatically close the previous open run
- [ ] Step 20.2: Collapse known failures in PR comment — lead with new failure count, collapse known failures into a `<details>` block so the signal is "what's new"; known failures should clearly indicate they were not caused by this PR
- [ ] Step 20.3: Fix post-merge classification — push-triggered runs extract PR number from merge commit but may lose PR description context, causing all failures to classify as unexpected; ensure classifier receives full PR description and changed files
- [ ] Step 21: Repos landing page + add repo flow — after login, land on a repos page showing linked repos as cards (repo name, last run status, failure count); click a repo → see its runs; "Connect Repo" flow to link a new repo via GitHub App installation scope
- [ ] Step 22: Repo setup CLI — `npx triaige init` (or similar) run inside a target repo to scaffold the GitHub Actions workflow file, Playwright config, post-failures script, and guide the user through secrets setup; replaces manual repo configuration
- [ ] Step 23: Settings UI — per-repo configuration page in dashboard for API keys (OpenAI, etc.), triage mode toggles, and other config that currently lives in env vars
- [ ] Step 24: Procedural memory — self-improving triage instructions via reflection (stretch)
- [ ] Step 25: Auto-approve baselines above confidence threshold (stretch, lowest priority)
- [ ] Step 26: Component ownership lookup (stretch)
- [ ] Step 27: RAGAS evaluation (stretch)
- [ ] Step 28: Polish + Loom

---

## Key decisions

| Decision | Choice | Rationale |
|---|---|---|
| LLM (text) | GPT-4o-mini | Cheapest capable model; best LangChain integration |
| LLM (vision) | GPT-4o | Vision capabilities for screenshot diff analysis |
| Embeddings | text-embedding-3-small (1536d) | Pairs with OpenAI; one API key |
| Vector DB | Qdrant Cloud (free tier) | Production-ready, metadata filtering, hybrid search |
| Orchestration | LangGraph | Agentic state machine with conditional routing |
| Runner deploy | Render (free tier) | Better Python support than Vercel |
| Dashboard deploy | Vercel | Already scaffolded; natural fit for Next.js |
| External tool | GitHub API (primary) | Read PR context for classification; create PRs/issues for actions |
| Image analysis | GPT-4o vision + Pillow pixel diff | Qualitative + quantitative screenshot comparison |
| Sample app | Separate repo, 3–5 page dashboard | Realistic visual regressions for demo |
| Corpus | LLM-generated synthetic triage memory | ~30 docs: cases, runbooks, known changes |
| Observability | LangSmith | Traces all agent runs automatically via LangGraph |
| UI theme | Light theme, stoplight colors, black text | Red=unexpected, yellow=uncertain, green=expected |
| CI trigger | GitHub Actions | Merged PR → Playwright → Triaige |
| Memory architecture | CoALA framework (AIE9) | Semantic + episodic (core), procedural (stretch) |
| Feedback loop | Episodic memory in Qdrant | Approved decisions become few-shot examples for future classifications |
| Testing | Deferred to post-Demo Day | Focus dev time on features and polish |
| Demo format | Live end-to-end pipeline | Full product flow is the definition of demo-ready |
| Process | Step-by-step commits | Mirror Mismatch workflow (AGENTS.md §13) |

---

## External dependencies

| Service | Status | Notes |
|---|---|---|
| Qdrant Cloud | Provisioned | Collection `triaige_triage_memory`, 1536d cosine |
| OpenAI API | Configured | GPT-4o-mini + GPT-4o vision + text-embedding-3-small |
| GitHub App | Configured | Triaige app with Contents + Pull Requests permissions |
| LangSmith | Configured | Tracing enabled via LangGraph |
| Render | Deployed | https://triaige-runner.onrender.com |
| Vercel | Deployed | https://triaige-dashboard.vercel.app/ |
| Sample app repo | Created | github.com/dmcphillips13/triaige-sample-app |

---

## File inventory

### Exists
| Path | Purpose |
|---|---|
| `AGENTS.md` | Canonical product + engineering contract |
| `PROJECT_CONTEXT.md` | This file — session handoff |
| `pnpm-workspace.yaml` | Monorepo workspace config |
| `package.json` | Root scripts |
| `.gitignore` | Ignore patterns (Python + Node) |
| `apps/dashboard/` | Next.js scaffold with proxy route |
| `apps/dashboard/src/app/api/runner/[...path]/route.ts` | Proxy to runner backend |
| `apps/runner/.gitkeep` | Placeholder (will be replaced by real files) |
| `packages/shared/` | TS shared types (unused for now) |

### Must create (Step 1)
| Path | Purpose |
|---|---|
| `apps/runner/pyproject.toml` | uv project with all deps |
| `apps/runner/.env.example` | Documented env vars |
| `apps/runner/app/main.py` | FastAPI app with /health and /ask stubs |
| `apps/runner/app/schemas.py` | Pydantic models (AskRequest, AskResponse, etc.) |
| `apps/runner/app/settings.py` | BaseSettings for env var loading |
| Root `package.json` update | Add `start:dev` script |

---

## Architecture reference

This project follows the same architecture as the **Mismatch** repo:
- Same stack: FastAPI + LangGraph + Qdrant Cloud + Next.js
- Same deployment: Render (backend) + Vercel (frontend)
- Same patterns: tools as pure data fetchers, deterministic formatting, graceful degradation
- Same process: step-by-step commits, one change at a time

---
