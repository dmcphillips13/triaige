---
doc_type: known_change
id: CHANGE-002
component: sidebar
date: 2026-02-01
tags: [color, sidebar, rebrand, planned]
title: Sidebar rebrand slate to navy
---

## Change Description

As part of the Q1 rebrand initiative, the sidebar background is changing from slate (`#1e293b`) to navy (`#1e3a5f`). The property `--color-bg-sidebar` is the only value being updated. Sidebar text colors (`--color-text-sidebar` and `--color-text-sidebar-active`) remain unchanged because the navy value maintains sufficient contrast ratios with the existing light text. This change was signed off by both design and accessibility teams.

## Affected Components

The sidebar component is the only directly affected element. It appears on all four pages (overview, users, settings, reports) as a fixed left-side navigation panel that is `--sidebar-width` (240px) wide. The active navigation item highlight will also appear slightly different against the navy background, though the highlight color itself is not changing. No other components reference `--color-bg-sidebar`.

## Expected Diffs

The "sidebar component" visual test will show approximately 4.2% pixel difference concentrated in the 240px-wide left column. All four full-page screenshots will show similar differences in the sidebar region. The diff should be uniform across the entire sidebar area with no layout shifts, text changes, or spacing differences. The color change should appear as a subtle shift from cool grey-blue to a deeper blue tone.

## Verification

Inspect `globals.css` and confirm only `--color-bg-sidebar` changed from `#1e293b` to `#1e3a5f`. Use a color picker on the rendered sidebar to verify the new value. Confirm that text contrast ratio against the new background still meets WCAG AA (minimum 4.5:1 for normal text). Check that no layout properties shifted by overlaying before/after screenshots and confirming the diff is limited to the sidebar background region.
