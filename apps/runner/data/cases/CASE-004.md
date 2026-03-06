---
doc_type: case
id: CASE-004
component: users
date: 2025-11-25
tags: [visual_diff, font, data_table]
classification: expected
---

## Symptom

The "users page" Playwright test failed with a 1.2% pixel difference. The table header row text appeared slightly larger than the baseline. The difference was most visible in longer header labels like "Last Activity" and "Status." Row content and status badges appeared unchanged. No layout shifts or spacing differences were detected.

## Root Cause

The `--font-size-xs` CSS custom property was bumped from `12px` to `13px` as part of the planned accessibility improvement documented in CHANGE-005. Table header cells use `--font-size-xs` for their text styling. The 1px increase was sufficient to be detected by pixel-level comparison but did not cause any text wrapping or column width changes.

## Investigation

Following RUNBOOK-003, we inspected the table header cells in DevTools and confirmed `font-size` computed to 13px instead of the baseline 12px. The git diff showed `--font-size-xs: 13px` in `globals.css`. Cross-referencing CHANGE-005 confirmed this was the planned accessibility font bump. We verified that column widths remained stable and no text truncation occurred. We also checked status badges, which use the same token, but the 1px change on the short badge text ("Active", "Inactive") was within the diff threshold.

## Resolution

Classified as **expected**. The font size change matched CHANGE-005 exactly. Baselines were updated for the users page test. The accessibility team confirmed the new size met their readability requirements. We also updated baselines for the reports page, which showed a 0.8% diff in card timestamps that also use `--font-size-xs`.

## Lessons Learned

Small font size changes (even 1px) are detectable by visual regression testing, which validates the sensitivity of our test setup. When reviewing font changes, check all components that use the affected token, not just the primary target. The `--font-size-xs` token is used in table headers, badges, timestamps, and sidebar labels, so a single change has broad but subtle impact.
