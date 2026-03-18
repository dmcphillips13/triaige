# PROJECT_CONTEXT.md — Triaige (Session Handoff)

Last updated: 2026-03-17

---

## Current status

**Phase:** Transitioning from demo project to product validation. Demo day skipped. Rationale accuracy P0 and security critical/high fixes complete. Next: functional test failure support, CLI setup, multi-tenancy, BYOK. See `docs/sequencing.md` for full phased plan.

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
- [x] Step 23: Classification improvements — temperature=0, git diff in Pass 1 + Pass 2, code traceability, conservative bias. Determinism verification pending (need 2 more PR #59 runs). Future: few-shot calibration, per-component analysis, mixed-scope separation.
- [x] Step 23-UI: Dashboard visual polish — fonts (DM Sans + Lora logo PNG), layout (max-w-5xl, warm background, muted stoplight colors, card shadows + hover lift), failure cards (rationale + screenshots always visible, show details toggle, compact + fullscreen modal, swipe fix, approve/reject with tinted colors + descriptive labels + animation), nav (avatar dropdown, logo, breadcrumb back link), submit bar (fixed bottom, frosted glass), skeletons (page transitions + deferred action area), empty states, unified "Baseline committed" labels, sign-in page with logo + middleware fix, local dev → prod runner
- [x] Step 23.8: Real-time run updates — superseded by Step 23-SSE
- [x] Step 23.12: Fix swipe screenshot viewer — fixed alignment, compact + fullscreen modal
- [x] Step 23.13: Make screenshot diff viewer larger — fullscreen modal with Escape to close
- [x] Step 23.14: Add fullscreen/modal mode for screenshot comparison

### Up next — 23.x follow-ups (ordered by priority)

**Block A — Quick wins (dashboard polish, can do in one pass):**
- [x] Step 23.9: All links open in new tab (target="_blank") — all external links have target="_blank" + rel="noopener noreferrer"
- [x] Step 23.5: Persist active tab across page refreshes via URL hash/query param — hash-based tab persistence
- [x] Step 23.4: Rename "Main" tab to "Issues", add "Closed Issues" tab for resolved known failures — 4-tab layout implemented
- [x] Step 23.6: Main tab should work without requiring Settings setup — derives repo from runs data, falls back to localStorage

**Block B — Workflow improvements (runner + dashboard changes):**
- [x] Step 23.2: Auto-close pre-merge runs after submit — after all failures have submissions, call close endpoint from dashboard; or have runner auto-close when gate passes
- [x] Step 23.7: PR run cards should show gate status (action required vs ready to merge) — runner returns gate status, dashboard shows badge on run card
- [x] Step 23.16: Run card status indicator on PR tab ("All addressed" badge when all failures have submissions)
- [x] Step 23.3: Known failure PR comment should link to open GitHub issues — PR comment shows skipped known failures with "open issue" links to GitHub issues; verified on PR #66 with issue #67
- [x] Step 23.20: Defer GitHub issue creation until PR merges — pre-merge rejected failures record intent in `pending_issues` table; issues materialized via `/report-clean` on merge; dashboard shows "Issue will be filed on merge" in amber; pending issues filtered on re-trigger; scoped per-PR (doesn't affect other PRs). Verified end-to-end with PRs #65 and #66.

- [x] Step 23.17: Collapse failure card on verdict — after approve/reject, collapse rationale + screenshots to reduce visual noise
- [x] Step 23.18: Fix submit bar overlap — add bottom padding so the fixed "Submit Changes" bar doesn't block the last card's "Show details" link
- [x] Step 23.19: "View full results" link in PR comment should open in new tab — use raw HTML `<a target="_blank">` since GitHub markdown doesn't support target
- [x] Step 23.21: Disable approve/reject buttons during submit — pass `readOnly` when `submitStatus === "loading"` to lock verdict buttons mid-flight

**Block C — CI/GitHub cleanup:**
- [x] Step 23.10: Delete stale PR comments when runs are superseded — delete previous Triaige comments before posting new one (pattern-matched by content)
- [x] Step 23.11: Hide skipped `close-pr-runs` job on PR checks — split into separate `close-pr-runs.yml` workflow triggered only on push to main
- [x] Step 23.15: Fix GitHub OAuth session duration — store refresh token from GitHub App OAuth, auto-refresh access token when within 10 min of expiry; graceful fallback if refresh fails

**Block D — Complex (split to own step):**
- [x] Step 23.1: Known failure screenshot comparison — comparison + issue comment firing correctly; PR comment now distinguishes drift ("⚠️ visual drift detected") from unchanged known failures; issue gets "further modifies this area" comment when screenshot differs; original screenshot in known_failures preserved as permanent reference

### Steps 24-25 — Repos page + settings cleanup
- [x] Step 24: Repos landing page — `/repos` as post-login landing page with repo cards showing run stats; `/runs?repo=owner/repo` for repo-scoped runs; back links and logo point to `/repos`; skeleton loading; "Add or remove repositories" links to GitHub App installation settings
- [x] Step 25: Settings page removed — localStorage repo selection obsolete (now URL-scoped via repos page); settings page and nav link deleted

### Step 26 — SSE (complete)
- [x] Step 26: Server-sent events for real-time dashboard updates — in-memory event bus on runner emits `run_created`/`run_closed` at all mutation points; SSE endpoint with 30s keepalive; dashboard proxy streams SSE directly; React hook with EventSource + tab-refocus reconnection; runs list and run detail pages update live

### Up next
- [x] Step 27: Bug fixes — address known issues before E2E testing
  - [x] 27.1: Issue drift comment only fires on merge with deduplication
  - [x] 27.2: Diff overlay uses grayscale background
  - [x] 27.3: Issues tab shows full screenshot comparison viewer
  - [x] 27.4: GitHub issues include PR number with clickable link
  - [x] 27.5: Equal-width tabs
  - [x] 27.6: Tab counts populate on initial page load (not just on tab click)
- [x] Step 28: Rigorous E2E test — full pipeline verification (see TEST_PLAN.md)
  - [x] 28.1: Prerequisites (deploy to Render, clean state, update baselines)
  - [x] 28.2: Create PRs A and B on sample app
  - [x] 28.3: Execute test steps 0-14
  - **Fixed during E2E:**
    - Tabs not visible when zero runs exist (page showed "No triage runs found" instead of rendering RunsList with tabs)
  - **P0 — fixed:**
    - Classifier no longer mentions visual changes that didn't happen — `changed_regions` from image diff injected into both devil's advocate and compose prompts; LLM now cross-references code changes against actual pixel regions
  - **Demo note:** Merge PRs via GitHub merge button ("Create a merge commit") — this is the only merge strategy where `close-pr-runs.yml` reliably extracts the PR number
- [ ] ~~Step 29: Demo presentation~~ — **Skipped.** Decision made 2026-03-16 to skip demo day and focus on validation + design partners. See `docs/strategy.md` for full sequencing plan and rationale

### Post-Demo Day — E2E findings
- [x] **Rationale accuracy (P0):** Fixed — prompt now requires each bullet to justify the classification (what changed + why it's expected/unexpected/uncertain) and bans filler bullets. Bullet count is dynamic (1-3) instead of fixed at 3. Confabulation (phantom region references) eliminated.

### New MVP functionality (build before going to market)
- [ ] **Functional test failure support** — extend triage to handle functional Playwright failures (assertion errors, navigation failures, timeouts) alongside visual regressions. Same expected/unexpected/uncertain classification. Plain English failure summaries. "Acknowledge" action opens test update issues instead of committing baselines. See `docs/functional-test-plan.md` for implementation plan and `docs/strategy.md` for design rationale
- [ ] Repo setup CLI (`npx triaige init`) — guided setup: checks `gh` auth, verifies dashboard connection + GitHub App Checks permission, sets GitHub secrets, scaffolds workflow + script, detects Playwright config, offers initial baseline generation + commit, branch protection setup
- [ ] Basic multi-tenancy — per-org data isolation so two teams' runs don't mix
- [ ] BYOK key management — let users provide their own OpenAI/Anthropic keys (encrypted storage, validation)
- [ ] Multi-repo upstream diff resolution — when a PR is a dependency version bump, resolve the real diff from upstream repo(s) to give the classifier meaningful code context. Covers the common enterprise pattern where multiple repos publish packages consumed by a UI repo. Without this, version-bump PRs get weak "uncertain" classifications. Build if a design partner needs it, skip if they don't

### Market demo polish
- [ ] **Known failure card states need fixing** — re-triggered CI runs produce non-actionable cards even when no action was taken on the previous run. Correct behavior: (1) **open GH issue exists** → card shown at bottom, non-actionable, links to the issue (informational only); (2) **pending issue (staged but not yet created)** → card shows a note that an issue is pending, but user can unselect and then approve baseline or re-stage; (3) **no action taken** → card is fully actionable. Only an opened issue makes a card non-actionable — pending is a draft decision the user can change each run
- [ ] **Rationale prompt refinement** — further iteration to eliminate vague bullets (e.g., "overall design impact — broader than described in PR") and improve cross-card disambiguation (same code change should explain why it's expected on one page and unexpected on another). Consider model upgrade (GPT-4o / Claude Sonnet) if prompt changes plateau
- [ ] `close-pr-runs.yml` PR number extraction: support squash-and-merge, rebase-and-merge via button, and CLI rebase + direct push (currently only handles "Merge pull request #N" merge commits)
- [ ] PR run cards should link to the GitHub PR (title shown but not clickable)
- [ ] Failure cards should sort by classification (expected → uncertain → unexpected, each by confidence desc)
- [ ] Upgrade Render to paid tier ($7/mo — eliminate cold starts)

### Go to market polish
- [ ] Security fixes — medium (error message sanitization, rate limiting, SSE subscriber cap)
- [ ] Data migration strategy for breaking runner changes
- [ ] Drift-on-merge comment doesn't fire when all failures are known (no triage run → no closed runs → drift block skipped) — store drift results during pre-merge triage and replay at merge time
- [ ] Closing a GitHub issue doesn't sync to Issues tab — need webhook for `issues` closed events (Step 34)
- [ ] Show known failures as non-actionable section at bottom of run detail (screenshot comparison, issue link, no approve/reject)
- [ ] Issues tab: add PR link pill and issue link pill at top of known failure cards
- [ ] Issues tab: diff overlay disabled — store overlay at filing time or recompute on the fly
- [ ] Issues tab count doesn't update via SSE on merge — refetch known failures on `run_closed` events
- [ ] Closed Issues tab: add screenshot comparison viewer for reference/sharing
- [ ] Closed Runs tab: add PR link on run cards
- [ ] Reconsider tab prominence — Closed Runs/Issues may not need equal visual weight (collapse, secondary nav, or filter)
- [ ] PR run detail shows previous closed runs for the same PR — list of links with timestamps and summary stats for review history context
- [ ] `update-snapshots.yml` should NOT be included in the setup CLI or repo template — it's a dev convenience for the sample app only; if included, add a confirmation input to prevent accidental runs
- [ ] Cypress support — separate ingestion adapter for Cypress JSON report format. Classification pipeline is identical; only the report parsing differs. Build when a design partner needs it

### Future (post-validation)
- [ ] Logprob-based confidence scores — use classification token logprobs instead of LLM self-reported confidence for better calibration
- [ ] Component ownership lookup
- [ ] RAGAS evaluation
- [ ] Separate test repo support — link a dedicated Playwright/baselines repo separate from the UI repo
- [ ] Post-deployment environment testing — support scheduled test runs against SIT/UAT/prod environments (no single PR trigger). Health dashboard use case with weaker intent signal — more about tracking what's broken than classifying intent. See `project_multi_repo.md` memory for full context
- [ ] Auto-approve baselines above confidence threshold
- [ ] Mobile optimization for the dashboard

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
