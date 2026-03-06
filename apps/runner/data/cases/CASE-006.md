---
doc_type: case
id: CASE-006
component: sidebar
date: 2025-12-20
tags: [visual_diff, color, sidebar, rebrand]
classification: expected
---

## Symptom

The "sidebar component" Playwright test failed with a 4.2% pixel difference. The sidebar background appeared as a deeper blue tone compared to the baseline grey-blue. The diff was uniform across the entire 240px-wide sidebar region. Navigation item text, active state highlighting, and sidebar layout were all unchanged. All four full-page tests showed similar diffs localized to the sidebar area.

## Root Cause

The `--color-bg-sidebar` CSS custom property was changed from `#1e293b` (slate) to `#1e3a5f` (navy) in `globals.css`. This was part of the Q1 rebrand initiative documented in CHANGE-002. The text colors `--color-text-sidebar` (#cbd5e1) and `--color-text-sidebar-active` (#ffffff) were not changed, as the navy background maintains sufficient contrast.

## Investigation

Following RUNBOOK-005, we sampled the sidebar background color using a color picker and confirmed it was `#1e3a5f` instead of the baseline `#1e293b`. The git diff showed only `--color-bg-sidebar` changed in `globals.css`. Cross-referencing CHANGE-002 confirmed the planned rebrand. We checked text contrast ratios: `#cbd5e1` on `#1e3a5f` yields 7.8:1, well above the WCAG AA minimum of 4.5:1. No other color properties were modified.

## Resolution

Classified as **expected**. The color change exactly matched CHANGE-002. Baselines were updated for the sidebar test and all four full-page tests. The accessibility team confirmed the contrast ratios remained compliant. The baseline updates were committed with a reference to the rebrand initiative.

## Lessons Learned

Sidebar color changes produce high pixel diff percentages (4.2%) because the sidebar occupies a large, uniformly-colored region. Despite the high percentage, this is a simple single-property change. When triaging sidebar color diffs, check CHANGE-002 first. A uniform diff across the entire sidebar area is the signature of a background color token change, as opposed to a layout issue which would show irregular diff patterns.
