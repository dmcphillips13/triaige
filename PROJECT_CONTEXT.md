# PROJECT_CONTEXT.md — Triaige (Session Handoff)

Last updated: 2026-03-07

---

## Current status

**Phase:** Core agent built, moving to ingestion + UI

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

### Up next
- [ ] Step 7: Playwright result ingestion + /triage-run endpoint with persistence
- [ ] Step 8: Dashboard triage UI — display triage runs, detail view, approve/reject
- [ ] Step 9: Programmatic image diff
- [ ] Step 10: GPT-4o vision analysis (uses image diff output as context)
- [ ] Step 11: Batch triage with failure grouping
- [ ] Step 12: Screenshot comparison viewer (side-by-side, swipe slider, diff overlay)
- [ ] Step 13: Human-in-the-loop + episodic memory (approve/reject → store as episodes → few-shot retrieval)
- [ ] Step 14: GitHub automated actions (create PRs/issues)
- [ ] Step 15: Deploy runner to Render (ops-only — render.yaml ready, needs service creation + env vars)
- [ ] Step 16: GitHub Actions workflow (merged PR in sample app → Playwright → POST /triage-run)
- [ ] Step 17: Runner-side Postgres persistence — Neon free tier, /runs CRUD, swap dashboard from localStorage to API *(low priority — localStorage works for demo)*
- [ ] Step 18: Procedural memory — self-improving triage instructions via reflection (stretch)
- [ ] Step 19: Component ownership lookup (stretch)
- [ ] Step 20: RAGAS evaluation (stretch)
- [ ] Step 21: Polish + Loom

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
| Qdrant Cloud | Account exists, no cluster | Must provision before Step 4 |
| OpenAI API | Needs key | For GPT-4o-mini + GPT-4o vision + embeddings |
| GitHub API | Needs token (optional) | Enriches with PR context when set; read PRs + create PRs/issues for actions |
| LangSmith | Needs key | Optional observability — hooks into LangGraph automatically |
| Render | Not set up | Free tier for runner |
| Vercel | Dashboard scaffold deployed locally | Needs production deployment |
| Sample app repo | Not created | Separate GitHub repo for demo target (Step 2) |

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
