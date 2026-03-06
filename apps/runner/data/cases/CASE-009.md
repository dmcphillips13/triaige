---
doc_type: case
id: CASE-009
component: users
date: 2026-01-30
tags: [visual_diff, border, data_table, regression]
classification: unexpected
---

## Symptom

The "users page" Playwright test failed with a 1.9% pixel difference. Table row borders had completely vanished, making rows blend together without visual separation. The table header row, cell content, and status badges were unaffected. The diff showed thin horizontal lines (the former borders) disappearing across the entire table.

## Root Cause

A Tailwind CSS upgrade from v3.x to v4.x changed how CSS custom property fallback values are handled in the compiled output. Table rows used `border-bottom-color: var(--color-border)` which previously compiled with an inline fallback `var(--color-border, #e2e8f0)`. The new Tailwind version stripped the fallback values during compilation. Since the table component loaded its styles after Tailwind's reset, and the reset set `border-color: currentColor`, the effective border became invisible (matching the background color on some rows).

## Investigation

Following RUNBOOK-008 and RUNBOOK-004, we inspected table row elements and found `border-bottom-color` computed to match the row background color rather than the expected `#e2e8f0`. Checking `globals.css` confirmed `--color-border: #e2e8f0` was still present. The issue was in the compiled CSS output: diffing the build artifacts showed the fallback value was stripped. The git diff revealed the Tailwind version bump in `package.json`. No known change documents described a border modification.

## Resolution

Classified as **unexpected**. The fix was to add explicit `border-color: var(--color-border)` declarations to the table row styles rather than relying on Tailwind's compiled fallback. A CSS-level regression test was added to verify border visibility. The team documented this Tailwind v4 migration gotcha for future reference.

## Lessons Learned

Tailwind CSS major version upgrades can silently change how CSS custom property fallbacks are handled. This is a subtle issue because the CSS custom property exists in `globals.css` but the compiled styles no longer reference the fallback. Always run visual tests after dependency upgrades, especially CSS framework updates. See RUNBOOK-004 for the full border diagnostic checklist and RUNBOOK-008 for table-specific debugging.
