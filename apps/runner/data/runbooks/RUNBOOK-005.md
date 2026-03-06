---
doc_type: runbook
id: RUNBOOK-005
component: sidebar
date: 2025-12-15
tags: [sidebar, navigation, debugging]
title: Debugging sidebar-specific issues
---

## When to Use

Use this runbook when visual diffs are concentrated in the sidebar region (the left 240px column). Symptoms include navigation items shifting up/down, sidebar background color changes, active state highlighting differences, section label misalignment, or the sidebar width itself changing. The "sidebar component" Playwright test is the primary test that catches these issues.

## Checklist

1. Compare the sidebar region between baseline and current screenshots, checking nav item positions and colors.
2. Inspect the sidebar container element for changes in `width`, `background-color`, and `padding`.
3. Check `--sidebar-width` (240px) and `--color-bg-sidebar` (#1e293b) in `globals.css`.
4. Look for changes to `--color-text-sidebar` (#cbd5e1) and `--color-text-sidebar-active` (#ffffff).
5. Check known change documents (CHANGE-002 for sidebar rebrand) for planned sidebar updates.
6. Verify sidebar link spacing uses `--spacing-xs` and `--spacing-sm` tokens, cross-referencing RUNBOOK-001 if spacing is off.
7. Check for navigation item ordering changes that might indicate a router/config change rather than a CSS issue.

## Common Causes

Planned rebrands commonly change `--color-bg-sidebar` (see CHANGE-002 for slate-to-navy). Spacing changes to `--spacing-unit` (see CHANGE-001) affect nav item padding. Accidental causes include merge conflicts modifying `--sidebar-width` (shifting all main content), router changes reordering navigation items, and font changes affecting section labels that use `--font-size-xs`. Width changes are particularly impactful as they shift all main content horizontally.

## CSS Properties to Inspect

Layout: `--sidebar-width` (240px). Colors: `--color-bg-sidebar` (#1e293b), `--color-text-sidebar` (#cbd5e1), `--color-text-sidebar-active` (#ffffff). Spacing: `--spacing-xs` (4px) for icon gaps, `--spacing-sm` (8px) for item padding, `--spacing-md` (16px) for section margins. Typography: `--font-size-xs` (12px) for section labels, `--font-size-sm` (14px) for nav item text.

## Escalation Criteria

Classify as "expected" if the sidebar diff matches CHANGE-002 (rebrand) or CHANGE-001 (spacing update). Classify as "unexpected" if `--sidebar-width` changed without a planned update, as this affects the entire page layout. Escalate as "uncertain" if a sidebar color change was planned but navigation item order also shifted, suggesting a code change beyond just CSS.
