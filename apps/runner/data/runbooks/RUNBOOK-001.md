---
doc_type: runbook
id: RUNBOOK-001
component: global
date: 2025-11-15
tags: [spacing, layout, debugging]
title: Debugging spacing and gap regressions
---

## When to Use

Use this runbook when visual regression diffs show elements that have shifted position, gained or lost whitespace, or changed their padding or margins. Common symptoms include components that appear more cramped or more spread out than the baseline, content that has reflowed to a new line, or grid/flex gaps that look wider or narrower. This runbook is the starting point for any diff that looks like a "spacing issue."

## Checklist

1. Compare the baseline and current screenshots side-by-side, focusing on whitespace regions between elements.
2. Open DevTools and inspect the elements near the diff region. Check computed padding, margin, and gap values.
3. Search the git diff for changes to spacing-related CSS custom properties: `--spacing-unit`, `--spacing-xs`, `--spacing-sm`, `--spacing-md`, `--spacing-lg`, `--spacing-xl`, `--spacing-2xl`.
4. Check if any known change documents (CHANGE-001 in particular) describe a planned spacing update.
5. Verify whether the spacing change is isolated to one component or affects the entire application.
6. If the change is global, confirm the `--spacing-unit` base value in `globals.css` and recalculate all derived values.
7. Check for Tailwind config changes that might override or conflict with CSS custom property spacing.

## Common Causes

The most frequent cause of spacing regressions is an unintended modification to `--spacing-unit` or one of its derived tokens during a refactor. Tailwind CSS upgrades can reset custom property fallback values, causing spacing to revert to browser defaults. Merge conflicts in `globals.css` sometimes silently drop spacing declarations. Component-level style overrides using hard-coded pixel values can also conflict with token-based spacing when the tokens change.

## CSS Properties to Inspect

Focus on these properties: `--spacing-unit` (base: `4px`), `--spacing-xs` (1x = `4px`), `--spacing-sm` (2x = `8px`), `--spacing-md` (4x = `16px`), `--spacing-lg` (6x = `24px`), `--spacing-xl` (8x = `32px`), `--spacing-2xl` (12x = `48px`). Also check `gap`, `padding`, and `margin` computed values on affected elements. Look for any hard-coded pixel values that should be using tokens.

## Escalation Criteria

Classify as "expected" if the spacing change matches a known change document like CHANGE-001. Classify as "unexpected" if no planned change explains the difference. Escalate as "uncertain" if the spacing change was partially planned but has side effects beyond the intended scope, such as causing content reflow or overlapping elements that weren't anticipated.
