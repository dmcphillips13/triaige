# PROJECT_CONTEXT.md — Triaige (Session Handoff)

Last updated: 2026-03-22

---

## Current status

**Phase:** Pre-vacation build sprint — working through Essential items for test partner readiness. Core pipeline complete (Steps 1-28). Security hardened (rate limiting, SSE caps, BYOK mandatory, multi-tenancy, per-repo access control). See `docs/sequencing.md` for phased plan, `docs/strategy.md` for GTM, `docs/e2e-test-plan.md` for comprehensive test plan.

**Test repo state:**
- `dmcphillips13/test-triaige-onboarding` — fully configured (GitHub App installed, workflows, branch protection, BYOK key, baselines). PR #4 merged with full triage flow verified

---

## What to work on next

**Critical — pick up here:**
- [x] **Dashboard multi-tenancy (implemented)** — repo-access.ts module with 60s cached GitHub App installation lookup. Proxy validates repo from URL path, query params, and POST body. Server components validate before rendering. GET /runs response filtered. All run-scoped client calls pass repo for validation. Returns 404 to prevent enumeration. SSE event filtering is a follow-up (events leak only `{run_id, repo}`, all actions are blocked)
  - [ ] **E2E verification (do after all pre-partner work is complete):** see `docs/e2e-test-plan.md` for full step-by-step test plan
- [x] **Rate limiting (implemented)** — `limits` library (async moving-window) in `ApiKeyMiddleware`. Three tiers: expensive (20/min — `/triage-run`, `/ask`), mutation (30/min — `/update-baselines`, `/create-issues`, `/feedback`), general (60/min — all other). Auth failure: 5/min per IP. Dashboard proxy forwards `X-Dashboard-User` for per-user limiting. 429 + `Retry-After` + `X-RateLimit-*` headers. `/health` and `/events` exempt
  - **Follow-ups:**
  - [ ] Migrate to Redis storage when scaling to multiple Render instances
  - [ ] Tune rate limit values based on real usage data from design partners
  - [ ] Add Cloudflare edge-level rate limiting rules if volumetric attacks become a concern
- [x] **SSE connection hardening (implemented)** — global cap 200, per-user limit 3, bounded queue (maxsize=50), disconnect on full, max lifetime 1hr
- [x] **Reliability fixes (implemented)** — two groups in one pass:
  - **Group A — `/report-clean` hardening (runner):** Pydantic input model (`ReportCleanRequest` — validates repo, head_sha, pr_number as int|None, event), try/except around `repo_settings.get_settings()`, top-level error handler, sanitized error messages. Root cause of PR #78 500: `int(pr_number)` ValueError on non-numeric input
  - **Group C — Silent mutation fixes (dashboard):** `submitFeedback()` added `res.ok` check, `putVerdict()` caller reverts optimistic update + shows error banner, `toggleMergeGate()` shows error message, `deleteOpenAIKey()` handles non-200 responses + resets loading state
  - **Deferred — Group B (PR merge status check):** dashboard check for actual PR merge status via GitHub API. Not needed if Group A makes `/report-clean` robust. Existing stale runs can be manually closed. Revisit if stale actionable runs recur
  - **Testing:** see `docs/e2e-test-plan.md` for full step-by-step test plan (includes /report-clean validation, error handling, and full merge flow)
**Essential — do before test partners:**
- [x] Empty repos page after overnight session (fixed) — three-layer fix: getSession() returns null on dead token (clears cookie), app layout redirects to sign-in when session is null, fetchConnectedRepos() throws on 401 instead of returning empty array
- [x] Render paid tier ($7/mo) — already on Starter, no cold starts
- [x] Error message sanitization — 4 instances in main.py where exception text (GitHub API URLs) leaked to callers via HTTPException detail and response body. Replaced with generic messages, details logged server-side
- [x] Favicon — red plus sign from logo, exported from Figma, transparent background
- [x] close-pr-runs.yml merge strategy support — squash-and-merge (regex), rebase-and-merge (GitHub API fallback). Helper function in post-failures.sh eliminates duplication
- [ ] Classification accuracy + rationale quality — confirm GPT-5.4-nano resolved dark theme misclassification (PR #3, 72% "unexpected"). Test before investing time
- [ ] **Publish CLI to npm** — polished `npx triaige init` experience for partners. Prerequisites: Qdrant collection isolation (below) and invite/waitlist gate on API key generation

**Important — should do before partners, survivable if not:**
- [ ] Known failure card states — re-triggered CI runs produce non-actionable cards incorrectly
- [ ] Collapsed cards missing rationale/screenshots — "Show details" after verdict shows incomplete info
- [ ] Manual setup path without `gh` CLI — print step-by-step instructions when `gh` unavailable
- [x] Qdrant collection isolation per tenant — episodes now tagged with repo and filtered on retrieval. No repo = no episodes (defense in depth). Existing untagged episodes excluded by filter, will age out. Repo payload index created at startup
- [ ] Invite code or waitlist gate on API key generation — CLI publish prerequisite. Prevents open access to the platform via npm
- [ ] Functional failure follow-ups — classification accuracy for functional tests + E2E verification of mixed visual + functional flow (card rendering, submit, merge gate, issue materialization)

**Nice-to-have — polish that helps but not critical:**
- [ ] Disable actions on superseded PR runs — banner + disable buttons when newer commit pushed
- [ ] PR cards link to GitHub PR — title shown but not clickable
- [ ] Failure card sort order — expected → uncertain → unexpected by confidence desc
- [ ] Settings link on runs page — move from repo card to runs page
- [ ] Repos page doesn't update on App change — requires manual refresh
- [ ] Stale PR comment cleanup on clean pass — old Triaige comments linger after baseline commit
- [ ] Show known failures as non-actionable section at bottom of run detail
- [ ] Data migration strategy for breaking runner changes — needed if schema changes during a trial
- [ ] Drift-on-merge comment doesn't fire when all failures are known
- [ ] Closing a GitHub issue doesn't sync to Issues tab (need webhook)
- [ ] Issues tab: PR link pill and issue link pill
- [ ] Issues tab: diff overlay disabled
- [ ] Issues tab count doesn't update via SSE on merge
- [ ] Closed Issues tab: screenshot comparison viewer
- [ ] Closed Runs tab: PR link on cards
- [ ] Tab prominence — Closed Runs/Issues may not need equal visual weight
- [ ] PR run detail: show previous closed runs for same PR
- [ ] `update-snapshots.yml` not for setup CLI — dev convenience only
- [ ] De-emphasize merge gate toggle — move to "Advanced" section or behind disclosure, add "Recommended: on" note
- [ ] Classification regression library — collect sample app PRs with known outcomes
- [ ] Multi-PR interaction test matrix — observe with design partners, don't build formal harness

**Backlog — build when demanded or post-validation:**
- [ ] CORS method/header wildcards — tighten to explicit lists (no security risk: origins already restricted)
- [ ] AUTH_SECRET minimum length — add startup validation (we control the env var)
- [ ] SSE event filtering by tenant — events only contain `{run_id, repo}`, all actions validated
- [ ] GitHub token in JWT cookie — consider JWE or server-side sessions (HTTP-only + Secure + SameSite covers main vectors)
- [ ] Handle pgcrypto decryption failures gracefully — only triggered by admin key rotation
- [ ] BYOK_ENCRYPTION_KEY rotation procedure — document when needed
- [ ] Migrate rate limiting to Redis — when scaling to multiple Render instances
- [ ] Tune rate limit values — based on real usage data from design partners
- [ ] Add Cloudflare edge-level rate limiting rules — if volumetric attacks become a concern
- [ ] Submit flow smoke test — automated test for runner's critical paths
- [ ] Dashboard PR merge status check — revisit if stale actionable runs recur
- [ ] `/report-clean` format validation — add `head_sha` regex, `repo` slash check if E2E reveals issues
- [ ] Compliance mode — e-signature, audit log, PDF export. Build based on design partner feedback
- [ ] Multi-repo upstream diff resolution — build if a design partner needs it
- [ ] Partial init recovery — workflow exists but baselines missing
- [ ] `triaige update` command — build when demanded
- [ ] Workflow template auto-update — version and detect staleness
- [ ] Cypress support — build when demanded

**Future — post-validation:**
- [ ] Logprob-based confidence scores
- [ ] Component ownership lookup
- [ ] RAGAS evaluation
- [ ] Separate test repo support
- [ ] Post-deployment environment testing (SIT/UAT/prod)
- [ ] Auto-approve baselines above confidence threshold
- [ ] Mobile optimization

**Gate: E2E verification of all critical items (21-point checklist above), then work through Essential → Important → Nice-to-have before onboarding test partners**

---

## Key decisions

| Decision | Choice | Rationale |
|---|---|---|
| LLM (text) | GPT-5.4-nano | Fast, capable reasoning; step change in classification quality over 4o-mini |
| LLM (vision) | GPT-4o | Vision capabilities for screenshot diff analysis |
| Embeddings | text-embedding-3-small (1536d) | Pairs with OpenAI; one API key |
| Vector DB | Qdrant Cloud (free tier) | Production-ready, metadata filtering, hybrid search |
| Orchestration | LangGraph | Agentic state machine with conditional routing |
| Runner deploy | Render (free tier) | Better Python support than Vercel |
| Dashboard deploy | Vercel | Natural fit for Next.js |
| Tenancy model | GitHub App installation | Orgs share data; solo users work without org. See below |
| BYOK | Mandatory, no fallback | User's OpenAI key only. Owner's key for admin scripts only. See AGENTS.md §13.1 |
| CLI publishing | Not yet | Blocked on multi-tenancy + rate limiting. Share as local checkout for design partners |

### Tenancy model (decided 2026-03-22)

Tenant = GitHub App installation. An org that installs the Triaige GitHub App is one tenant. All org members with repo access share runs, verdicts, and submissions — triage is a team activity. A solo user with a personal GitHub account installation is also a valid tenant (no org required). Mirrors Vercel, Codecov, Chromatic.

**Dashboard multi-tenancy implementation:** The dashboard proxy must check that the logged-in user's GitHub account has access to the requested repo via their GitHub App installations before forwarding to the runner. Currently the proxy blindly forwards everything with the global API key. This is the gate between "CI keys are isolated" and "dashboard users are isolated."

**Access path coverage (every way a user can access data through the dashboard):**

| Path | Data exposed | Protection |
|---|---|---|
| `/repos` page | Repo list | Safe — uses user's GitHub token, returns only their installations |
| `/runs?repo=X` page | Runs for repo X | `assertRepoAccess(repo)` in server component |
| `/runs/{runId}` page | Run detail, screenshots, rationale | Post-fetch check: `run.repo` against accessible repos |
| `/repos/owner/repo/settings` page | API key, masked OpenAI key | `assertRepoAccess(fullName)` in server component |
| `GET /api/runner/runs` | All runs list | Proxy filters response to accessible repos only |
| `GET /api/runner/runs/{runId}` | Run detail | `repo` query param required, validated in proxy |
| `GET /api/runner/runs/{runId}/verdicts` | Verdicts | Same |
| `GET /api/runner/runs/{runId}/submissions` | Submissions | Same |
| `GET /api/runner/runs/{runId}/known-failures` | Known failure context | Same |
| `PUT /api/runner/runs/{runId}/verdict` | Write verdict | Same |
| `PUT /api/runner/runs/{runId}/submission` | Write submission | Same |
| `PATCH /api/runner/runs/{runId}/close` | Close run | Same |
| `POST /api/runner/feedback` | Write episodic memory | `repo` in body, validated in proxy |
| `GET/PUT/DELETE /api/runner/repos/X/*` | Settings, keys, known failures | Repo from URL path, validated in proxy |
| `POST /api/runner/update-baselines` | Commit to PR branch | `repo` from body, validated in proxy |
| `POST /api/runner/create-issues` | Create GitHub issues | Same |
| `GET /api/runner/events` (SSE) | Event stream `{run_id, repo}` | **Follow-up** — user sees event names but can't act on them (all actions validated) |
| `GET /api/runner/health` | `{"status": "ok"}` | No repo data |

**Follow-up after multi-tenancy ships:**
- [ ] **SSE event filtering** — filter the event stream per-user using a TransformStream in the proxy. Low priority since events only contain `{run_id, repo}` (no screenshots, no failure data) and all API calls are validated
- [ ] **Qdrant collection isolation** — episodic memories from different tenants currently mix in the same Qdrant collection. Not exploitable (memories are retrieved by similarity, not by tenant), but isolation is cleaner. Consider per-tenant collection or metadata filtering

---

## Recent sessions

### Session 2026-03-22 (night) — Infrastructure hardening, reliability, OAuth fix, test plan

**Rate limiting:**
- `limits` library (async moving-window) integrated into `ApiKeyMiddleware`
- Three tiers: expensive (20/min), mutation (30/min), general (60/min) + auth-failure IP limiting (5/min)
- Dashboard proxy forwards `X-Dashboard-User` header for per-user rate limiting
- Standard 429 responses with `X-RateLimit-*` headers

**SSE connection hardening:**
- Global cap 200, per-user limit 3, bounded queue (maxsize=50)
- Disconnect on full (EventSource auto-reconnects), max lifetime 1hr
- `Subscriber` class replaces bare `asyncio.Queue`

**Reliability fixes:**
- `/report-clean` hardened: Pydantic input model eliminates `int(pr_number)` ValueError (root cause of PR #78 500), try/except on `repo_settings.get_settings()`, top-level error handler
- Dashboard silent mutations fixed: `submitFeedback()` error check, `putVerdict()` caller reverts on failure + shows error, `toggleMergeGate()` error message, `deleteOpenAIKey()` handles non-200

**OAuth session expiry fix:**
- `getSession()` now returns null (clears cookie) when GitHub token is expired and refresh fails — previously returned dead session causing blank repos page
- App layout checks session on every authenticated page load, redirects to `/sign-in` if null — protects all pages in one place
- `fetchConnectedRepos()` throws on GitHub 401 instead of silently returning empty array

**Backlog restructured:** prioritized into Essential / Important / Nice-to-have / Backlog / Future tiers for test partner readiness. Comprehensive E2E test plan created (`docs/e2e-test-plan.md`) with 16 sections and ~80 checkpoints including multi-PR edge cases.

**Confirmed:** Render already on Starter tier ($7/mo), no cold starts.

**Next:** Error message sanitization (3 instances in main.py, plan ready — awaiting approval to build), then favicon, close-pr-runs.yml squash/rebase support, classification accuracy confirmation, CLI npm publish. Full E2E verification after all pre-partner work is complete.

### Session 2026-03-22 (evening) — Security hardening + P0 features + E2E test

**Security (4 commits):**
- Global OpenAI key fallback removed from `get_openai_client()`, `_get_llm()`, `/feedback`. All paths now require BYOK contextvar. Security rules in AGENTS.md §13.1
- Per-repo access control on all 25 endpoints (`_check_repo_access`, `_check_run_access` with 404 anti-enumeration)
- Run-repo consistency in `/update-baselines` and `/create-issues`
- Temp file cleanup in `post-failures.sh`
- Two post-fix audits confirmed no remaining exploitable vulnerabilities in per-repo key path

**P0 features:**
- Setup banners: amber pill on repo cards, banner on runs page with settings link
- Early return gate: `/triage-run` creates GitHub check with "Setup required" when no OpenAI key
- `triaige init` re-run guard: detects existing workflow, exits with update pointers
- `.strip()` on `X-OpenAI-Key` header

**E2E test passed:** Full clean-slate BYOK flow on `test-triaige-onboarding` PR #4: sign in → App install → setup pill → configure key → init → PR → CI classification (expected, 90%) → PR comment + merge gate → approve → baseline committed → gate passed → run auto-closed → merge → cleanup succeeded

**Decisions:** Tenancy model (GitHub App installation). CLI npm publish blocked until multi-tenancy + rate limiting.

### Session 2026-03-22 — CLI setup, per-repo API keys, settings page

- Repo setup CLI (`npx triaige init`) with CI baseline generation
- Per-repo API keys (`tr_` prefix, auto-generated)
- Dashboard settings page (API key, OpenAI key, merge gate toggle)
- P0 bug: `pre_merge` defaulting to FALSE in DB (fixed with migration)

### Session 2026-03-21 — BYOK, onboarding test

- BYOK OpenAI key: encrypted storage (pgcrypto AES-256), per-request resolution via contextvars, settings UI, CLI prompt, CI header, key validation, log scrubbing
- First onboarding test passed on test-triaige-onboarding PR #3
- Cross-repo access fix on BYOK endpoints

### Session 2026-03-20 — Submit flow + model upgrade

- Submit → gate check → auto-close works end-to-end (PR #76 on sample app)
- GPT-5.4-nano: step change in classification quality — grounded rationale referencing specific CSS tokens and code changes

---

## Detailed reference (for backlog items)

### Reliability fixes
- [x] **`/report-clean` 500 on PR #78 merge (fixed)** — root cause: `int(pr_number)` ValueError. Fix: `ReportCleanRequest` Pydantic model, try/except on settings fetch, top-level error handler
- [x] **Merged PR runs actionability (mitigated)** — dashboard gates on `run.closed` only. Fix path A (done): `/report-clean` hardened so runs reliably close. Fix path B (deferred): dashboard GitHub API merge status check — revisit if stale runs recur
- [x] **Silent mutation failures in dashboard (fixed)** — all 4 functions now surface errors: `submitFeedback()` checks `res.ok`, `putVerdict()` reverts + shows banner, `toggleMergeGate()` shows error, `deleteOpenAIKey()` handles non-200
- [ ] **Submit flow smoke test** — automated test for runner's critical paths

### Onboarding polish
- **Init re-run guard (done)** — detects existing workflow, exits with pointers. Future follow-ups:
  - Partial init recovery (workflow exists but baselines missing)
  - `triaige update` command (build when demanded)
  - Workflow template auto-update (version and detect staleness)
- [ ] **Repos page doesn't update on App change** — requires manual refresh. Add SSE event or client-side refetch on focus
- [ ] **Manual setup path without `gh` CLI** — print step-by-step instructions when `gh` unavailable
- [ ] **Settings link on runs page** — move from repo card to runs page
- [ ] **Classification accuracy** — dark theme PR #3 classified as "unexpected" (72%) despite clear description. Needs investigation

### New MVP functionality
- [x] **Basic multi-tenancy (done)** — per-repo API key access control + dashboard multi-tenancy with GitHub App installation lookup
- [ ] **Functional failure follow-ups** — classification accuracy confirmation, E2E verification of mixed visual + functional flow
- [ ] **Compliance mode** — repo setting toggle (default off) with e-signature modal, requirement ID tagging, immutable audit log, PDF audit export. ~1-2 hours. See `docs/strategy.md`
- [ ] **Multi-repo upstream diff resolution** — build if a design partner needs it

### Market demo polish
- [ ] **Known failure card states** — re-triggered CI runs produce non-actionable cards incorrectly. Correct behavior: open GH issue → non-actionable; pending issue → changeable; no action → fully actionable
- [ ] **Collapsed cards missing rationale/screenshots** — "Show details" after verdict should include rationale and screenshots
- [ ] **Empty repos page after overnight session** — OAuth expires, shows empty instead of redirect to sign-in
- [ ] **Rationale prompt refinement** — may be resolved by GPT-5.4-nano. Confirm with more runs
- [ ] **close-pr-runs.yml** — support squash-and-merge, rebase-and-merge (currently only merge commits)
- [ ] **Disable actions on superseded PR runs** — banner + disable buttons on newer push
- [ ] PR cards link to GitHub PR
- [ ] Failure card sort order (expected → uncertain → unexpected by confidence desc)
- [ ] Render paid tier ($7/mo — eliminate cold starts)
- [ ] Favicon — use red plus sign from logo
- [ ] **Classification regression library** — collect sample app PRs with known outcomes as repeatable regression suite
- [ ] **Multi-PR interaction test matrix** — scenarios for design partner phase:
  - Concurrent PRs on same component (baseline staleness after merge)
  - Approved then superseded (new commit after baseline commit)
  - Rebase after upstream baseline change
  - Known failure interaction across PRs
  - Merge gate with mixed state (2 approved, 1 pending)
  - Observe with design partners, don't build formal harness

### Go to market polish
- [ ] Data migration strategy for breaking runner changes
- [ ] Drift-on-merge comment doesn't fire when all failures are known
- [ ] Closing a GitHub issue doesn't sync to Issues tab (need webhook)
- [ ] Show known failures as non-actionable section at bottom of run detail
- [ ] Issues tab: PR link pill and issue link pill
- [ ] Issues tab: diff overlay disabled
- [ ] Issues tab count doesn't update via SSE on merge
- [ ] Closed Issues tab: screenshot comparison viewer
- [ ] Closed Runs tab: PR link on cards
- [ ] Tab prominence — Closed Runs/Issues may not need equal visual weight
- [ ] PR run detail: show previous closed runs for same PR
- [ ] `update-snapshots.yml` not for setup CLI — dev convenience only
- [ ] Cypress support — build when a design partner needs it

### Future (post-validation)
- [ ] Logprob-based confidence scores
- [ ] Component ownership lookup
- [ ] RAGAS evaluation
- [ ] Separate test repo support
- [ ] Post-deployment environment testing (SIT/UAT/prod)
- [ ] Auto-approve baselines above confidence threshold
- [ ] Mobile optimization

---

## Build history

Steps 1-28 complete. Full build history in git. Key milestones:
- Steps 1-7: Runner scaffold, sample app, corpus, Qdrant, GitHub API, LangGraph, /triage-run
- Steps 8-14: Dashboard UI, image diff, vision, batch triage, screenshot viewer, episodic memory, GitHub actions
- Steps 15-18: Render/Vercel deploy, GitHub App OAuth, GitHub Actions workflow, triage mode settings
- Steps 19-21: Postgres persistence, runs redesign, merge gate, pre-merge workflow
- Steps 22-23: Failure card UX, classification improvements, dashboard polish
- Steps 24-26: Repos page, settings, SSE
- Steps 27-28: Bug fixes, rigorous E2E test on sample app

### Vision night 2026-03-21
- Primary GTM: frustrated Percy/Chromatic customers at mid-market B2B SaaS
- SaMD vertical expansion: confirmed gap, but slow sales cycles — secondary play
- Compliance mode designed, expansion paths documented
- See `docs/strategy.md` for full analysis

### Important notes
- **Demo day skipped** — decision 2026-03-16, focus on validation + design partners
- **Merge PRs via merge button** — "Create a merge commit" is the only strategy where `close-pr-runs.yml` reliably extracts the PR number (until merge strategy support is added)
- **Runs auto-close when all failures are submitted** — not on merge. The merge gate passing and run closing happen at the same time, triggered by the last submission
