---
doc_type: runbook
id: RUNBOOK-003
component: global
date: 2025-12-01
tags: [font, typography, debugging]
title: Debugging font and typography regressions
---

## When to Use

Use this runbook when visual diffs show text that appears larger, smaller, or in a different typeface. Symptoms include text that looks bolder or lighter, line heights that shifted causing text to reflow, font-family changes causing different character widths, or badge/label text that no longer fits its container. Any diff where the primary difference is in rendered text appearance should start here.

## Checklist

1. Compare text rendering in baseline vs. current screenshots, paying attention to character shapes and sizes.
2. Inspect computed `font-size`, `font-family`, `font-weight`, and `line-height` values on affected text elements.
3. Search git diff for changes to font tokens: `--font-size-xs`, `--font-size-sm`, `--font-size-base`, `--font-size-lg`, `--font-size-xl`, `--font-size-2xl`, `--font-size-3xl`.
4. Check known change documents (CHANGE-005 for `--font-size-xs` bump) for planned typography updates.
5. Verify whether web font loading might have changed (e.g., Geist Sans font files updated or CDN path changed).
6. Check for CSS specificity issues where font properties are being overridden by new rules.
7. Test whether the text change causes any container overflow or layout reflow.

## Common Causes

Planned accessibility updates often bump small font sizes (see CHANGE-005 for `--font-size-xs` 12px to 13px). Accidental causes include font-family fallback chain changes when a web font fails to load, font-weight shifting when a new font variant is imported, and Tailwind typography plugin updates that reset base styles. Line-height changes can also cause subtle vertical shifts that affect overall layout.

## CSS Properties to Inspect

Font sizes: `--font-size-xs` (12px), `--font-size-sm` (14px), `--font-size-base` (16px), `--font-size-lg` (18px), `--font-size-xl` (20px), `--font-size-2xl` (24px), `--font-size-3xl` (30px). Also check `font-family` (body default: Arial, Helvetica, sans-serif; theme: `var(--font-geist-sans)` and `var(--font-geist-mono)`), `font-weight`, and `line-height` computed values on affected elements.

## Escalation Criteria

Classify as "expected" if the font change matches CHANGE-005 or another known change and does not cause layout breakage. Classify as "unexpected" if no planned change explains the typography difference, especially if it causes text overflow or truncation. Escalate as "uncertain" if a planned font change has unintended layout side effects like badges that no longer fit their containers.
