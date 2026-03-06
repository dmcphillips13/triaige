---
doc_type: known_change
id: CHANGE-005
component: users
date: 2026-03-01
tags: [font, data_table, planned]
title: Font size increase for accessibility
---

## Change Description

The smallest font size token `--font-size-xs` is being bumped from `12px` to `13px` to improve readability for users with visual impairments. This change was driven by an accessibility audit that flagged 12px text as difficult to read at standard viewing distances. The change only affects `--font-size-xs`; all other font size tokens remain the same. The update was approved by the accessibility team and documented in the a11y compliance tracker.

## Affected Components

The users data table is the primary affected component because table header cells and secondary metadata columns use `--font-size-xs`. Status badges in the users table also use this token for their label text. The reports page uses `--font-size-xs` for card metadata timestamps. The sidebar navigation uses `--font-size-xs` for section labels. Any component rendering text at the extra-small size will show a subtle increase.

## Expected Diffs

The "users page" test will show approximately 1.2% pixel difference, concentrated in table headers and badge text. The "reports page" test will show roughly 0.8% difference in card timestamps. The "sidebar component" test may show a very small difference (under 0.5%) in section labels. Text will appear marginally larger but should not cause layout reflow at this scale. Line heights and container sizes should remain unchanged.

## Verification

Confirm that only `--font-size-xs` changed from `12px` to `13px` in `globals.css`. Inspect table header text in DevTools and verify the computed font size is 13px. Overlay before/after screenshots of the users table header row and confirm the text is slightly larger. Verify no layout shifts occurred in table columns, since the 1px increase should not cause text to wrap or columns to resize.
