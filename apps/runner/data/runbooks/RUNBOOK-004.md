---
doc_type: runbook
id: RUNBOOK-004
component: global
date: 2025-12-10
tags: [shadow, border_radius, border, debugging]
title: Debugging border, radius, and shadow diffs
---

## When to Use

Use this runbook when visual diffs show changes to element edges: rounder or sharper corners, borders appearing or disappearing, or shadow intensity/spread changing. These diffs typically appear as subtle changes at the edges of card-like components and can be easy to miss in quick comparisons. Look for this pattern when the diff percentage is low (under 3%) but concentrated at element boundaries.

## Checklist

1. Zoom into the diff regions and focus on element edges, corners, and the area just below/around cards.
2. Inspect `border-radius`, `border`, and `box-shadow` computed values on the affected elements.
3. Search git diff for changes to: `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-full`, `--shadow-sm`, `--shadow-md`, `--shadow-lg`, `--color-border`, `--color-border-input`.
4. Check known change documents (CHANGE-003 for card style refresh) for planned radius or shadow updates.
5. Verify whether the border change affects functional elements (e.g., input field borders that indicate focus state).
6. Check if Tailwind's reset stylesheet might have changed border defaults.

## Common Causes

Design refresh initiatives often update `--radius-md` and `--shadow-md` together (see CHANGE-003). Accidental border loss commonly occurs when Tailwind CSS upgrades change default border styles or when CSS custom property fallbacks are removed. Shadow regressions can happen when a parent element gains `overflow: hidden`, clipping child shadows. Border-radius set to 0 can indicate an accidental reset or an intentional "flat design" change.

## CSS Properties to Inspect

Border radius: `--radius-sm` (4px), `--radius-md` (8px), `--radius-lg` (12px), `--radius-full` (9999px). Shadows: `--shadow-sm` (0 1px 2px rgba(0,0,0,0.05)), `--shadow-md` (0 4px 6px -1px rgba(0,0,0,0.1)), `--shadow-lg` (0 10px 15px -3px rgba(0,0,0,0.1)). Borders: `--color-border` (#e2e8f0), `--color-border-input` (#cbd5e1). Also check for `border: none` or `border: 0` overrides and `overflow: hidden` on parent elements.

## Escalation Criteria

Classify as "expected" if the radius/shadow change matches CHANGE-003 or another known change. Classify as "unexpected" if borders vanished with no planned change (common Tailwind upgrade issue). Escalate as "uncertain" if a value like `--radius-md: 0` appears in the PR diff but it is unclear whether it was intentional or an accidental artifact.
