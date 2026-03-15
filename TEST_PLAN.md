# Test Plan

Tracks scenarios for validating Triaige classification behavior end-to-end.

## How to test

1. Update baselines on main: trigger `update-snapshots.yml` workflow
2. Create a branch with visual changes in `triaige-sample-app`
3. Open a PR with a description that explicitly scopes what should change
4. Merge the PR to trigger the `visual-regression.yml` workflow
5. Check triage results in the Triaige UI

## Classification logic

The classifier uses **two signals** — the PR description (scope gate) and the git diff (code traceability):

| Visual change location | PR mentions it? | Traces to diff? | Defects? | Expected classification |
|---|---|---|---|---|
| In-scope page | Yes | Yes | No | Expected |
| In-scope page | Yes | Yes | Yes | Unexpected |
| In-scope page | Yes | No | No | Uncertain |
| Out-of-scope page | No | Yes | No | Unexpected |
| Out-of-scope page | No | No | No | Unexpected |
| Any page | Any | Any | Yes | Unexpected |
| Ambiguous / tangential | Partially | Yes | No | Uncertain |

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

### Scenario 6: Classification stability — temperature + git diff (Step 23) — NOT YET TESTED

**Goal**: Verify deterministic classifications and that git diff context improves accuracy.

**Setup**: Use existing PR #59 on sample app (accent color change, blue→indigo via `--color-accent` in globals.css).

**Determinism test** (run 3 times):
1. Close and reopen PR #59 (or push a trivial commit) to trigger a new triage run
2. Wait for the run to complete in the dashboard
3. Record the classification and confidence for each failure
4. Repeat steps 1-2 two more times
5. All 3 runs should produce **identical** classifications and confidence scores

**Accuracy test**:
- The accent color change on the sidebar should classify as **expected** since:
  - The git diff shows `--color-accent` changed in `globals.css`
  - The PR description says "Update accent color from blue to indigo"
- Expand the failure card and verify the rationale references the code change (e.g., "Accent color token updated")

**Verify**:
- [ ] 3 consecutive runs produce identical classifications (determinism)
- [ ] Sidebar accent color change classified as **expected** (accuracy)
- [ ] Rationale mentions the code change, not just the PR description
- [ ] Devil's advocate review includes `code_traceable` field
- [ ] No diff sent twice in the compose pass (check LangSmith trace)

---

## E2E Integration Test

Full workflow test using three PRs on the sample app to exercise the actionable
pre-merge workflow, merge gate, iterative PR fixes, known failures health
dashboard, net-new filtering, known failure passthrough with screenshot
comparison, and run lifecycle.

### Prerequisites

Before running the E2E test, ensure a clean state:

1. **Close all open PRs and issues** on the sample app repo:
   ```
   gh pr list --state open --repo dmcphillips13/triaige-sample-app --json number -q '.[].number' | xargs -I{} gh pr close {} --delete-branch --repo dmcphillips13/triaige-sample-app
   gh issue list --state open --repo dmcphillips13/triaige-sample-app --json number -q '.[].number' | xargs -I{} gh issue close {} --repo dmcphillips13/triaige-sample-app
   ```
2. **Clear the Triaige database**: delete each table in a separate statement
   to avoid transaction rollback if a table doesn't exist yet:
   ```
   PGPASSWORD=<password> psql "<connection_string>" \
     -c "DELETE FROM submissions;" \
     -c "DELETE FROM verdicts;" \
     -c "DELETE FROM failure_results;" \
     -c "DELETE FROM runs;" \
     -c "DELETE FROM known_failures;" \
     -c "DELETE FROM pending_issues;"
   ```
   **Important**: Do NOT combine into a single `-c` with semicolons — if any
   table doesn't exist, the entire transaction rolls back and nothing is deleted.
3. **Temporarily remove branch protection** so the snapshot update can push to main:
   ```
   gh api repos/OWNER/REPO/branches/main/protection -X DELETE
   ```
4. **Update baselines on main**: trigger the `update-snapshots.yml` workflow so
   baselines match the current main branch code. Wait for it to complete:
   ```
   gh workflow run "Update Snapshots" --repo OWNER/REPO
   # Wait ~90s, then verify:
   gh run list --repo OWNER/REPO --workflow "Update Snapshots" --limit 1
   ```
5. **Re-enable branch protection** with `strict: true`:
   ```
   gh api repos/OWNER/REPO/branches/main/protection -X PUT --input - <<'EOF'
   {
     "required_status_checks": {"strict": true, "contexts": ["Triaige Visual Regression"]},
     "enforce_admins": false,
     "required_pull_request_reviews": null,
     "restrictions": null
   }
   EOF
   ```
6. **Verify GitHub App has Checks permission**: the Triaige GitHub App needs
   Checks (read/write) for merge gate support.
7. **Pull updated baselines locally**: `git pull` on the sample app repo to
   get the latest baseline screenshots before creating PR branches.
8. **Sign out and sign back in** to the Triaige dashboard to get a fresh
   session with a refresh token. This validates the OAuth token refresh flow.

### Setup: Create two PRs

**PR A** — expected changes with one unexpected bug:
1. Branch from main: `git checkout -b design-refresh`
2. Make intentional design changes in `globals.css` (e.g., update font sizes,
   change card background) — these are the **expected** changes.
3. Also introduce one subtle visual bug in a component (e.g., change sidebar
   background or border) — this is the **unexpected** change that will become
   a known failure on main.
4. Write a narrowly scoped PR description that only mentions the design token
   changes. Example:
   > "Update heading font sizes and card backgrounds. Only typography and color
   > tokens in globals.css were changed."
5. Push and open the PR. Wait for the `pull_request` workflow to complete.

**PR B** — clean changes on different components:
1. Branch from main (not from PR A): `git checkout main && git checkout -b accent-update`
2. Make clean changes to different tokens (e.g., accent color, border radius)
   that affect different pages than PR A.
3. Write a narrowly scoped PR description. Example:
   > "Change accent color and update border radius. Only color and radius
   > tokens in globals.css were changed."
4. Push and open the PR. Wait for the `pull_request` workflow to complete.

### Step 1 — Check PR comments and merge gate

**Action**: Go to PR A and PR B on GitHub.

**Verify** (both PRs):
- [ ] Triaige comment exists with classification table
- [ ] "View full results" link points to dashboard and **opens in a new tab**
- [ ] "Triaige Visual Regression" check shows `action_required` (blocking merge)
- [ ] "Action required: address all failures before merging." in comment
- [ ] PR checks show only `visual-tests` job — **no skipped `close-pr-runs` job**

**Verify** (PR A specifically):
- [ ] Mix of expected/unexpected classifications

### Step 2 — Triage PR A on dashboard

**Action**: Open the Triaige dashboard. PR tab should be the default.

**Verify**:
- [ ] Both PR A and PR B runs appear in the PR tab
- [ ] Clicking PR A's run shows failure cards with **approve/reject buttons**
- [ ] No known failure annotations (no main-branch history yet)

**Action**: For each failure in PR A's run:
- **Approve** failures that match the PR description (expected design changes)
- **Reject** the unexpected failure (e.g., sidebar bug)

**Verify**:
- [ ] Approved failures show green checkmark
- [ ] Rejected failures show red X
- [ ] "Submit Changes" button appears

### Step 3 — Submit changes on PR A

**Action**: Click **Submit Changes** on PR A's run.

**Verify** (while submitting):
- [ ] Approve/reject buttons are **disabled** during submission (no "click to undo")

**Verify** (after submit completes):
- [ ] Submit bar shows **"Rejected → issues on merge"** (not "Rejected → GitHub issues")
- [ ] Approved failures → baselines committed directly to PR A's branch
      (check commit list for "triaige/update-baselines: update N baseline(s)")
- [ ] Approved failure cards show **"Baseline committed"** label
- [ ] Rejected failure shows **"Issue will be filed on merge"** in amber text (not a link)
- [ ] **No GitHub issue created yet** — check the sample app repo's issues list
- [ ] Each failure card shows its submission link or deferred label
- [ ] Approve/reject buttons hidden on submitted failures (action gating)

**Action**: Go to PR A on GitHub.

**Verify**:
- [ ] "Triaige Visual Regression" check updated to `success`
- [ ] New baseline commit visible in PR's commit list
- [ ] PR is now mergeable (green merge button)

### Step 3.5 — Verify pending issue filtering and stale comment cleanup

The baseline commit triggers a new `pull_request` workflow run on PR A.

**Verify**:
- [ ] Workflow runs and completes
- [ ] The rejected failure is **not** included in the new triage run (pending
      issue filtering skips it)
- [ ] PR comment notes "1 failure with issue pending merge" with the test name
- [ ] **Previous triage comment deleted** — only the latest comment remains on
      the PR (no stale comments from the prior run)
- [ ] Passing check created — no actionable failures remain
- [ ] PR remains mergeable (no hanging check)
- [ ] Still **no GitHub issue** on the sample app repo

### Step 4 — Verify PR B does NOT skip the pending failure

Before merging PR A, verify that PR B still sees the rejected failure as a
normal actionable failure — the pending issue is scoped to PR A only and must
not pollute other PRs.

**Prerequisite**: PR B must also fail the same test as the rejected failure in
PR A (e.g., if PR A rejected a sidebar bug, PR B should also break the sidebar).

**Verify**:
- [ ] PR B's triage run includes the sidebar failure as **actionable** (not skipped)
- [ ] PR B's triage comment does NOT mention "pending merge" for that test
- [ ] The failure has approve/reject buttons — it's a normal net-new failure

### Step 5 — Merge PR A (deferred issue materialization)

**Action**: Merge PR A via rebase workflow (rebase onto main, push to main).

**Wait**: ~3 minutes for the `push: branches: [main]` workflow to complete.
Push-to-main calls `/report-clean` which auto-closes pre-merge runs AND
materializes any pending issues.

**Verify**:
- [ ] PR A's pre-merge run auto-closed (moved from PR tab to Closed tab)
- [ ] **GitHub issue now created** on the sample app repo for the rejected failure
- [ ] `known_failures` table has an entry for the rejected test
- [ ] Submission URL updated from `deferred:merge` to the real issue URL
- [ ] No post-merge triage run created

### Step 6 — Check Main tab (known failures health dashboard)

**Action**: Open the Triaige dashboard. Click the **Main** tab.

**Verify**:
- [ ] Known failure card appears for the rejected failure (e.g., sidebar)
- [ ] Card shows the failing baseline screenshot prominently
- [ ] Card shows issue number with link to the GitHub issue
- [ ] Card has a "Close" button
- [ ] No run cards or "Diagnostic" badges — Main tab shows individual known
      failures, not runs

### Step 7 — Push a fix commit to PR B

This tests the iterative workflow where a developer pushes code changes to
address failures rather than immediately approving baselines.

**Action**: Push a commit to PR B that fixes one or more of the expected
failures (e.g., revert a change that was causing an unwanted visual diff).

**Wait**: ~3 minutes for the new `pull_request` workflow to complete.

**Verify**:
- [ ] Old pre-merge run auto-closed (superseded by new run)
- [ ] New triage run created with fewer failures (the fixed ones pass now)
- [ ] New "Triaige Visual Regression" check on PR B (`action_required`)
- [ ] **Previous triage comment deleted** — only the new comment remains
- [ ] Dashboard PR tab shows only the new run

### Step 8 — Rebase PR B onto main (known failure now active)

Since PR A was merged, PR B needs to be rebased to pick up the new baselines
(branch protection requires up-to-date branches). The deferred issue from
PR A is now materialized — the rejected failure should be skipped as a known
failure with a link to the open issue.

**Action**: Rebase PR B onto main and force push:
```
git checkout <pr-b-branch> && git rebase main && git push --force-with-lease
```

**Wait**: ~3 minutes for the new workflow to complete.

**Verify**:
- [ ] Old run auto-closed, new run created
- [ ] New run only shows net-new failures (failures already on main are filtered)
- [ ] The rejected failure from PR A is **skipped as a known failure** (not actionable)
- [ ] PR comment lists it under "known failures skipped" with **"open issue"** link
      pointing to the GitHub issue created at merge time
- [ ] Contrast with Step 4: before PR A merged, this same failure was actionable
      on PR B; now it's correctly tracked as a known failure

### Step 9 — Triage and submit PR B

**Action**: Approve remaining expected failures. If any unexpected failures
remain, reject them to file issues. Click **Submit Changes**.

**Verify**:
- [ ] Baselines committed to PR B's branch
- [ ] Issues created for rejections (if any)
- [ ] Check updated to `success`
- [ ] PR B is now mergeable

### Step 10 — Verify baseline re-run on PR B

The baseline commit triggers a new workflow run.

**Verify**:
- [ ] Workflow completes
- [ ] If remaining failure has a submission from prior run: gate-already-passed
      → passing check created immediately
- [ ] If all tests pass: `/report-clean` creates passing check
- [ ] PR remains mergeable

### Step 11 — Merge PR B

**Action**: Merge PR B on GitHub.

**Wait**: ~3 minutes for the push-to-main workflow to complete.

**Verify**:
- [ ] PR B's pre-merge run auto-closed
- [ ] No post-merge triage run created (just `/report-clean` cleanup)

### Step 12 — Test known failure passthrough (PR C)

This tests that known failures on main don't block unrelated PRs, and that
developers are notified about skipped known failures.

**Action**: Create PR C with a small change that also triggers the known failure
(e.g., change a color token that affects the same page as the broken test):
```
git checkout -b minor-tweak main
# make a small CSS change
git push -u origin minor-tweak
gh pr create --title "Minor styling tweak" --body "Small token change"
```

**Wait**: ~3 minutes for the workflow to complete.

**Verify**:
- [ ] If the only failure is the known one: all failures filtered as known →
      no triage run created → passing check created immediately → PR is mergeable
- [ ] If PR C introduces new failures: triage run only contains net-new
      failures, not the known one
- [ ] **PR comment posted** listing skipped known failures with manual
      verification note: "These tests are failing on main with open issues.
      Please verify these areas manually..."
- [ ] If the known failure's screenshot changed (PR C modified the area):
      - [ ] PR comment shows **"⚠️ visual drift detected"** next to that test (not
            just "open issue")
      - [ ] **Comment posted on the GitHub issue** noting the PR that modified it
            further: "PR #N further modifies this area"
- [ ] If the known failure's screenshot is **unchanged**: PR comment shows just
      "open issue" link with no drift warning

### Step 13 — Close known failure from Main tab

**Action**: Click the "Close" button on the known failure card in the Main tab.

**Verify**:
- [ ] Known failure card disappears from Main tab
- [ ] GitHub issue is also closed
- [ ] Main tab shows "No known failures. All baselines are passing."

### Step 14 — Final dashboard state

**Action**: Check all three tabs.

**Verify**:
- [ ] **PR tab**: shows only open PR runs (PR C if not yet merged, otherwise empty)
- [ ] **Main tab**: empty (known failure was closed)
- [ ] **Closed tab**: shows closed runs from all merged PRs
- [ ] Run counts in tab labels are accurate

### What this validates

- **Actionable pre-merge runs**: approve/reject + submit on PR tab
- **Baseline commits to PR branch**: approved baselines go directly into the PR
- **"Baseline committed" label**: correct submission label on pre-merge runs
- **Deferred issue creation**: rejected failures on pre-merge runs record intent
  but do not create GitHub issues or `known_failures` entries until the PR merges
- **"Issue will be filed on merge" label**: deferred submissions show amber text,
  not a clickable link
- **Pending issue filtering**: re-triggered CI on the same PR skips failures with
  existing pending issues, preventing duplicate actionable runs
- **Pending issue scoping**: pending issues on PR A do not affect PR B — other PRs
  still see the failure as actionable until it lands on main
- **Issue materialization on merge**: `/report-clean` creates the GitHub issue,
  populates `known_failures`, and updates the submission URL when the PR merges
- **Merge gate**: check blocks merge until all failures addressed (deferred
  submissions count), updates to `success` when gate passes
- **Gate-already-passed**: re-triggered runs with already-submitted failures
  get a passing check immediately
- **Iterative PR workflow**: push fixes → new run with fewer failures
- **Rebase workflow**: rebase onto main → new run with updated baselines
- **Baseline re-run**: baseline commits trigger workflow, passing check created
  (no hanging checks)
- **No post-merge triage runs**: push-to-main just calls `/report-clean` for cleanup
- **Known failures health dashboard**: Main tab shows individual failing baselines
  with screenshots, issue links, and close button
- **Close known failure**: closing from UI also closes the GitHub issue
- **Net-new failure filtering**: known failures (from `known_failures` table) are
  filtered out of pre-merge runs
- **Known failure passthrough**: known failures on main don't block unrelated PRs
- **Known failure PR comment**: skipped known failures listed with manual
  verification note
- **Screenshot comparison with drift detection**: if a PR changes a known-broken
  area, comment posted on the GitHub issue AND PR comment shows "⚠️ visual drift
  detected"; unchanged known failures show just the issue link
- **Auto-close pre-merge runs**: superseded by newer run, or on merge via
  `/report-clean`
- **Baseline commit skip**: workflow skips when commit message contains
  "triaige/update-baselines"
- **Stale comment cleanup**: previous Triaige comments deleted when a new one
  is posted (no comment buildup from superseded runs)
- **Separate CI workflows**: `close-pr-runs` in its own workflow so skipped jobs
  don't clutter PR checks
- **OAuth token refresh**: session stores refresh token, auto-refreshes access
  token before 8-hour expiry; validated by signing out and back in before test
- PR comment with classification table and dashboard links
- Submission link display and action gating
- Run lifecycle across PR / Main / Closed tabs
- `strict: true` branch protection (require up-to-date before merging)

---

## Known limitations

- **Subtle pixel changes can pass**: Very small visual changes may not trigger a
  test failure depending on Playwright's diff threshold configuration.
- **Baseline timing**: After merging to main, PR branches should be rebased to
  pick up new baselines. `strict: true` branch protection enforces this.
- **Known failures are repo-scoped**: The `known_failures` table tracks failures
  per repo. PR-to-PR failure overlap is not tracked.
- **Screenshot comparison is binary**: Compares base64 strings for equality —
  any difference (even re-render noise) triggers the "further modified" notice.
  May need perceptual hashing in the future.
