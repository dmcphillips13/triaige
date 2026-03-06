---
doc_type: runbook
id: RUNBOOK-007
component: overview
date: 2026-01-05
tags: [kpi_card, flex_layout, debugging]
title: Debugging KPI card grid issues
---

## When to Use

Use this runbook when visual diffs affect the KPI cards on the overview page. Symptoms include cards wrapping to a new row, cards changing size, card content (values, labels, trend arrows) appearing different, or gaps between cards changing. The "overview page" Playwright test is the primary test for this component. KPI cards are arranged in a flex or grid layout and are sensitive to spacing and width changes.

## Checklist

1. Compare the overview page baseline and current screenshots, focusing on the KPI card grid area.
2. Count the number of cards per row in both versions to detect reflow.
3. Inspect card container for `display`, `flex-wrap`, `gap`, and `grid-template-columns` values.
4. Check if `--spacing-lg` (24px) changed, as it is used for card grid gaps.
5. Inspect individual card dimensions and verify they use `--radius-md` and `--shadow-md`.
6. Check known changes: CHANGE-001 (spacing) and CHANGE-003 (card style refresh).
7. If trend arrows changed color, cross-reference RUNBOOK-002 and check `--color-success` and `--color-error` values.

## Common Causes

KPI card reflow is most commonly caused by increased gap values when `--spacing-lg` grows (see CHANGE-001, from 24px to 30px). Card style changes from `--radius-md` or `--shadow-md` updates affect visual appearance without layout (see CHANGE-003). Accidental causes include JS refactors that swap color variable references for trend arrows (e.g., using `--color-success` instead of `--color-error`), viewport width changes in test configuration, and flex-basis/width changes on card elements.

## CSS Properties to Inspect

Card layout: `gap` (typically `--spacing-lg`, 24px), `display: flex` or `display: grid`, `flex-wrap`, `grid-template-columns`. Card style: `--radius-md` (8px), `--shadow-md`, `--color-bg-card` (#ffffff), `--color-border` (#e2e8f0). Card content: `--font-size-2xl` (24px) for KPI values, `--font-size-sm` (14px) for labels, `--color-success` (#22c55e) and `--color-error` (#ef4444) for trend indicators.

## Escalation Criteria

Classify as "expected" if card layout changes match CHANGE-001 (spacing) or CHANGE-003 (style refresh). Classify as "unexpected" if trend arrows show wrong colors or cards collapsed to fewer columns without a spacing change. Escalate as "uncertain" if a planned spacing change caused card reflow that was not anticipated in the change document.
