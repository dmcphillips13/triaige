---
doc_type: runbook
id: RUNBOOK-008
component: users
date: 2026-01-10
tags: [data_table, debugging]
title: Debugging data table issues
---

## When to Use

Use this runbook when visual diffs affect the users page data table. Symptoms include table row borders appearing or disappearing, header text size changes, column width shifts, status badge color changes, or row spacing differences. The "users page" Playwright test captures the full table layout including headers, rows, and pagination controls.

## Checklist

1. Compare the users page baseline and current screenshots, focusing on the table structure.
2. Check table header cells for font size changes (should use `--font-size-xs`, 12px).
3. Inspect row borders for `border-bottom` using `--color-border` (#e2e8f0).
4. Check row padding values against `--spacing-md` (16px) and `--spacing-sm` (8px).
5. Inspect status badge colors: should use `--color-success`, `--color-warning`, `--color-error` and their `-bg` variants.
6. Check known changes: CHANGE-005 (font size bump) for table header text changes.
7. If borders vanished, check for Tailwind CSS upgrade side effects (see RUNBOOK-004).

## Common Causes

Table header text changes are typically from `--font-size-xs` updates (see CHANGE-005, 12px to 13px). Row border disappearance is a common Tailwind upgrade issue where CSS custom property fallbacks are stripped, causing `border-color` to fall back to transparent. Status badge color confusion happens when JS refactors reference the wrong color token. Row spacing changes cascade from `--spacing-unit` updates (see CHANGE-001).

## CSS Properties to Inspect

Typography: `--font-size-xs` (12px) for headers, `--font-size-sm` (14px) for cell text. Borders: `--color-border` (#e2e8f0) for row separators, `border-bottom-width`. Spacing: `--spacing-md` (16px) for cell padding, `--spacing-sm` (8px) for compact cells. Status badges: `--color-success` (#22c55e), `--color-success-bg` (#dcfce7), `--color-warning` (#f59e0b), `--color-warning-bg` (#fef3c7), `--color-error` (#ef4444), `--color-error-bg` (#fee2e2), `--radius-full` (9999px) for badge shape.

## Escalation Criteria

Classify as "expected" if table changes match CHANGE-005 (font size) or CHANGE-001 (spacing). Classify as "unexpected" if row borders vanished or status badges show incorrect colors. Escalate as "uncertain" if a planned font change caused column widths to shift, potentially breaking the table layout in ways not anticipated by the change document.
