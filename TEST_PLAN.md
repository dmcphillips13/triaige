# Test Plan

Tracks scenarios for validating Triaige classification behavior end-to-end.

## How to test

1. Update baselines on main: trigger `update-snapshots.yml` workflow
2. Create a branch with visual changes in `triaige-sample-app`
3. Open a PR with a description that explicitly scopes what should change
4. Merge the PR to trigger the `visual-regression.yml` workflow
5. Check triage results in the Triaige UI

## Classification logic

The classifier uses the **PR description** as the primary scope reference:

| Visual change location | PR mentions it? | Defects? | Expected classification |
|---|---|---|---|
| In-scope page | Yes | No | Expected |
| In-scope page | Yes | Yes | Unexpected |
| Out-of-scope page | No | No | Unexpected |
| Out-of-scope page | No | Yes | Unexpected |
| Ambiguous / tangential | Partially | No | Uncertain |

## Test scenarios

### Scenario 1: Settings redesign (PR #20) — PASSED

**PR description**: "Redesign the settings page with improved section headers and save button. Only the settings page is affected."

**Actual changes**:
- `settings/page.tsx` — accent border on section headers, larger save button (in-scope)
- `kpi-card.tsx` — orange top accent border on KPI cards (out-of-scope)
- `data-table.tsx` — status badges changed from pills to dot indicators (out-of-scope)

**Results**:
- Settings → Expected ✅
- Overview → Unexpected ✅
- Users → test passed (badge change too subtle to trigger pixel diff)

**Notes**: Scope-alignment rationale was accurate. Demonstrates expected vs unexpected based on PR description scope.

---

### Scenario 2: Uncertain classification — NOT YET TESTED

**Goal**: Produce an "uncertain" classification alongside expected and unexpected.

**Approach options**:
- PR description that's intentionally vague about scope (e.g., "improve UI styling" without naming specific pages)
- Change a shared component mentioned tangentially in the PR (e.g., PR says "update form styles" and a shared form component appears on multiple pages)
- Subtle change on a page plausibly connected to the PR but not explicitly named

---

### Scenario 3: Visual defect on in-scope page — NOT YET TESTED

**Goal**: Produce an "unexpected" classification on a page the PR explicitly mentions (because the change introduces a visible defect).

**Approach**: PR says "update users table layout" but the change clips/truncates content or causes overflow.

---

### Scenario 4: All tests pass (no failures) — NOT YET TESTED

**Goal**: Confirm no triage results are produced when all visual tests pass.

---

### Scenario 5: Large diff with mixed results — NOT YET TESTED

**Goal**: PR touches many pages. Some changes match description, some don't.

**Approach**: PR description mentions 2 of 4 changed pages. Expect expected on the 2 mentioned, unexpected on the others.

---

## E2E Integration Test

Full workflow test using two PRs on the sample app to exercise pre-merge,
post-merge, known failures, submissions, and run lifecycle.

### Prerequisites

Before running the E2E test, ensure a clean state:

1. **Close all open PRs and issues** on the sample app repo:
   ```
   gh pr list --state open --repo dmcphillips13/triaige-sample-app | ...close each
   gh issue list --state open --repo dmcphillips13/triaige-sample-app | ...close each
   ```
2. **Clear the Triaige database**: delete all rows from `runs`, `failure_results`,
   `verdicts`, `submissions` tables (connect to Neon or use a reset endpoint).
3. **Update baselines on main**: trigger the `update-snapshots.yml` workflow so
   baselines match the current main branch code. Wait for it to complete.
4. **Enable triage modes**: in the Triaige dashboard settings for
   `dmcphillips13/triaige-sample-app`, enable both pre-merge and post-merge.

### Setup: Create two PRs

**PR A** — mix of expected and unexpected changes:
1. Branch from main: `git checkout -b design-refresh`
2. Make intentional design changes (e.g., change accent color, update font sizes
   in `globals.css`) — these are the **expected** changes.
3. Introduce visual bugs (e.g., `visibility: hidden` on table body in
   `data-table.tsx`, zero out padding in `report-card.tsx`) — these are
   **unexpected** changes.
4. Write a narrowly scoped PR description that only mentions the design token
   changes, not the bugs. Example:
   > "Updated accent color and heading font sizes. Only color palette and
   > typography tokens in globals.css were changed."
5. Push and open the PR. Wait for the `pull_request` workflow to complete.

**PR B** — overlapping clean changes:
1. Branch from main (not from PR A): `git checkout main && git checkout -b sidebar-update`
2. Make clean changes to a shared component (e.g., dark sidebar theme, KPI card
   border fix) that affect overlapping pages.
3. Write a narrowly scoped PR description. Example:
   > "Changed sidebar to dark theme and fixed KPI card border color. Only
   > sidebar and KPI card components were modified."
4. Push and open the PR. Wait for the `pull_request` workflow to complete.

### Step 1 — Check PR comments (pre-merge)

**Action**: Go to PR A on GitHub.

**Verify**:
- [ ] Triaige comment exists with classification table
- [ ] Mix of expected/unexpected classifications (design changes = expected,
      bugs = unexpected)
- [ ] All failures show "New" in Status column (no prior main-branch failures)
- [ ] "View full results" link points to dashboard

**Action**: Go to PR B on GitHub.

**Verify**:
- [ ] Triaige comment exists with classification table
- [ ] All failures show "New" in Status column
- [ ] Classification reflects PR B's scope (sidebar/KPI changes = expected,
      other page changes = unexpected)

### Step 2 — Check dashboard PR tab

**Action**: Open the Triaige dashboard. Click the **PR** tab.

**Verify**:
- [ ] Both PR A and PR B runs appear in the PR tab
- [ ] Clicking a run shows failure cards
- [ ] No approve/reject buttons (pre-merge is read-only)
- [ ] No known failure annotations (no main-branch history yet)

### Step 3 — Merge PR A

**Action**: Merge PR A on GitHub (merge button or `gh pr merge <number> --merge`).

**Wait**: ~3 minutes for the `push: branches: [main]` workflow to complete.

**Verify**:
- [ ] No new comment on the PR (post-merge runs don't post comments)

### Step 4 — Triage on Main tab

**Action**: Open the Triaige dashboard. Click the **Main** tab.

**Verify**:
- [ ] New post-merge run appears titled with PR A's title
- [ ] Failure cards show approve/reject buttons
- [ ] No known failure annotations (this is the first main-branch run)

**Action**: For each failure, expand and review the screenshots.
- **Approve** failures that match the PR description (accent color, font sizes)
- **Reject** failures that are bugs (hidden table, crushed cards)

**Verify**:
- [ ] Approved failures show green checkmark
- [ ] Rejected failures show red X
- [ ] "Submit Changes" button appears (or becomes enabled)

### Step 5 — Submit changes

**Action**: Click **Submit Changes**.

**Verify**:
- [ ] Approved failures → a baseline update PR is created on the sample app repo
- [ ] Rejected failures → GitHub issues are created (one per rejection)
- [ ] Each failure card now shows its submission link ("Baseline PR open" or
      "Issue open")
- [ ] Approve/reject buttons are now hidden on submitted failures (action gating)

### Step 6 — Close the run

**Action**: Click **Close Run**.

**Verify**:
- [ ] Run disappears from Main tab
- [ ] Run appears in Closed tab
- [ ] Closed run is read-only (no actions)

### Step 7 — Re-trigger PR B

**Action**: Re-trigger the workflow for PR B:
```
gh workflow run visual-regression.yml --field pr_number=<B>
```
Wait ~3 minutes for the workflow to complete.

**Action**: Check PR B on GitHub for the updated Triaige comment.

**Verify**:
- [ ] Failures that overlap with PR A's run show "Known — since \<PR A title\>"
      with a link
- [ ] Failures with open submissions from Step 5 show "Baseline PR pending" or
      "Issue open"
- [ ] New failures (unique to PR B) show "New"

**Action**: Open the dashboard PR tab, click PR B's latest run.

**Verify**:
- [ ] Known failure annotations match the PR comment
- [ ] Still read-only (no approve/reject buttons)

### What this validates

- Pre-merge PR comments with classification table and dashboard links
- Mixed expected/unexpected/uncertain classifications from narrowly scoped PRs
- PR tab vs Main tab vs Closed tab routing
- Read-only mode for pre-merge runs
- Post-merge approve/reject workflow
- Baseline PR creation and issue filing via Submit Changes
- Submission link display and persistence
- Known failure detection (main-branch runs only, not PR runs)
- Known failure annotations with links to the originating PR
- Action gating when open submissions exist
- Run close lifecycle (Main → Closed)

---

## Known limitations

- **No uncertain classification yet**: The model tends toward binary expected/unexpected. May need prompt tuning or a scenario with genuinely ambiguous scope.
- **Subtle pixel changes can pass**: Status badge style change (pill → dot) didn't trigger a test failure despite `maxDiffPixelRatio: 0`. The `display: block` on truncated tbody may mask column-level changes.
- **Baseline timing**: Baselines must be regenerated after merging to main, before creating the next test PR. Otherwise tests compare against stale baselines.
- **Known failures are main-branch only**: The `get_known_failures` query only considers post-merge runs. PR-to-PR failure overlap is not tracked.
- **Superseded runs accumulate**: Multiple retriggers create duplicate runs in the Main/PR tabs. No auto-close mechanism yet. Tracked as Step 20.1.
- **PR comment noise**: Known failures are shown inline with new failures, making it hard to see what's new. Tracked as Step 20.2.
- **Post-merge classification accuracy**: Push-triggered runs extract PR context from merge commit messages, which sometimes loses PR description context. This can cause all failures to classify as unexpected. Tracked as Step 20.3.
