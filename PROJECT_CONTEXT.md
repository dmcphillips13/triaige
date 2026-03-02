# PROJECT_CONTEXT.md — Triaige (Session Handoff)

Last updated: 2026-03-02

---

## Current status

**Phase:** Pre-build (planning complete, no code written yet)

### Completed
- [x] Project planning and scoping
- [x] Architecture decisions locked (see AGENTS.md §2)
- [x] API contract defined (see AGENTS.md §5)
- [x] AGENTS.md rewritten for Demo Day scope
- [x] PROJECT_CONTEXT.md created

### In progress
- [ ] Step 1: Runner scaffold (pyproject.toml, FastAPI stubs, settings, schemas)

### Not started
- [ ] Step 2: Triage memory corpus (~30 docs)
- [ ] Step 3: Qdrant Cloud provisioning + indexing pipeline + dense retriever
- [ ] Step 4: Tavily search wrapper
- [ ] Step 5: LangGraph agentic workflow wired to /ask
- [ ] Step 6: Deploy runner to Render
- [ ] Step 7: Dashboard triage UI
- [ ] Step 8: GPT-4o vision analysis (Week 2)
- [ ] Step 9: Playwright result parser (Week 2)
- [ ] Step 10: GitHub integration (Week 2)
- [ ] Step 11: RAGAS evaluation (Week 2, if time)
- [ ] Step 12: Polish + Loom (Week 2)

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
| Corpus | LLM-generated synthetic triage memory | ~30 docs: cases, runbooks, known changes |
| Process | Step-by-step commits | Mirror Mismatch workflow (AGENTS.md §12) |

---

## External dependencies

| Service | Status | Notes |
|---|---|---|
| Qdrant Cloud | Account exists, no cluster | Must provision before Step 3 |
| OpenAI API | Needs key | For GPT-4o-mini + embeddings |
| Tavily API | Needs key | For web search tool |
| Render | Not set up | Free tier for runner |
| Vercel | Dashboard scaffold deployed locally | Needs production deployment |
| GitHub API | Not needed until Week 2 | For PR/issue automation |

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

This project mirrors the **Mismatch** repo architecture (`/Users/denismcphillips/code/mismatch`):
- Same stack: FastAPI + LangGraph + Qdrant Cloud + Next.js
- Same deployment: Render (backend) + Vercel (frontend)
- Same patterns: tools as pure data fetchers, deterministic formatting, graceful degradation
- Same process: step-by-step commits, one change at a time

---
