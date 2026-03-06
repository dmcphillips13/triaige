---
doc_type: case
id: CASE-010
component: settings
date: 2026-02-05
tags: [visual_diff, color, form, button, regression]
classification: unexpected
---

## Symptom

The "settings page" Playwright test failed with a 2.7% pixel difference. The primary "Save" button was nearly unreadable: its background color had changed from the expected blue (`--color-accent`, #3b82f6) to a very light pastel blue (#bfdbfe). White button text on the light pastel background had extremely poor contrast. All other settings form elements (inputs, labels, layout) appeared normal.

## Root Cause

An unrelated PR that updated the marketing landing page accidentally modified `--color-accent` in `globals.css`. The developer was experimenting with lighter accent colors for the landing page and committed the change to the shared `globals.css` instead of scoping it to the landing page component. The value changed from `#3b82f6` to `#bfdbfe`, reducing the contrast ratio of white text on the accent background from 4.6:1 to 1.5:1.

## Investigation

Following RUNBOOK-009 and RUNBOOK-002, we inspected the Save button and found `background-color` computed to `#bfdbfe`. Checking `globals.css` confirmed `--color-accent` had changed. The git log showed the change was introduced in a PR titled "Update landing page hero section." The PR diff showed the `--color-accent` modification as an incidental change alongside landing page component edits. No known change documents described an accent color update. The contrast ratio of 1.5:1 was a critical accessibility violation.

## Resolution

Classified as **unexpected**. The fix was to revert `--color-accent` to `#3b82f6` in `globals.css` and scope the landing page's lighter color to a component-level CSS variable. A CODEOWNERS rule was added for `globals.css` requiring design system team review for any changes. The visual test baselines were not updated since the fix restored the original appearance.

## Lessons Learned

CSS custom properties in `globals.css` are global by definition. Changes to `--color-accent` affect every component that uses the accent color, not just the component being worked on. Establish CODEOWNERS or review gates for design token files. When a single CSS property change breaks an unrelated component, it is a strong signal that the change was not properly scoped. See RUNBOOK-002 for color debugging and RUNBOOK-009 for settings form specifics.
