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

### MVP (Week 1)
1. Working Agentic RAG triage assistant behind `/health` and `/ask` endpoints.
2. RAG corpus of ~30 triage memory documents (cases, runbooks, known changes) indexed in Qdrant Cloud.
3. LangGraph orchestration with conditional Tavily web search.
4. Deployed runner (Render) + dashboard (Vercel) — end-to-end demo.

### Post-MVP features (Week 2, ordered by demo impact)
1. **GPT-4o vision analysis** — agent analyzes baseline vs actual screenshots to describe visual differences.
2. **Playwright result ingestion** — parse real Playwright JSON test results into the agent.
3. **GitHub integration** — automated PR creation for baseline updates, issue filing for bugs.
4. **Human feedback loop** — approve/reject classifications in dashboard, feed back to corpus.
5. **RAGAS evaluation** — baseline metrics, optional retriever upgrade + comparison table.

### Non-goals (out of scope)
- Full CI/CD pipeline integration (webhook triggers)
- Multi-repo support
- User auth / multi-tenancy
- Production monitoring / alerting

---

## 2) Architectural decisions (locked)

### 2.1 Deployment (monorepo)
- **Render**: `apps/runner` (FastAPI backend, free tier)
- **Vercel**: `apps/dashboard` (Next.js UI)

### 2.2 Vector database
- **Qdrant Cloud** (external managed instance, free tier).
- Do **not** use Chroma or FAISS.

### 2.3 Orchestration
- **LangGraph** StateGraph with conditional routing (same pattern as Mismatch).

### 2.4 LLM + Embeddings
- **GPT-4o-mini** for text reasoning (classification, composition).
- **GPT-4o** for vision analysis (screenshot diffs).
- **text-embedding-3-small** (1536 dimensions) for embeddings.

### 2.5 External tools
- **Tavily** Search API for web search (unknown error signatures, external docs).
- **GitHub API** for PR/issue creation (Week 2).

### 2.6 Evaluation
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
  apps/dashboard/                    # Next.js scaffold (exists)
    src/app/page.tsx
    src/app/api/runner/[...path]/route.ts   # proxy to runner
    .env.example
  apps/runner/                       # empty — must be created
  packages/shared/                   # TS shared types (unused for now)
  docs/
```

### Target runner layout (mirrors Mismatch structure)
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
      tavily.py                     # Tavily web search client
      vision.py                     # GPT-4o screenshot analysis [Week 2]
      github.py                     # GitHub PR/issue client [Week 2]
      playwright_parser.py          # Playwright result parser [Week 2]
    clients/
      __init__.py
      openai_client.py              # Embedding + vision client
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
| `TAVILY_API_KEY` | — | Yes |
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

`run_summary`, `pr_context`, and all their fields are optional. The `screenshot_*` and `repo`/`pr_number` fields are Week 2 additions — nullable by default.

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
    {"tool": "tavily_search", "query": "", "used": false}
  ],
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
- `source`: `"qdrant"`, `"tavily"`, or `"vision"`

---

## 6) Triage memory RAG corpus

### Purpose
The RAG corpus is Triaige's **institutional memory** — like a senior QA engineer's brain. It stores knowledge about past regressions, debugging procedures, and known expected changes so the agent can say "we've seen this before."

### Document types
- `data/cases/*.md` — past regression cases: symptom → root cause → resolution
- `data/runbooks/*.md` — debugging playbooks: what to check, commands, common causes
- `data/known_changes/*.md` — expected diffs from planned changes (design system rollouts, experiments)

### Metadata (YAML front matter)
```yaml
doc_type: case
component: auth
date: 2026-02-01
tags: [login, 403, cookie]
severity: high
---
# Title...
```

Required fields: `doc_type`, `component`, `date`, `tags`.

### Chunking strategy
Split on Markdown `##` headings. Each chunk preserves the parent doc's metadata plus `heading` and `chunk_index`. This keeps chunks focused while maintaining traceability.

---

## 7) Qdrant Cloud

### Collection
- Name: `triaige_triage_memory`
- Vectors: `size=1536, distance=Cosine`

### Payload per point
| Field | Type | Example |
|---|---|---|
| `doc_id` | `str` | `"cases/CASE-003.md"` |
| `doc_type` | `str` | `"case"` / `"runbook"` / `"known_change"` |
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

### Graph nodes
1. `classify_query` — determine intent and extract failure signals via GPT-4o-mini
2. `retrieve_internal` — Qdrant search filtered by component/doc_type
3. `analyze_screenshots` — GPT-4o vision analysis of baseline vs actual [Week 2, conditional]
4. `maybe_web_search` — Tavily search if internal retrieval is insufficient
5. `compose_answer` — structured classification + rationale grounded in context

### Routing rules
- Always retrieve from Qdrant first (RAG-first).
- Call Tavily only if: low retrieval confidence, unknown error signature, or question requires external docs.
- Call vision only if: `screenshot_baseline` and `screenshot_actual` are provided.
- Degrade gracefully: accumulate errors in state, never crash on tool failure.

### Tool calling policy
- Tools are **pure data fetchers** — no LLM calls inside tools.
- LLM calls happen only in graph nodes (classify, analyze_screenshots, compose).
- Same pattern as Mismatch.

---

## 9) Response format

Responses are built deterministically in `format.py` where possible. The LLM generates the rationale text; Python builds the structure.

### Classification badge
- `expected` → recommend `update_baseline`
- `unexpected` → recommend `open_bug`
- `uncertain` → recommend `request_human_review`

### Rationale
Short paragraph grounded in retrieved context. Must reference specific cases/runbooks when available.

### Citations
List of `{doc_id, snippet, source}` from Qdrant retrieval + Tavily results + vision analysis.

---

## 10) Deployment

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

## 11) Repo hygiene

### Must NOT commit
- `apps/runner/.venv/`, `__pycache__/`, `*.pyc`
- `apps/dashboard/node_modules/`, `.next/`
- `.env`, `.env.local`
- `.pnpm-store/`

### Must commit
- `apps/runner/.env.example`, `apps/dashboard/.env.example`
- `apps/runner/uv.lock`

---

## 12) How to work with agents (process rules)

When making changes:
1. Make one step at a time.
2. List files changed/created.
3. Provide commands to run to verify.
4. Do not refactor unrelated parts.
5. If uncertain, prefer adding small validation logs over complex abstractions.
6. Stop after each step for review before committing.

Commit messages: plain imperative sentences (e.g., "Add Tavily search wrapper"). No conventional-commit prefixes. No co-authorship attribution. No references to plan steps.

---

## 13) Build steps

### Week 1 — MVP
1. Runner scaffold: pyproject.toml, FastAPI with stub `/health` and `/ask`, settings, schemas
2. Triage memory corpus: ~30 synthetic markdown docs with metadata
3. Qdrant indexing pipeline: data loader, chunking, embedding, upsert script, dense retriever
4. Tavily search wrapper
5. LangGraph agentic workflow wired to `/ask`
6. Deploy runner to Render
7. Dashboard triage UI + verify proxy

### Week 2 — End-to-end pipeline
8. GPT-4o screenshot analysis node
9. Playwright result parser + fixture screenshots
10. GitHub integration (automated PR/issue creation)
11. RAGAS evaluation (if time)
12. Polish + Loom prep

---

## 14) Session continuity

- `PROJECT_CONTEXT.md` — current status, file inventory, key decisions
- Update after substantial changes

---
