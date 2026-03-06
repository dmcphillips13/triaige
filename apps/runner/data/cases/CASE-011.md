---
doc_type: case
id: CASE-011
component: reports
date: 2026-02-12
tags: [visual_diff, spacing, layout, grid, bug]
classification: unexpected
---

## Symptom

The "reports page" Playwright test failed with a 12.4% pixel difference. The report card grid, which normally displays three cards per row, had collapsed to a single column with all cards stacked vertically. Each card stretched to full width. Card styles (radius, shadow, content) appeared normal aside from the layout change. No other page tests were affected.

## Root Cause

An npm dependency update bumped a CSS grid polyfill package to a new major version. The new version injected a `grid-template-columns: 1fr !important` rule into its reset stylesheet, overriding the application's `grid-template-columns: repeat(auto-fill, minmax(300px, 1fr))` declaration on the report grid container. The `!important` flag made the override impossible to detect through normal specificity debugging.

## Investigation

Following RUNBOOK-010, we inspected the grid container and found `grid-template-columns` computed to `1fr` instead of the expected multi-column value. DevTools showed the value was being overridden by a rule with `!important` from an unfamiliar stylesheet. We traced the stylesheet to the updated CSS grid polyfill in `node_modules`. The `package-lock.json` diff showed the polyfill version bumped from 2.x to 3.x. No known change documents described a grid layout modification.

## Resolution

Classified as **unexpected**. The fix was to pin the CSS grid polyfill to the previous 2.x version and add the package to the "do not auto-update" list in Renovate config. A follow-up task was created to evaluate whether the polyfill was still needed for our browser support matrix. Visual test baselines were not updated since the fix restored the original grid layout.

## Lessons Learned

Dependency updates can inject CSS rules with `!important` that override application styles in ways that are invisible to normal code review. When a grid or flex layout completely collapses, check for dependency updates that might have changed CSS reset or polyfill behavior. See RUNBOOK-010 for the full report card grid diagnostic checklist. Always pin CSS-affecting dependencies and test thoroughly after major version bumps.
