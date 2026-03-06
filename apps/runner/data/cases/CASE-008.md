---
doc_type: case
id: CASE-008
component: overview
date: 2026-01-18
tags: [visual_diff, color, kpi_card, bug]
classification: unexpected
---

## Symptom

The "overview page" Playwright test failed with a 1.4% pixel difference. All KPI card trend arrows appeared green (success color) regardless of whether the metric was trending up or down. In the baseline, downward-trending metrics showed red arrows using `--color-error` (#ef4444), but in the current version all arrows used `--color-success` (#22c55e). Card layout, values, and labels were unchanged.

## Root Cause

A JavaScript refactor of the KPI card component swapped the color variable references. The developer renamed internal variables for clarity and accidentally mapped both the "positive trend" and "negative trend" cases to `--color-success`. The ternary expression `trend > 0 ? successColor : errorColor` was refactored into a lookup object, but both keys pointed to `var(--color-success)` instead of using `var(--color-error)` for the negative case.

## Investigation

Following RUNBOOK-007 and RUNBOOK-002, we first confirmed the color values: all arrows rendered as #22c55e. Checking `globals.css` showed `--color-success` and `--color-error` were unchanged. This ruled out a CSS-level issue. We then inspected the KPI card component source code and found the refactored color lookup object. The git diff showed the introduction of a `trendColors` map where both `up` and `down` keys referenced the success color token.

## Resolution

Classified as **unexpected**. The fix was to correct the `trendColors` map to use `var(--color-error)` for the `down` key. A unit test was added to verify that negative trends use the error color token. The visual test baseline remained unchanged since the fix restored the correct behavior matching the original baseline.

## Lessons Learned

Color regressions are not always caused by CSS changes. JavaScript logic that maps data values to color tokens can introduce color bugs during refactoring. When all instances of a conditional color show the same value, suspect a code-level mapping error rather than a CSS token change. Cross-reference RUNBOOK-002 for the color diagnostic flow, but extend it to check component logic when CSS values are correct.
