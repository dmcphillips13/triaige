---
doc_type: case
id: CASE-005
component: reports
date: 2025-12-08
tags: [visual_diff, shadow, border_radius, report_card]
classification: expected
---

## Symptom

The "reports page" Playwright test failed with a 2.1% pixel difference. Report cards appeared to have rounder corners and more prominent shadows compared to the baseline. The diff was concentrated at card edges and the shadow region below each card. Card content (titles, descriptions, timestamps) was pixel-identical to the baseline.

## Root Cause

Two CSS custom properties were updated as part of the card style refresh documented in CHANGE-003: `--radius-md` changed from `8px` to `12px` and `--shadow-md` changed from `0 4px 6px -1px rgba(0, 0, 0, 0.1)` to `0 6px 12px -2px rgba(0, 0, 0, 0.12)`. Report cards use both tokens for their border-radius and box-shadow styles.

## Investigation

Following RUNBOOK-004, we zoomed into the diff regions and confirmed changes were limited to card edges and shadow areas. DevTools inspection showed `border-radius` computed to 12px (was 8px) and `box-shadow` matched the new `--shadow-md` value. The git diff showed both property changes in `globals.css`. Cross-referencing CHANGE-003 confirmed the planned card style refresh. We verified that interior card content was unaffected by overlaying cropped screenshots of card bodies.

## Resolution

Classified as **expected**. The visual changes perfectly matched CHANGE-003. Baselines were updated for the reports page. We also checked the overview page KPI cards, which showed a similar 1.9% diff from the same radius and shadow changes. All baseline updates were committed with a reference to CHANGE-003 in the commit message.

## Lessons Learned

Border-radius and shadow changes produce diffs that are small in percentage but visually obvious to human reviewers. When triaging these, look for uniformity: if every card edge changed the same way, it is almost certainly a token update rather than a per-component bug. The combination of `--radius-md` and `--shadow-md` changing together is a strong indicator of a planned design refresh rather than an accident.
