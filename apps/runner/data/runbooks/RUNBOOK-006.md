---
doc_type: runbook
id: RUNBOOK-006
component: header
date: 2025-12-20
tags: [header, layout, debugging]
title: Debugging header-specific issues
---

## When to Use

Use this runbook when visual diffs are concentrated in the header region (the top bar spanning the width above the main content). Symptoms include the header growing or shrinking in height, background color changes, title text appearing different, or new elements appearing in the header. The header affects all page tests since it is present on every page.

## Checklist

1. Compare the header region between baseline and current, checking height, background, and text content.
2. Inspect the header element for changes in `height`, `background-color`, `padding`, and text styling.
3. Check `--header-height` (64px) and `--color-bg-header` (#ffffff) in `globals.css`.
4. Verify `--color-text-header` (#0f172a) for title text color.
5. Check known change documents (CHANGE-004 for header redesign) for planned header updates.
6. If the header height changed, verify that main content shifted vertically by the same amount.
7. Check for z-index issues if the header overlaps content or if content appears behind it.

## Common Causes

Planned redesigns may increase `--header-height` to accommodate new elements like subtitles (see CHANGE-004, 64px to 80px). Accidental causes include merge conflicts silently deleting the `--color-bg-header` declaration (making the header transparent), padding changes cascading from `--spacing-unit` updates, and font size changes affecting header title text height. A transparent header is a critical bug since content will show through.

## CSS Properties to Inspect

Layout: `--header-height` (64px). Colors: `--color-bg-header` (#ffffff), `--color-text-header` (#0f172a), `--color-text-secondary` (#64748b) for subtitles. Spacing: `--spacing-md` (16px) for header padding, `--spacing-sm` (8px) for element gaps. Typography: `--font-size-xl` (20px) for page titles, `--font-size-sm` (14px) for subtitles. Also check `position`, `z-index`, and `border-bottom` using `--color-border` (#e2e8f0).

## Escalation Criteria

Classify as "expected" if the header change matches CHANGE-004. Classify as "unexpected" if the header background became transparent or the height changed without a planned update. Header background disappearing is a high-severity regression since it breaks visual hierarchy. Escalate as "uncertain" if the header height changed as expected but content reflow below it caused unexpected layout differences.
