---
doc_type: case
id: CASE-012
component: layout
date: 2026-02-18
tags: [visual_diff, layout, sidebar_width, regression]
classification: unexpected
---

## Symptom

All four full-page Playwright tests failed with approximately 3.5% pixel difference. Main content appeared shifted 20px to the right, creating an unexpected gap between the sidebar and the content area. The sidebar itself looked normal at its expected width. The shift was uniform across all pages and affected all content to the right of the sidebar.

## Root Cause

A merge commit accidentally changed `--sidebar-width` from `240px` to `260px` in `globals.css`. The merge involved two branches that both touched the layout section of `globals.css`. The conflict resolution picked the wrong value from the incoming branch, which had been experimenting with a wider sidebar that was ultimately abandoned. The main content area used `margin-left: var(--sidebar-width)` to offset from the sidebar, causing the 20px rightward shift.

## Investigation

Following RUNBOOK-005, we inspected the sidebar and measured its rendered width at 260px. The main content area had `margin-left: 260px`. Checking `globals.css` showed `--sidebar-width: 260px`. The git log revealed a merge commit two days prior. Diffing the merge against both parents showed the value change. The PR for the incoming branch had comments indicating the wider sidebar experiment was abandoned. No known change documents described a sidebar width change.

## Resolution

Classified as **unexpected**. The fix was to restore `--sidebar-width: 240px` in `globals.css`. The team added a post-merge CI check that runs visual tests automatically when `globals.css` is modified. Visual test baselines were not updated since the fix restored the original layout.

## Lessons Learned

`--sidebar-width` is a high-impact layout token because it determines the horizontal position of all main content. Even a 20px change is immediately visible on every page. Merge conflicts involving layout tokens should be resolved with extra care. Consider adding automated validation that critical layout tokens (like `--sidebar-width` and `--header-height`) match expected values. See RUNBOOK-005 for sidebar diagnostics.
