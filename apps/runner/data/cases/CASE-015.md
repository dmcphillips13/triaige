---
doc_type: case
id: CASE-015
component: users
date: 2026-02-28
tags: [visual_diff, color, status_badge, uncertain]
classification: uncertain
---

## Symptom

The "users page" Playwright test failed with a 2.3% pixel difference. All status badges (Active, Inactive, Pending) appeared in the same teal color (#14b8a6) with identical teal backgrounds (#ccfbf1). In the baseline, Active badges were green (`--color-success`, #22c55e), Inactive badges were red (`--color-error`, #ef4444), and Pending badges were amber (`--color-warning`, #f59e0b), each with their corresponding `-bg` background.

## Root Cause

A color system refactor consolidated the status colors into a single palette. The PR was titled "Unify status color tokens" and described a planned migration to a new color system. The `--color-success`, `--color-warning`, and `--color-error` tokens in `globals.css` were not modified, but the badge component was refactored to use a new `--color-status` token (#14b8a6) for all statuses. The intent was to move toward a more neutral status indication, but the implementation removed semantic color differentiation that users relied on.

## Investigation

Following RUNBOOK-008 and RUNBOOK-002, we inspected the badge elements and found all three used `color: #14b8a6` and `background-color: #ccfbf1`. Checking `globals.css` confirmed `--color-success`, `--color-warning`, and `--color-error` were unchanged. The issue was in the badge component code, which now referenced a new `--color-status` variable instead of the semantic tokens. The PR description mentioned a "planned color refactor" but did not explicitly state that all badges would become the same color.

## Resolution

Classified as **uncertain**. The color refactor was planned and appeared in the PR, but the loss of semantic color differentiation was a significant UX regression that may not have been intended. Active/Inactive/Pending statuses losing their visual distinction makes the users table harder to scan. The UX team was consulted: they confirmed that some color unification was planned but that status badges should retain semantic colors. The badge component was updated to use the original semantic tokens while the broader color refactor continued in other areas.

## Lessons Learned

Planned refactors can have unintended scope creep. A color system migration might be intentional at the token level but break semantic meaning at the component level. When status indicators (success/warning/error) lose their color differentiation, it is always worth escalating regardless of whether a color refactor was planned. The distinction between "the change was planned" and "this specific outcome was intended" is critical for uncertain classifications. See RUNBOOK-002 for color debugging and RUNBOOK-008 for table-specific issues.
