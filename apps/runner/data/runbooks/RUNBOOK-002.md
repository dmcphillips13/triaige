---
doc_type: runbook
id: RUNBOOK-002
component: global
date: 2025-11-20
tags: [color, theme, debugging]
title: Debugging color-related diffs
---

## When to Use

Use this runbook when visual regression diffs show color changes in any part of the UI. Symptoms include backgrounds that look different, text that changed shade, borders that are more or less visible, or status indicators (success/warning/error) displaying incorrect colors. This covers both intentional theme updates and accidental color regressions.

## Checklist

1. Identify which specific elements changed color in the diff overlay.
2. Use a color picker tool or DevTools to sample the actual rendered color values in both baseline and current.
3. Search the git diff for changes to color-related CSS custom properties: `--color-bg-*`, `--color-text-*`, `--color-border*`, `--color-accent*`, `--color-success*`, `--color-warning*`, `--color-error*`.
4. Check known change documents (CHANGE-002 for sidebar rebrand) for planned color updates.
5. Verify whether the color change is isolated to the intended components or has leaked to other areas.
6. Check for CSS specificity conflicts where a new rule might override a custom property value.
7. Verify contrast ratios for any text color changes to flag potential accessibility issues.

## Common Causes

Planned rebrands often update `--color-bg-sidebar` or `--color-accent` (see CHANGE-002). Accidental causes include merge conflicts deleting color declarations from `globals.css`, refactors that swap similar-named variables (e.g., confusing `--color-success` with `--color-error`), and Tailwind theme overrides that shadow CSS custom properties. Dark mode toggle issues can also cause unexpected color changes if theme variables are not scoped correctly.

## CSS Properties to Inspect

Background colors: `--color-bg-primary` (#ffffff), `--color-bg-secondary` (#f8f9fa), `--color-bg-sidebar` (#1e293b), `--color-bg-header` (#ffffff), `--color-bg-card` (#ffffff), `--color-bg-input` (#ffffff), `--color-bg-hover` (#f1f5f9). Text colors: `--color-text-primary` (#0f172a), `--color-text-secondary` (#64748b), `--color-text-sidebar` (#cbd5e1), `--color-text-sidebar-active` (#ffffff), `--color-text-header` (#0f172a). Status colors: `--color-success` (#22c55e), `--color-warning` (#f59e0b), `--color-error` (#ef4444). Accent: `--color-accent` (#3b82f6).

## Escalation Criteria

Classify as "expected" if the color change matches a known change document and is limited to the documented components. Classify as "unexpected" if no planned change exists, especially if status colors (success/warning/error) are affected since these carry semantic meaning. Escalate as "uncertain" if a planned color change appears to have side effects on unrelated components.
