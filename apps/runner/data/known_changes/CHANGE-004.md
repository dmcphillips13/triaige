---
doc_type: known_change
id: CHANGE-004
component: header
date: 2026-02-20
tags: [layout, header, planned]
title: Header redesign with taller height and subtitle
---

## Change Description

The header is being redesigned to accommodate a new subtitle line showing the current section context. The `--header-height` property changes from `64px` to `80px` to provide room for the additional text. The header retains its `--color-bg-header` (#ffffff) background and `--color-text-header` (#0f172a) text color. A secondary text line using `--font-size-sm` (14px) and `--color-text-secondary` (#64748b) is added below the page title.

## Affected Components

The header component spans the full width above the main content area on every page. The main content area will shift down by 16px to accommodate the taller header. All full-page screenshots will show the content pushed down slightly. The sidebar height is unaffected since it uses viewport height. Only the header itself and the main content vertical position change.

## Expected Diffs

The "header" region of all page tests will show significant differences due to the height change. Full-page tests will show approximately 2.8% pixel difference, with the header region accounting for most of it. The diff will show the header expanding from 64px to 80px tall, a new subtitle text line appearing, and all main content shifted down by 16px. No width, color, or sidebar changes should be visible.

## Verification

Check that `--header-height` in `globals.css` changed from `64px` to `80px`. Measure the rendered header element height in DevTools to confirm it is 80px. Verify the subtitle text appears with the correct font size (`--font-size-sm`, 14px) and color (`--color-text-secondary`, #64748b). Confirm main content top offset shifted by exactly 16px and no horizontal layout changes occurred.
