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

Full workflow test using multiple PRs on the sample app to exercise pre-merge,
post-merge, known failures, submissions, and run lifecycle.

### Setup

1. Enable both pre-merge and post-merge triage modes for the sample app repo
   in the Triaige dashboard settings.
2. Open **PR A** on the sample app with visual changes (mix of expected and
   unexpected). Wait for the pre-merge workflow to complete.
3. Open **PR B** from a separate branch that touches overlapping pages.
   Wait for the pre-merge workflow to complete.

### Steps

**Step 1 — PR comments (pre-merge)**
- Check PR A and PR B for the Triaige comment with classification table.
- All failures should show "New" in the Status column (no prior main-branch
  failures exist yet).
- Click the dashboard link in each comment.

**Step 2 — Dashboard PR tab**
- Both runs appear in the PR tab.
- Failures are read-only (no approve/reject buttons).
- No known failure annotations (no main-branch history yet).

**Step 3 — Merge PR A**
- Merge PR A on GitHub.
- The `push: branches: [main]` trigger fires a post-merge workflow run.
- Wait for it to complete.

**Step 4 — Dashboard Main tab**
- The post-merge run appears in the Main tab.
- Approve the expected failures (intentional design changes).
- Reject the unexpected failures (bugs).

**Step 5 — Submit Changes**
- Click "Submit Changes".
- Approved failures create a baseline update PR on the sample app.
- Rejected failures create GitHub issues (one per failure).
- Each failure card shows its submission link.

**Step 6 — Close the run**
- Click "Close Run".
- Run moves from Main tab to Closed tab.

**Step 7 — Re-trigger PR B**
- Re-trigger the visual regression workflow for PR B
  (`gh workflow run visual-regression.yml --field pr_number=<B>`).
- The new pre-merge run should now show known failure annotations for tests
  that overlap with the merged PR A run ("Known — since \<PR A title\>").
- Tests with open submissions from Step 5 should show "Baseline PR pending"
  or "Issue open" links.
- Approve/reject buttons remain hidden (pre-merge is read-only).

### What this validates

- Pre-merge PR comments with classification table and dashboard links
- PR tab vs Main tab vs Closed tab routing
- Read-only mode for pre-merge runs
- Post-merge approve/reject workflow
- Baseline PR creation and issue filing via Submit Changes
- Submission persistence and display
- Known failure detection (main-branch runs only, not PR runs)
- Known failure annotations with links to the originating PR
- Action gating when open submissions exist
- Run close lifecycle

---

## Known limitations

- **No uncertain classification yet**: The model tends toward binary expected/unexpected. May need prompt tuning or a scenario with genuinely ambiguous scope.
- **Subtle pixel changes can pass**: Status badge style change (pill → dot) didn't trigger a test failure despite `maxDiffPixelRatio: 0`. The `display: block` on truncated tbody may mask column-level changes.
- **Baseline timing**: Baselines must be regenerated after merging to main, before creating the next test PR. Otherwise tests compare against stale baselines.
- **Known failures are main-branch only**: The `get_known_failures` query only considers post-merge runs. PR-to-PR failure overlap is not tracked.
