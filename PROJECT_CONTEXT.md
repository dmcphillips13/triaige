# PROJECT_CONTEXT.md — Triaige (Session Handoff)

Last updated: 2026-03-21

---

## Current status

**Phase:** Pre-vacation build sprint. Transitioning from demo project to product validation. Functional test failure support complete. Vision night (2026-03-21) sharpened GTM: primary target is frustrated Percy/Chromatic customers at mid-market B2B SaaS; SaMD/compliance is a vertical expansion play. Compliance mode features (~1-2 hours) unlock enterprise value across multiple markets. See `docs/sequencing.md` for phased plan and `docs/strategy.md` for full GTM analysis.

**Build priorities (in order):**
1. ~~CLI setup (`npx triaige init`)~~ — DONE. Full onboarding tested end-to-end
2. BYOK OpenAI key — CRITICAL. Users must never share the project owner's API key. Encrypted storage + settings UI + CLI prompt
3. Repo setup checklist — onboarding UX. Show GitHub App / init / first run status on repo cards
4. Manual setup path for `triaige init` — support users without `gh` CLI
5. E2E test round 2 (BYOK + checklist) → E2E test round 3 (manual setup, no `gh`)
6. Reliability fixes — report-clean 500, merged PR actionability, silent API failures
7. Basic multi-tenancy — per-org data isolation
8. Compliance mode — repo setting toggle with e-signature, audit log, PDF export

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

### Session 2026-03-20 — Submit flow fix + model upgrade breakthrough
- [x] **Submit → gate check → auto-close works end-to-end** — PR #76 on sample app: approved 5 failures, submitted, submissions persisted, gate passed, run auto-closed. First successful gate-pass auto-close (previous auto-closes were all via superseding mechanism)
- **GPT-5.4-nano is a step change in classification quality** — rationale went from vague summaries (4o-mini: "color change not in PR scope") to grounded explanations (5.4-nano: "Card border radius changed — aligns with globals.css radius token update"). Functional test P0 misclassification also appears resolved. The product thesis — intent-aware triage grounded in code context — now lands visibly in the output

### Session 2026-03-22 — CLI setup, per-repo API keys, settings page, onboarding test

**Built:**
- [x] **Repo setup CLI (`npx triaige init`)** — full interactive CLI at `packages/cli/`. Checks prerequisites (gh, jq, git remote, package manager), prompts for API key (masked), validates runner connection, sets GitHub secrets via `gh secret set` (stdin, never in args/files), detects Playwright config + JSON reporter, generates workflow files + post-failures.sh, generates baselines in CI (temporary workflow, wait for completion, pull, cleanup), handles branch protection (removes before baseline push, restores after), checks GitHub App access, prints validation summary. Built with tsup + @inquirer/prompts + chalk. All green checks on test-triaige-onboarding repo
- [x] **Per-repo API keys** — `api_key` column on `repo_settings` table, auto-generated on first access (`tr_` prefix + cryptographically random token). Auth middleware accepts both global key (dashboard proxy) and per-repo keys (CI workflows). `GET /repos/{repo}/api-key` endpoint
- [x] **Dashboard settings page** — `/repos/[owner]/[repo]/settings` route. Shows API key (copy-to-clipboard), `npx triaige init` command (copy-to-clipboard), merge gate toggle. Settings link on repo cards
- [x] **Runner URL hardcoded in CLI** — removed runner URL prompt, hardcoded to `https://triaige-runner.onrender.com`
- [x] **CI baseline generation** — CLI creates temporary update-snapshots workflow, pushes it, triggers via `gh workflow run`, waits with retry logic, pulls CI-generated baselines, removes temp workflow. Handles branch protection removal/restoration automatically. Shows GitHub Actions URL during wait
- [x] **Empty run fix** — if `/triage-run` receives 0 failures after parsing, creates passing check and returns early (no empty run creation)
- [x] **gh auth detection fix** — handles stdout/stderr correctly across gh CLI versions
- [x] **Runner health check timeout** — 15s timeout on `/health` validation

**Blocking bug (P0 — FIXED):**
- [x] **Triage run shows 0 failures despite CI reporting 1 failure** — Root cause: `get_or_create_api_key` inserted `(repo, api_key)` without explicit boolean columns, and the DB column default for `pre_merge` was `FALSE` instead of `TRUE` (schema mismatch). The `/triage-run` endpoint hit the early return at line 292 (`if mode == "pre_merge" and not rs.pre_merge`) creating an empty run. Fix: explicit `pre_merge=TRUE, post_merge=TRUE, merge_gate=TRUE` in the INSERT + migration to fix existing rows. Confirmed via `GET /repos/.../settings` showing `pre_merge: false` before fix, `true` after

### Session 2026-03-22 (evening) — Security hardening

**Security audit and fixes:**
- [x] **Global OpenAI key fallback removed** — `get_openai_client()`, `_get_llm()`, and `/feedback` all silently fell back to the project owner's key. All three paths now require BYOK contextvar. `index_corpus.py` sets contextvar from env explicitly. Security rules documented in AGENTS.md §13.1
- [x] **Per-repo access control on all 25 endpoints** — added `_check_repo_access` to 6 repo-path endpoints, `_check_run_access` helper (404 to prevent enumeration) to 10 run-based endpoints, repo guard on `/ask` and `/triage-run`, `_check_repo_access` on `/report-clean`, `/update-baselines`, `/create-issues`. `GET /runs` filtered by authenticated repo
- [x] **Run-repo consistency** — `/update-baselines` and `/create-issues` now verify `run.repo == req.repo` to prevent cross-repo state manipulation
- [x] **Temp file cleanup** — `post-failures.sh` trap removes enriched JSON and payload files on exit
- **Tenancy model decided:** Tenant = GitHub App installation. Orgs share data among members. Solo users work without requiring an org. Mirrors Vercel/Codecov/Chromatic

**Second audit (post-fixes) confirmed no remaining exploitable vulnerabilities in the per-repo key path.** Remaining work: dashboard multi-tenancy (global key gives all dashboard users cross-repo access), rate limiting, SSE connection limits. All documented in "Not yet done" section above.

### Session 2026-03-21 — P0 bug fix, onboarding test, BYOK, security hardening

**P0 bug fixed:**
- [x] `pre_merge` defaulting to FALSE — `get_or_create_api_key` didn't set explicit boolean columns. Migration added to fix existing rows

**Onboarding test passed (Steps 1-5 of TEST_PLAN.md § New user onboarding test):**
- Full clean-slate test: `triaige init` → PR → CI → classification → PR comment → merge gate → approve → baseline commit → gate pass → merge → cleanup
- All working end-to-end on `dmcphillips13/test-triaige-onboarding` PR #3

**BYOK OpenAI key support built:**
- [x] Encrypted key storage (pgcrypto AES-256, `BYOK_ENCRYPTION_KEY` env var on Render)
- [x] Per-request key resolution via contextvars (header `X-OpenAI-Key` → DB → error). **Note:** fallback to global key was present in `get_openai_client()`, `_get_llm()`, and `/feedback` until session 2026-03-22 fix
- [x] Dashboard settings page: OpenAI key section (password input, validation, masked display, delete)
- [x] CLI: optional OpenAI key prompt during `triaige init`, set as GitHub secret
- [x] CI: `X-OpenAI-Key` header in workflow template and post-failures.sh
- [x] Key validation against OpenAI `/v1/models` before storing
- [x] Log scrubbing filter to prevent key leakage
- [x] Settings page "Setup required" banner when no OpenAI key configured

**Security hardening:**
- [x] Cross-repo access fix — per-repo API keys can only access their own repo's BYOK endpoints (403 otherwise)
- [x] Validation error safety — PUT endpoint catches malformed JSON, returns clean 400
- [x] Encryption key strength — minimum 32 characters enforced on startup

**Not yet done (carry to next session):**

**P0 — Security (do first):**
- [x] **Global OpenAI key fallback removed** — `get_openai_client()`, `_get_llm()`, and `/feedback` endpoint all had silent fallback paths to the project owner's `OPENAI_API_KEY`. Fixed: both functions now raise if no BYOK key in contextvar; `/feedback` resolves BYOK key from DB before storing episode; `index_corpus.py` sets contextvar from env explicitly. See AGENTS.md §13.1 for security rules
- [x] **Cross-repo access control on repo-path endpoints** — added `_check_repo_access` to all 6 missing repo-path endpoints (settings GET/PUT, api-key, known-failures GET/GET-closed/PATCH-close)
- [x] **Cross-repo access control on run-based endpoints** — added `_check_run_access` helper (returns 404 to prevent enumeration) to all 10 run-based endpoints. `/feedback` hoists the check before any data read/write and reuses the DB call for BYOK resolution. `/update-baselines` and `/create-issues` use `_check_repo_access` on `req.repo`. `/ask` and `/triage-run` require per-repo keys to provide `pr_context.repo`
- [x] **`GET /runs` filtered by authenticated repo** — per-repo keys only see their repo's runs. `store.list_runs` accepts optional `repo_filter` param

- [x] **Run-repo consistency in `/update-baselines` and `/create-issues`** — both endpoints accepted `req.repo` from the body without verifying the run belonged to that repo. A user with access to two repos could use a run_id from repo-a with `repo: "repo-b"` to commit baselines or create issues on the wrong repo. Fixed: added `run.repo != req.repo` check after fetching the run
- [x] **Temp file cleanup in `post-failures.sh`** — CI script created `/tmp/results-enriched.json` and `/tmp/triaige-payload.json` but never deleted them. On self-hosted runners, another job could read the files. Fixed: `trap cleanup EXIT` removes both files on any exit

**P0 — Next to build:**
- [ ] **Setup banners on repos page and runs page** — settings page has the "Setup required" banner, but repos page cards and runs page need it too. Add `openai_key_configured: boolean` to `GET /repos/{repo}/settings` response. Repos page: subtle amber pill on cards. Runs page: banner at top
- [ ] **Early return gate in `/triage-run`** — currently returns 400 when no OpenAI key is found, which causes CI to exit with error. Should create a GitHub check with `conclusion: "action_required"` and summary explaining the missing key (merge gate blocks), return 200 with `status: "setup_required"`, and `post-failures.sh` detects this and exits 0 with a warning (CI workflow green, merge still blocked by check). Check creation uses GitHub App installation token (not OpenAI key), so it works without BYOK. Requires `head_sha` and `repo` from `pr_context` — if missing, fall back to current 400 behavior
- [ ] **Empty `X-OpenAI-Key` header validation** — `_resolve_openai_key` correctly treats empty string as falsy, but `post-failures.sh` sends `${OPENAI_API_KEY:-}` which is empty when the secret is unset. Verified safe (empty string is falsy in Python). Add explicit `.strip()` check as defense-in-depth

**P1 — Blocking for onboarding:**
- [ ] **Dashboard multi-tenancy** — the dashboard proxy forwards all requests with the global API key, so any logged-in user can access any repo's data by crafting requests through the proxy. Fix: before forwarding, check that the logged-in user's GitHub account has access to the requested repo via their GitHub App installations. Also filter SSE events by repo. See "Basic multi-tenancy" under "New MVP functionality" for full design notes and tenancy model decision
- [ ] **Full E2E test with BYOK** — test repo has been stripped clean (GitHub App removed, workflows removed, branch protection removed, DB cleaned). Ready for a full onboarding test from sign-out through to merged PR, verifying BYOK works end-to-end
- [ ] **Manual setup path for `triaige init`** — print instructions when `gh` CLI unavailable. Then E2E test without `gh`
- [ ] **Repo setup checklist on repo cards** — show setup steps (GitHub App, init, OpenAI key, first run) on repo cards, disappears when all complete
- [ ] **Rate limiting** — no rate limiting on any endpoint. Risks: brute-forcing API keys, flooding `/triage-run` (triggers OpenAI calls billed to BYOK key + consumes Render compute), flooding `/ask`. Add middleware-level rate limiting before onboarding external users. Consider per-IP and per-API-key limits separately
- [ ] **SSE connection limit** — `_subscribers` in `events.py` is an unbounded list with unbounded `asyncio.Queue` per subscriber. An authenticated caller (or buggy dashboard with reconnection loops) can exhaust server memory. Add a subscriber cap (e.g., 50) and bounded queue size (e.g., maxsize=100). Drop oldest subscriber when cap is reached

**P2 — Quality:**
- [ ] **Classification accuracy** — dark theme PR classified as "unexpected" despite clear PR description. May be a minimal-repo context problem vs prompt problem
- [ ] **Stale PR comment cleanup on clean pass** — `/report-clean` should delete old Triaige comments
- [ ] **Favicon** — currently shows default Vercel icon
- [ ] **Error message sanitization** — several endpoints return raw exception text to callers (e.g., `f"GitHub API error: {e}"`), leaking implementation details. Wrap with generic messages in production; log the full error server-side
- [ ] **CORS method/header wildcards** — `allow_methods=["*"]` and `allow_headers=["*"]` are broader than needed. Origins are properly restricted so actual risk is low. Tighten to explicit lists: methods `GET, POST, PUT, PATCH, DELETE`; headers `Content-Type, Authorization, X-GitHub-Token, X-OpenAI-Key`
- [ ] **`/report-clean` input validation** — accepts raw JSON body without Pydantic model. `head_sha` not validated as hex, `pr_number` not validated as int. Values go to parameterized SQL so injection risk is nil, but defense-in-depth says validate at the boundary
- [ ] **GitHub token readable from JWT cookie** — JWT is signed (HS256) but not encrypted. The payload (containing `github_token` and `refresh_token`) is base64-readable by anyone with access to the cookie. HTTP-only + secure + sameSite protects against most browser attacks, but a compromised machine could extract the token. Fix: use JWE (encrypted JWT) or move tokens to a server-side session store and keep only a session ID in the cookie. `apps/dashboard/src/lib/auth.ts` lines 18-26
- [ ] **AUTH_SECRET minimum length not enforced** — `auth.ts` line 28 checks if `AUTH_SECRET` exists but doesn't enforce minimum length. A weak secret could be brute-forced. Add `secret.length >= 32` validation at startup

**Test repo state:**
- `dmcphillips13/test-triaige-onboarding` — fully stripped for E2E test (GitHub App removed, no workflows, no branch protection, DB cleaned including repo_settings row)

### Vision night 2026-03-21 — GTM sharpening + compliance mode
- **Primary GTM target identified:** frustrated Percy/Chromatic customers at mid-market B2B SaaS companies (10-30 engineers, complex UIs, already paying $200-500/mo for visual testing). Product substitution pitch, not category creation
- **SaMD vertical expansion:** confirmed gap (no tool automates visual verification evidence for FDA Design History Files), but 6-12 month sales cycles and risk-averse buyers make it a secondary play. Compliance features are cheap to build and unlock value across all markets, not just SaMD
- **Compliance mode designed:** repo setting toggle (default off) enabling e-signature modal, requirement ID tagging, immutable audit log, PDF audit export. ~1-2 hour build session
- **Expansion paths documented:** integration test triage, performance regression triage, flaky test reclassification. All use the same pipeline with different parsers. Don't build — listen for demand in feedback calls
- **Joined OpenRegulatory Slack** for SaMD community signal (mostly regulatory docs discussion, not automated testing)
- **Outreach scripts written** for both developer teams and SaMD quality managers
- See `docs/strategy.md` for full analysis and `docs/sequencing.md` for updated build priorities

### Post-Demo Day — E2E findings
- [x] **Rationale accuracy (P0):** Fixed — prompt now requires each bullet to justify the classification (what changed + why it's expected/unexpected/uncertain) and bans filler bullets. Bullet count is dynamic (1-3) instead of fixed at 3. Confabulation (phantom region references) eliminated.

### New MVP functionality (build before going to market)
- [x] **Functional test failure support** — extend triage to handle functional Playwright failures (assertion errors, navigation failures, timeouts) alongside visual regressions. Same expected/unexpected/uncertain classification. Plain English failure summaries. See `docs/functional-test-plan.md` for implementation plan and `docs/strategy.md` for design rationale
  - **Follow-ups:**
  - [x] **Functional failure card actions** — single "Open GH issue to track bug" button with guidance note. E2E verification: see `TEST_PLAN.md` § Functional test follow-ups
  - [x] **Functional failure screenshot size** — constrained to `max-w-md` / `max-h-[250px]` with fullscreen modal on click
  - [x] **Fix proxy URL encoding for test names with slashes** — move `test_name` from URL path to request body for all mutation endpoints. Also added `res.ok` checks so future API errors surface in the UI
  - [ ] **Classification accuracy for functional failures (P0)** — appears resolved by GPT-5.4-nano upgrade (commit cf4169b). Needs a few more runs to confirm
  - [ ] **E2E verification of functional failure flow** — create a new PR with mixed visual + functional failures to verify card rendering, submit flow, merge gate, issue materialization, and known failure tracking. See `TEST_PLAN.md` § Functional test follow-ups
- [x] **Repo setup CLI (`npx triaige init`)** — built at `packages/cli/`. Full interactive setup with CI baseline generation. See session 2026-03-22 notes above for details
- [ ] **Basic multi-tenancy** — per-org data isolation so two teams' runs don't mix. Required before a second team can use the product. **First step: cross-repo access control fixes (see P0 security items in "Not yet done" above).** Second step: dashboard multi-tenancy (see below).
  - **Tenancy model decision (2026-03-22): Tenant = GitHub App installation.** An org that installs the Triaige GitHub App is one tenant. All org members with repo access share runs, verdicts, and submissions — triage is a team activity. A solo user with a personal GitHub account installation is also a valid tenant (no org required). This mirrors Vercel, Codecov, and Chromatic.
  - **Dashboard multi-tenancy (after per-repo key fix):** The dashboard proxy currently forwards all requests with the global API key, meaning any logged-in user can access any repo's data by crafting requests through the proxy. Fix: before forwarding, the proxy must check that the logged-in user's GitHub account has access to the requested repo via their GitHub App installations. This is the gate between "CI keys are isolated" and "dashboard users are isolated." Also scope SSE event filtering by repo at the same time (currently all events go to all subscribers)
- [ ] **Compliance mode** (from vision night 2026-03-21) — repo setting toggle (default: off) that enables e-signature modal, requirement ID tagging, immutable audit log, and PDF audit export. Makes Triaige enterprise-ready for any compliance-conscious buyer (SaMD, SOX, SOC 2). ~1-2 hour session. See `docs/strategy.md` compliance section and `docs/sequencing.md` §2 for full spec
- [x] **BYOK OpenAI key management** — encrypted storage, per-request key resolution, settings UI, CLI prompt, CI header. Global key fallback removed. See AGENTS.md §13.1 for security rules
- [ ] Multi-repo upstream diff resolution — build if a design partner needs it, skip if they don't

### Reliability fixes
- [ ] **Investigate and fix `/report-clean` 500 on PR #78 merge** — endpoint returned Internal Server Error when PR #78 merged (2026-03-18), leaving 3 pre-merge runs open and actionable. Root cause unknown. Once identified, make the endpoint resilient so the close always succeeds
- [ ] **Merged PR runs must not be actionable** — PR #78's run showed approve/reject buttons on the PR tab days after the PR merged. Dashboard should detect merged PRs and show the run as read-only
- [ ] **Audit API functions for silent failures** — audit all mutation functions in `api.ts` for missing `res.ok` checks. Any mutation that doesn't surface errors is a ticking time bomb
- [ ] **Submit flow smoke test** — automated test for runner's critical paths: submit + verdict storage, gate check, issue creation flow
- [ ] **Handle pgcrypto decryption failures gracefully** — if `BYOK_ENCRYPTION_KEY` is rotated on Render, `pgp_sym_decrypt` throws an unhandled PostgreSQL error. Not a security issue (doesn't leak the key), but surfaces as a 500. Users would need to re-enter their OpenAI keys. Add try/except in `repo_settings.get_openai_key()` to return None with a warning log instead of crashing. Document the key rotation procedure
- [ ] **BYOK_ENCRYPTION_KEY rotation procedure** — currently no migration path. If the key changes, all stored BYOK keys become unreadable. Document: (1) decrypt all keys with old key, (2) re-encrypt with new key, or (3) accept that users re-enter keys. Add a migration script if rotation is ever needed

### Onboarding polish
- [ ] **Repos page doesn't update when a new repo is added to the GitHub App** — requires manual page refresh. Repos page is a server component; SSE doesn't cover new repo additions. Either add SSE event for repo changes or add a client-side refetch on focus
- [x] **Empty runs created when all tests pass** — fixed: if `/triage-run` receives 0 failures after parsing, creates passing check and returns early
- [x] **P0: Triage run shows 0 failures despite CI reporting failures** — fixed: `pre_merge` defaulting to `FALSE` in DB. See session 2026-03-22 blocking bug (resolved)
- [ ] **Repo setup checklist on repos page** — show setup steps (GitHub App installed, first successful run received) on repo cards before runs exist. Disappears once setup is complete. Dashboard-only change
- [ ] **Classification accuracy: intentional changes classified as unexpected** — dark theme change on test-triaige-onboarding PR #3 classified as "unexpected" (72%) despite PR title "Switch to dark theme" and description explicitly mentioning the color changes. Classifier should weigh PR description match more heavily for clearly scoped changes
- [ ] **Delete stale PR comment on clean pass** — when `/report-clean` creates a passing check for a PR (all tests pass after baseline commit), delete any existing Triaige comments on that PR. Currently the old "action required" comment remains after the re-run passes
- [ ] **Manual setup path for `triaige init` without `gh` CLI** — when `gh` is not available, print step-by-step manual instructions for setting repo secrets, adding workflow files, and configuring branch protection. Currently warns but doesn't provide the instructions
- [ ] **Settings link should be on the repo-scoped runs page, not the repo card** — settings is a per-repo action and should be accessible from within the runs page (e.g., as a link/tab alongside the PR/Issues/Closed tabs), not from the repo card on the repos landing page

### Market demo polish
- [ ] **Known failure card states need fixing** — re-triggered CI runs produce non-actionable cards even when no action was taken on the previous run. Correct behavior: (1) **open GH issue exists** → card shown at bottom, non-actionable, links to the issue (informational only); (2) **pending issue (staged but not yet created)** → card shows a note that an issue is pending, but user can unselect and then approve baseline or re-stage; (3) **no action taken** → card is fully actionable. Only an opened issue makes a card non-actionable — pending is a draft decision the user can change each run
- [ ] **Collapsed cards missing rationale and screenshots** — after a verdict (approve/reject) or on closed runs with verdicts, cards collapse and "Show details" only reveals image diff stats, vision analysis, citations, and tool calls. Rationale and screenshots are completely hidden unless the verdict is undone. Fix: "Show details" should include rationale and screenshots (screenshots collapsed by default with a toggle to reveal). Applies to both open runs post-verdict and closed run history
- [ ] **Empty repos page after overnight session** — OAuth token expires (~8 hours) but session cookie persists, so the app shows "no repositories found" instead of redirecting to re-auth. Fix: attempt token refresh on page load before fetching repos; if refresh fails, redirect to sign-in instead of showing empty state
- [ ] **Rationale prompt refinement** — vague bullets and cross-card disambiguation issues appear resolved by GPT-5.4-nano upgrade. PR #76 rationale references specific CSS tokens and traces code changes to visual impact per page. Confirm with more runs before closing. If issues recur, iterate on prompts rather than model upgrade
- [ ] `close-pr-runs.yml` PR number extraction: support squash-and-merge, rebase-and-merge via button, and CLI rebase + direct push (currently only handles "Merge pull request #N" merge commits)
- [ ] **Disable actions on superseded PR runs** — after a new commit is pushed to a PR branch, the previous run's approve/reject buttons should be disabled with a banner ("Newer commit pushed — this run is outdated"). The run is still viewable for reference but taking action on stale analysis is confusing. The run will be auto-closed when the next run completes, but actions should be blocked immediately on push
- [ ] PR run cards should link to the GitHub PR (title shown but not clickable)
- [ ] Failure cards should sort by classification (expected → uncertain → unexpected, each by confidence desc)
- [ ] Upgrade Render to paid tier ($7/mo — eliminate cold starts)
- [ ] Add favicon to dashboard — currently shows default Vercel icon. Use the red plus sign from the logo
- [ ] **Classification regression library** — build up a library of sample app PRs with known expected outcomes (expected/unexpected/uncertain) across visual and functional failures. Use as a repeatable regression suite when changing prompts, classification logic, or adding new failure types. Start by keeping PRs created during feature work (functional test support, prompt refinements) as reference scenarios rather than creating them separately. Include edge cases over time: mixed-scope PRs, empty diffs, vague descriptions, large diffs

### Go to market polish
- ~~Security fixes — medium (error message sanitization, rate limiting, SSE subscriber cap)~~ — moved to P1/P2 above with detailed notes
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
| LLM (text) | GPT-5.4-nano | Fast, capable reasoning model; best LangChain integration |
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
| OpenAI API | Configured | GPT-5.4-nano + GPT-4o vision + text-embedding-3-small |
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
