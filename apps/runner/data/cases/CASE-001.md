---
doc_type: case
id: CASE-001
component: sidebar
date: 2025-10-15
tags: [visual_diff, spacing, sidebar]
classification: expected
---

## Symptom

The "sidebar component" Playwright test failed with a 1.8% pixel difference. Navigation items appeared shifted approximately 8px to the right compared to the baseline. The spacing between nav items also increased slightly. The sidebar background color and text colors were unchanged. No other page tests were affected beyond the sidebar region.

## Root Cause

The design team updated `--spacing-xs` indirectly by changing `--spacing-unit` from `4px` to `5px` in `globals.css`. Since `--spacing-xs` is calculated as `calc(var(--spacing-unit) * 1)`, it changed from 4px to 5px. The sidebar nav items use `--spacing-xs` for their left padding icon gap, and `--spacing-sm` (now 10px instead of 8px) for vertical padding between items. This was part of the planned spacing rollout documented in CHANGE-001.

## Investigation

Following RUNBOOK-001, we first compared the baseline and current sidebar screenshots side by side. The diff overlay showed uniform rightward shift of all nav item text. Inspecting DevTools confirmed padding-left on nav items changed from 4px to 5px. We then checked the git diff and found the `--spacing-unit` change in `globals.css`. Cross-referencing CHANGE-001 confirmed this was a planned update. We verified no other CSS properties were modified.

## Resolution

Classified as **expected**. The visual difference directly matched the planned `--spacing-unit` change documented in CHANGE-001. The baseline screenshots were updated to reflect the new spacing values. No code fix was needed since the change was intentional. The updated baselines were committed alongside the spacing change in the same PR.

## Lessons Learned

Spacing unit changes affect many components simultaneously. When reviewing CHANGE-001 type updates, expect all pages to show small diffs. It is helpful to run all visual tests before and after the change to catalog the full impact. Sidebar nav items are particularly sensitive to horizontal spacing changes because the narrow column makes even 1px shifts visually noticeable.
