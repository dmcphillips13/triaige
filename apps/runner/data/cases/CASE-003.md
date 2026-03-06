---
doc_type: case
id: CASE-003
component: overview
date: 2025-11-10
tags: [visual_diff, spacing, layout, kpi_card]
classification: expected
---

## Symptom

The "overview page" Playwright test failed with a 3.1% pixel difference. KPI cards that previously displayed in a single row of four had wrapped to two rows of two. The gaps between cards appeared wider. Card content (values, labels, trend arrows) was unchanged. No color or font differences were detected.

## Root Cause

The `--spacing-lg` token increased from 24px to 30px as a result of the `--spacing-unit` change from `4px` to `5px` (CHANGE-001). The KPI card grid uses `--spacing-lg` for its `gap` property. The wider gap consumed enough horizontal space that four cards no longer fit in a single row at the test viewport width (1280px), causing flex-wrap to move the last two cards to a second row.

## Investigation

Following RUNBOOK-007, we counted cards per row: baseline showed 4, current showed 2+2. Inspecting the card container confirmed `gap` computed to 30px instead of the baseline 24px. We calculated: at 1280px viewport minus 240px sidebar, the content area is 1040px. Four cards with three 30px gaps need 90px for gaps alone, leaving 950px for cards (237.5px each). The minimum card width was set to 240px, triggering the wrap. Cross-referencing CHANGE-001 confirmed the spacing update was planned.

## Resolution

Classified as **expected**. The card reflow was a known side effect of the spacing rollout in CHANGE-001. The design team confirmed that the two-row layout at 1280px was acceptable. Baselines were updated. A note was added to CHANGE-001 documenting this reflow behavior for future reference. No code fix was needed.

## Lessons Learned

Spacing changes can cause layout reflow at specific viewport breakpoints even when the pixel difference seems small (6px per gap). Always check flex-wrap and grid-template layouts when spacing tokens change. It is valuable to document component minimum widths alongside spacing tokens so that reflow thresholds can be predicted before deploying spacing changes.
