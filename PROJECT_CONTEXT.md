# PROJECT_CONTEXT.md — Triaige (Session Handoff)

Last updated: 2026-03-14

---

## Current status

**Phase:** Classification pipeline improved (Step 23), dashboard visual polish complete (Step 23-UI). Next: SSE real-time updates, then remaining demo prep (Steps 24-27).

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
- [x] Step 20.1: Net-new failure filtering — only show failures not present in previous open post-merge runs; skip run creation when zero new failures; post-merge runs auto-close when all failures have submissions; pre-merge runs auto-close when superseded or when the PR merges; default both triage modes enabled
- [x] Step 21: Actionable pre-merge workflow with merge gate — pre-merge becomes the primary workspace; approved baselines commit directly to PR branch; unexpected changes file issues; GitHub check gates merge until all net-new failures addressed; pre-existing failures (failing on main with open issue) shown but not actionable; Main tab becomes health dashboard showing open issues on failing tests; post-merge runs are diagnostic only
- [x] Step 21.1a: Remove post-merge runs — strip triage path for push-to-main events; workflow just calls `/report-clean` for PR run cleanup; remove post-merge run creation logic
- [x] Step 21.1b: Main tab health dashboard — replace run cards with individual failing baseline cards; each shows screenshot from when issue was filed, issue title/number/link, test name; add `known_failures` table (test_name, repo, screenshot_base64, issue_url, issue_number, filed_from_run_id); closing from UI also closes the GitHub issue
- [x] Step 21.1c: Known failure visibility on PRs — when net-new filtering skips known failures, compare PR screenshot against stored screenshot from `known_failures` table; if different, post comment on GitHub issue noting the PR that modified it further with link; show skipped tests as non-actionable in dashboard run detail and PR comment with issue links and manual verification note
- [x] Step 21.2: Remove "Ready to merge" PR comments — redundant since the check passing already signals this; remove gate-passed comment entirely
- [x] Step 21.3: Fix "Baseline committed" label — submission label on pre-merge runs should say "Baseline committed" not "Baseline PR opened"
- [x] Step 22: **DEMO CRITICAL** — Reorder failure card sections (rationale at top, image diff next, vision analysis collapsed) + improve rationale format (3 brief bullet points, fix markdown bullet rendering)
- [ ] Step 23: Classification improvements — observed issues and fixes:
  - **Observed (PR #59, 2026-03-14)**: same accent color change (blue→indigo via `--color-accent` in globals.css) classified as expected (85%), uncertain (70%), AND unexpected (85%) across 3 consecutive runs of the same PR. Root cause: without the git diff, the classifier can't trace the sidebar's visual change back to the `--color-accent` token update — it sees "sidebar changed" and guesses scope from the PR title alone. Combined with non-zero temperature, the result is essentially random. This is the #1 demo blocker for classification quality.
  - **Core approach — two-signal classification**: the classifier gets three inputs: (1) visual diff screenshots (what it looks like), (2) git diff (what code changed), (3) PR description (what was intended). A change is **expected** only if it traces to a diff change AND that change aligns with the PR description. A change is **unexpected** if it traces to a diff change NOT mentioned in the PR description (unintentional side effect) or if it's a visual defect. **Uncertain** only when the visual change cannot be traced to a specific diff change. This prevents the git diff from making everything "expected" — the PR description is still the scope gate.
  - **Mixed-scope contamination**: when a page has both expected changes (font sizes) and unexpected changes (sidebar color), the classifier compromises to "uncertain" instead of separating them. Fix: the two-signal approach lets the classifier say "font size change = expected (in diff + mentioned in PR), sidebar color change = unexpected (in diff but NOT mentioned in PR)" on the same page.
  - **Temperature**: set to 0 for deterministic results. Won't fix the mixed-scope issue but eliminates classification instability across retriggers.
  - **Git diff context**: the biggest lever. Feed the actual CSS property changes so the classifier can match each visual difference to a specific code change. Without it, the classifier just sees "the page looks different" and guesses scope alignment.
  - **Prompt structure**: "You have three inputs: (1) the visual diff screenshots, (2) the git diff showing exactly which properties changed, (3) the PR description stating what was intended. A change is expected if it traces to a diff change that aligns with the PR description. A change is unexpected if it traces to a diff change NOT mentioned in the PR description, or if it appears to be a visual defect. A change is uncertain only if you cannot determine which diff change caused the visual difference."
  - **Few-shot calibration**: retrieve 3-5 similar past decisions from episodic memory as examples in the prompt. Anchors the model's judgment to actual human verdicts.
  - **Per-component analysis**: long-term — instead of classifying the whole page, identify which UI components changed and classify each separately. A page with expected header changes and unexpected sidebar changes should yield two classifications.
- [x] Step 23 (temperature + git diff): DONE — temperature=0 on all LLM calls, git diff injected into Pass 1 + Pass 2, code traceability dimension added, conservative bias toward uncertain
- [x] Step 23-UI: Dashboard visual polish — DONE:
  - [x] Font swap: DM Sans (body), Lora baked into PNG logo
  - [x] PNG logo with stylized plus and red "ai" highlight (exported from Figma at 4x, no font dependencies)
  - [x] Widen layout from max-w-3xl to max-w-5xl
  - [x] Warm off-white background
  - [x] Muted stoplight colors (emerald/amber/rose)
  - [x] Card shadows (shadow-sm) + hover lift (shadow-md) on run cards
  - [x] Rationale visible by default, larger text (15px), citations/tool calls collapsed under "Show details"
  - [x] Screenshots visible by default, compact (250px) with fullscreen modal (Escape to close)
  - [x] Swipe viewer: fixed image alignment using regular img tags
  - [x] Classification count summary in run detail header
  - [x] PR link restyled as badge ("PR #59 ↗")
  - [x] Avatar dropdown for settings/sign-out (consolidate nav)
  - [x] Remove "Diagnostic" label and "Home" link
  - [x] Sign-in page: Logo component with card container, middleware fix for logo.png
  - [x] Approve/reject: tinted colors, descriptive labels ("Approve baseline update" / "Reject and open GH issue"), smooth hide animation on selection, equal-width buttons
  - [x] Fixed submit bar at bottom of viewport (frosted glass effect)
  - [x] Closed run banner moved above failure cards
  - [x] Back link: "← Triage Runs" breadcrumb with hover arrow animation
  - [x] Loading skeletons for page transitions (runs list, run detail, Main tab, action area)
  - [x] Deferred action area rendering (prevents approve button flash before submissions load)
  - [x] Empty state improvements (helpful guidance text for PR and Closed tabs)
  - [x] Unified submission labels: all say "Baseline committed" (removed "Baseline PR pending/opened" duplicates)
  - [x] Local dev .env pointed to prod runner for realistic testing
  - [ ] Run card status indicator on PR tab ("All addressed" badge when all failures have submissions)
- [ ] Step 23-SSE: Server-sent events for real-time dashboard updates — runner emits events on run creation, classification completion, and run close; dashboard subscribes and updates runs list + run detail live
- [ ] Step 23.1: Debug and complete known failure screenshot comparison — the comparison + issue comment logic isn't firing despite screenshots differing; likely a silent exception in the comparison path or screenshot extraction; once fixed: (a) update PR comment to distinguish "unchanged known failure" from "further modified by this PR (adding drift)" with issue link; (b) on merge of a PR with drift, post issue comment with the new screenshot showing the visual progression — but keep the original screenshot in known_failures as the permanent reference so future comparisons always compare against the state when the bug was filed, not the drifted state
- [ ] Step 23.2: Auto-close pre-merge runs after submit — close run immediately once all failures have submissions
- [ ] Step 23.3: Known failure PR comment should link to open GitHub issues
- [ ] Step 23.4: Rename "Main" tab to "Issues", add "Closed Issues" tab for resolved known failures
- [ ] Step 23.5: Persist active tab across page refreshes via URL hash/query param
- [ ] Step 23.6: Main tab should work without requiring Settings setup — derive repo from runs
- [ ] Step 23.7: PR run cards should show gate status (action required vs ready to merge)
- [ ] Step 23.8: Real-time run updates — superseded by Step 23-SSE
- [ ] Step 23.9: All links open in new tab (target="_blank")
- [ ] Step 23.10: Delete stale PR comments when runs are superseded — store comment ID, delete on auto-close
- [ ] Step 23.11: Hide skipped `close-pr-runs` job on PR checks — split into separate workflows
- [x] Step 23.12: Fix swipe screenshot viewer — DONE (fixed alignment, compact + fullscreen modal)
- [x] Step 23.13: Make screenshot diff viewer larger — DONE (fullscreen modal with Escape to close)
- [x] Step 23.14: Add fullscreen/modal mode for screenshot comparison — DONE
- [ ] Step 23.15: Fix GitHub OAuth session duration — extend token lifetime or add refresh flow
- [ ] Step 24: Repos landing page — repo cards with setup checklist, "Connect Repo" via GitHub App, unconfigured repos rejected
- [ ] Step 25: Settings UI — auto-generated API key + runner URL for copy-paste, triage/merge gate toggles, inline CLI instructions
- [ ] Step 26: Repo setup CLI (`npx triaige init`) — frictionless guided setup: checks `gh` auth, verifies dashboard connection + GitHub App Checks permission, sets GitHub secrets via `gh secret set`, scaffolds workflow (with correct permissions block + baseline commit skip condition) + script (with executable bit) + .env.example, detects Playwright config and ensures JSON reporter is configured, detects monorepo structure, offers initial baseline generation + commit, branch protection with `strict: true`, and a final validation dry-run
- [ ] Step 27: Polish + Loom
- [ ] Step 28 (stretch): Issue attribution agent — async agent scans merge history, adds attribution comments to issues
- [ ] Step 29 (stretch): Baseline knowledge doc — LLM auto-generates semantic descriptions of each page from baseline screenshots and app code; classifier references during triage for richer context
- [ ] Step 30 (stretch): Separate test repo support — link a dedicated Playwright/baselines repo separate from the UI repo
- [ ] Step 31 (stretch): Auto-approve baselines above confidence threshold
- [ ] Step 32 (stretch): Procedural memory — self-improving triage instructions via reflection
- [ ] Step 33 (stretch): Component ownership lookup
- [ ] Step 34 (stretch): Auto-close main dashboard failures when linked issue closes (webhook)
- [ ] Step 35 (stretch): RAGAS evaluation

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

---
