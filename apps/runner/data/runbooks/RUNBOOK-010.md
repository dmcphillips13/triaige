---
doc_type: runbook
id: RUNBOOK-010
component: reports
date: 2026-01-20
tags: [report_card, grid, debugging]
title: Debugging report card grid issues
---

## When to Use

Use this runbook when visual diffs affect the reports page, which displays report cards in a CSS grid layout. Symptoms include cards collapsing to a single column, grid gaps widening or narrowing, card styles changing (radius, shadow), or card content (titles, timestamps, status indicators) appearing different. The "reports page" Playwright test captures the full grid layout.

## Checklist

1. Compare the reports page baseline and current screenshots, counting cards per row and checking layout.
2. Inspect the grid container for `display: grid`, `grid-template-columns`, and `gap` values.
3. Verify `gap` uses `--spacing-lg` (24px) and cards use `--radius-md` (8px) and `--shadow-md`.
4. Check if the grid collapsed to fewer columns by inspecting `grid-template-columns` computed value.
5. Check card metadata timestamps for font size changes against `--font-size-xs` (12px).
6. Check known changes: CHANGE-001 (spacing), CHANGE-003 (card style refresh).
7. If the grid completely collapsed to 1 column, investigate dependency updates that might affect CSS grid behavior.

## Common Causes

Grid layout collapse to a single column is a severe regression typically caused by npm dependency updates that modify CSS grid polyfill behavior or inject conflicting grid styles. Gap changes cascade from `--spacing-unit` updates (see CHANGE-001). Card style changes from `--radius-md` and `--shadow-md` updates are usually planned (see CHANGE-003). Timestamp font changes cascade from `--font-size-xs` updates (see CHANGE-005). Cards losing their shadow can indicate `overflow: hidden` on a parent element.

## CSS Properties to Inspect

Grid layout: `display: grid`, `grid-template-columns` (typically `repeat(auto-fill, minmax(300px, 1fr))`), `gap` (typically `--spacing-lg`, 24px). Card style: `--radius-md` (8px), `--shadow-md`, `--color-bg-card` (#ffffff), `--color-border` (#e2e8f0). Card content: `--font-size-base` (16px) for titles, `--font-size-xs` (12px) for timestamps, `--color-text-secondary` (#64748b) for metadata. Status: `--color-success` (#22c55e), `--color-warning` (#f59e0b), `--color-error` (#ef4444).

## Escalation Criteria

Classify as "expected" if the report card diff matches CHANGE-001 (spacing) or CHANGE-003 (card style refresh). Classify as "unexpected" if the grid collapsed to a single column or card shadows disappeared without a planned change. Escalate as "uncertain" if a planned card style refresh caused the grid to reflow in a way the change document did not anticipate.
