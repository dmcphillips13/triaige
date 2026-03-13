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

Full workflow test using three PRs on the sample app to exercise the actionable
pre-merge workflow, merge gate, iterative PR fixes, post-merge diagnostics,
net-new filtering, known failure passthrough, and run lifecycle.

### Prerequisites

Before running the E2E test, ensure a clean state:

1. **Close all open PRs and issues** on the sample app repo:
   ```
   gh pr list --state open --repo dmcphillips13/triaige-sample-app --json number -q '.[].number' | xargs -I{} gh pr close {} --repo dmcphillips13/triaige-sample-app
   gh issue list --state open --repo dmcphillips13/triaige-sample-app --json number -q '.[].number' | xargs -I{} gh issue close {} --repo dmcphillips13/triaige-sample-app
   ```
2. **Clear the Triaige database**: delete all rows from `submissions`,
   `verdicts`, `failure_results`, `runs` tables (in that order for FK constraints).
3. **Update baselines on main**: trigger the `update-snapshots.yml` workflow so
   baselines match the current main branch code. Wait for it to complete.
4. **Verify GitHub App has Checks permission**: the Triaige GitHub App needs
   Checks (read/write) for merge gate support.
5. **Add branch protection rule**: add "Triaige Visual Regression" as a required
   status check with `strict: true` (require up-to-date branches):
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
- [ ] "View full results" link points to dashboard
- [ ] "Triaige Visual Regression" check shows `action_required` (blocking merge)
- [ ] "Action required: address all failures before merging." in comment

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

**Verify**:
- [ ] Approved failures → baselines committed directly to PR A's branch
      (check commit list for "triaige/update-baselines: update N baseline(s)")
- [ ] Rejected failure → GitHub issue created
- [ ] Each failure card shows its submission link
- [ ] Approve/reject buttons hidden on submitted failures (action gating)

**Action**: Go to PR A on GitHub.

**Verify**:
- [ ] "Triaige Visual Regression" check updated to `success`
- [ ] New baseline commit visible in PR's commit list
- [ ] PR is now mergeable (green merge button)

### Step 4 — Verify baseline re-run on PR A

The baseline commit triggers a new `pull_request` workflow run.

**Verify**:
- [ ] Workflow runs and completes
- [ ] If the rejected failure still exists: new triage run with 1 failure,
      but merge gate recognizes it already has a submission → check created
      as `success` immediately (gate-already-passed logic)
- [ ] If all tests pass: `/report-clean` creates a passing check
- [ ] PR remains mergeable (no hanging check)

### Step 5 — Merge PR A

**Action**: Merge PR A on GitHub.

**Wait**: ~3 minutes for the `push: branches: [main]` workflow to complete.

**Verify**:
- [ ] PR A's pre-merge run auto-closed (moved from PR tab to Closed tab)

### Step 6 — Check Main tab

**Action**: Open the Triaige dashboard. Click the **Main** tab.

**Verify**:
- [ ] If the rejected failure (e.g., sidebar) still fails on main: a post-merge
      diagnostic run appears with "Diagnostic" badge, showing the failure with
      its open issue link
- [ ] If all tests pass: Main tab is empty
- [ ] Post-merge runs are read-only (no approve/reject buttons)

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
- [ ] Dashboard PR tab shows only the new run

### Step 8 — Rebase PR B onto main

Since PR A was merged, PR B needs to be rebased to pick up the new baselines
(branch protection requires up-to-date branches).

**Action**: Rebase PR B onto main and force push:
```
git checkout <pr-b-branch> && git rebase main && git push --force-with-lease
```

**Wait**: ~3 minutes for the new workflow to complete.

**Verify**:
- [ ] Old run auto-closed, new run created
- [ ] New run only shows net-new failures (failures already on main are filtered)
- [ ] If the sidebar bug from PR A is failing on main, it does NOT appear in
      PR B's run (net-new filtering)

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

**Verify**:
- [ ] PR B's pre-merge run auto-closed
- [ ] Post-merge workflow runs; either all tests pass or creates a diagnostic run

### Step 12 — Test known failure passthrough (PR C)

This tests that known failures on main don't block unrelated PRs.

**Action**: Create PR C with a small change that doesn't fix the known failure
(e.g., change a color token that doesn't affect the broken test):
```
git checkout -b minor-tweak main
# make a small CSS change
git push -u origin minor-tweak
gh pr create --title "Minor styling tweak" --body "Small token change"
```

**Wait**: ~3 minutes for the workflow to complete.

**Verify**:
- [ ] If the only failure is the known one (e.g., sidebar): all failures
      filtered as known → no triage run created → passing check created
      immediately → PR is mergeable
- [ ] If PR C introduces new failures: triage run only contains net-new
      failures, not the known one
- [ ] No PR comment posted (known limitation — Step 21.5 will add visibility)

### Step 13 — Final dashboard state

**Action**: Check all three tabs.

**Verify**:
- [ ] **PR tab**: shows only open PR runs (PR C if not yet merged, otherwise empty)
- [ ] **Main tab**: shows diagnostic run(s) with known failures and open issue links
- [ ] **Closed tab**: shows closed runs from all merged PRs
- [ ] Run counts in tab labels are accurate

### What this validates

- **Actionable pre-merge runs**: approve/reject + submit on PR tab
- **Baseline commits to PR branch**: approved baselines go directly into the PR
- **Merge gate**: check blocks merge until all failures addressed, updates to
  `success` when gate passes
- **Gate-already-passed**: re-triggered runs with already-submitted failures
  get a passing check immediately
- **Iterative PR workflow**: push fixes → new run with fewer failures
- **Rebase workflow**: rebase onto main → new run with updated baselines
- **Baseline re-run**: baseline commits trigger workflow, passing check created
  (no hanging checks)
- **Diagnostic post-merge runs**: Main tab is read-only with "Diagnostic" badge
- **Net-new failure filtering**: only failures not in open post-merge runs
- **Known failure passthrough**: known failures on main don't block unrelated PRs
- **Auto-close pre-merge runs**: superseded by newer run, on merge, or on clean
  merge via `/report-clean`
- **Baseline commit skip**: workflow skips when commit message contains
  "triaige/update-baselines"
- PR comment with classification table and dashboard links
- Issue filing for rejected failures
- Submission link display and action gating
- Run lifecycle across PR / Main / Closed tabs
- `strict: true` branch protection (require up-to-date before merging)

---

## Known limitations

- **Known failure visibility on PRs**: When net-new filtering skips known failures,
  no PR comment is posted and the failures are invisible to the developer. Step 21.5
  will add a comment listing skipped tests with issue links and a manual verification note.
- **Subtle pixel changes can pass**: Very small visual changes may not trigger a
  test failure depending on Playwright's diff threshold configuration.
- **Baseline timing**: After merging to main, PR branches should be rebased to
  pick up new baselines. `strict: true` branch protection enforces this.
- **Known failures are main-branch only**: The `get_known_failures` query only
  considers post-merge runs. PR-to-PR failure overlap is not tracked.
- **No prior-PR attribution**: When a failure surfaces on a merge run but was
  caused by a different PR, there's no attribution. Future work: Step 23.
- **Duplicate PR comments**: Gate-passed "Ready to merge" comment can post
  multiple times. Step 21.2 will remove these entirely.
