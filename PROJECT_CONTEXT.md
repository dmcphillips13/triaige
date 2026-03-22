# PROJECT_CONTEXT.md — Triaige (Session Handoff)

Last updated: 2026-03-22

---

## Current status

**Phase:** Pre-vacation build sprint. Transitioning from demo project to product validation. Core pipeline complete (Steps 1-28). Security hardened. BYOK mandatory. E2E tested. See `docs/sequencing.md` for phased plan and `docs/strategy.md` for full GTM analysis.

**Test repo state:**
- `dmcphillips13/test-triaige-onboarding` — fully configured (GitHub App installed, workflows, branch protection, BYOK key, baselines). PR #4 merged with full triage flow verified

---

## What to work on next

**Critical — pick up here:**
- [ ] **Dashboard multi-tenancy** — the dashboard proxy forwards all requests with the global API key, so any logged-in user can access any repo's data by crafting requests through the proxy. Fix: before forwarding, check that the logged-in user's GitHub account has access to the requested repo via their GitHub App installations. Also filter SSE events by repo. See "Tenancy model" section below for design decisions
  - [ ] **Verification after implementation:** deploy to Vercel, then test: (1) `/repos` shows only user's repos, (2) manually navigate to `/repos/other-owner/other-repo/settings` → 404, (3) `/runs?repo=other-owner/other-repo` → redirect to `/repos`, (4) browser dev tools `fetch("/api/runner/repos/other-owner%2Fother-repo/settings")` → 404, (5) `fetch("/api/runner/runs")` → only accessible repos' runs, (6) `PUT /runs/{runId}/verdict?repo=other-owner/other-repo` → 404, (7) normal flow on own repos works unchanged (approve, reject, submit, close), (8) `npx tsc --noEmit` clean
- [ ] **Rate limiting** — no rate limiting on any endpoint. Risks: brute-forcing API keys, flooding `/triage-run` (triggers OpenAI calls billed to BYOK key + consumes Render compute), flooding `/ask`. Add middleware-level rate limiting before onboarding external users. Consider per-IP and per-API-key limits separately
- [ ] **SSE connection limit** — `_subscribers` in `events.py` is an unbounded list with unbounded `asyncio.Queue` per subscriber. An authenticated caller (or buggy dashboard with reconnection loops) can exhaust server memory. Add a subscriber cap (e.g., 50) and bounded queue size (e.g., maxsize=100). Drop oldest subscriber when cap is reached
- [ ] **Reliability fixes** — see details in "Reliability fixes" section below
- **Gate: once critical items are done, evaluate publishing CLI to npm.** Prerequisites: dashboard multi-tenancy, rate limiting, Qdrant collection isolation per tenant, invite code or waitlist gate on API key generation. For design partners before that: share the CLI as a local checkout or private tarball

**Then (backlog — no priority order):**
- [ ] Stale PR comment cleanup on clean pass — `/report-clean` should delete old Triaige comments when re-run passes after baseline commit
- [ ] Classification accuracy — dark theme PR #3 classified as "unexpected" despite clear description. May be resolved by GPT-5.4-nano. Also: functional failure classification accuracy needs confirmation with more runs
- [ ] Manual setup path for `triaige init` — print instructions when `gh` CLI unavailable
- [ ] Empty repos page after overnight session — OAuth token expires, shows empty page instead of redirecting to sign-in
- [ ] Error message sanitization — GitHub API errors leak implementation details. Wrap with generic messages
- [ ] Favicon — currently shows default Vercel icon
- [ ] Compliance mode — repo setting toggle with e-signature, audit log, PDF export. ~1-2 hour build. See `docs/strategy.md` and `docs/sequencing.md`
- [ ] E2E verification of functional failure flow — mixed visual + functional PR to verify card rendering, submit flow, merge gate, issue materialization
- [ ] Known failure card states — re-triggered runs produce non-actionable cards incorrectly. See "Market demo polish" section
- [ ] Collapsed cards missing rationale/screenshots — "Show details" should include these after verdict
- [ ] Disable actions on superseded PR runs — banner + disable buttons when newer commit is pushed
- [ ] close-pr-runs.yml merge strategy support — squash-and-merge, rebase-and-merge (currently only handles merge commits)
- [ ] PR cards link to GitHub PR — title shown but not clickable
- [ ] Failure card sort order — expected → uncertain → unexpected, by confidence desc
- [ ] Settings link on runs page — move from repo card to runs page (per-repo action)
- [ ] Repos page refresh on App change — doesn't update when a new repo is added to GitHub App
- [ ] Render paid tier — $7/mo to eliminate cold starts
- [ ] CORS method/header wildcards — tighten to explicit lists
- [ ] `/report-clean` input validation — Pydantic model, hex/int validation
- [ ] GitHub token in JWT cookie — consider JWE or server-side sessions
- [ ] AUTH_SECRET minimum length — add startup validation
- [ ] ~~Repo setup checklist on cards~~ — superseded by setup banners (amber pill covers the main case)
- [ ] SSE event filtering by tenant — TransformStream in proxy to drop events for repos the user can't access. Low priority (events only contain `{run_id, repo}`, all actions validated)
- [ ] Qdrant collection isolation per tenant — episodic memories currently shared across tenants. Not exploitable but cleaner with per-tenant filtering

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
- [ ] **`/report-clean` 500 on PR #78 merge** — endpoint returned Internal Server Error (2026-03-18), leaving 3 pre-merge runs open and actionable. Root cause unknown
- [ ] **Merged PR runs must not be actionable** — PR #78's run showed approve/reject buttons days after merge. Dashboard should detect merged PRs and show read-only
- [ ] **Audit `api.ts` mutation functions for silent failures** — missing `res.ok` checks on mutations
- [ ] **Submit flow smoke test** — automated test for runner's critical paths
- [ ] **Handle pgcrypto decryption failures gracefully** — if `BYOK_ENCRYPTION_KEY` is rotated, `pgp_sym_decrypt` throws unhandled error. Add try/except, return None with warning log
- [ ] **BYOK_ENCRYPTION_KEY rotation procedure** — no migration path. Document or build a migration script

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
- [ ] **Basic multi-tenancy** — first step (done): per-repo API key access control. Second step: dashboard multi-tenancy (see "Critical" above)
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
