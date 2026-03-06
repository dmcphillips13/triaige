---
doc_type: case
id: CASE-014
component: settings
date: 2026-02-25
tags: [visual_diff, border_radius, form, uncertain]
classification: uncertain
---

## Symptom

The "settings page" Playwright test failed with a 1.7% pixel difference. All form input fields and the settings card container appeared completely square, with no visible border-radius. In the baseline, inputs had 8px rounded corners and the card had 8px rounded corners matching `--radius-md`. Buttons retained their rounded appearance because they use `--radius-full` for pill-shaped styling.

## Root Cause

The `--radius-md` CSS custom property was changed from `8px` to `0` in `globals.css`. The change appeared in a PR titled "Flatten card styles for embed mode." The PR description mentioned making cards square for an embeddable widget version of the dashboard, but it was unclear whether the `--radius-md: 0` value was intended to ship to the main application or was a debugging artifact left in by mistake. The PR author was on vacation and could not clarify.

## Investigation

Following RUNBOOK-004 and RUNBOOK-009, we inspected form inputs and confirmed `border-radius` computed to `0px`. Checking `globals.css` showed `--radius-md: 0`. The git diff in the PR showed this single line change among several component-level changes for the embed mode feature. The PR had been approved by one reviewer who focused on the component logic, not the global CSS change. No known change documents described making `--radius-md` zero. CHANGE-003 actually documented `--radius-md` increasing to `12px`, contradicting the current value.

## Resolution

Classified as **uncertain**. The `--radius-md: 0` value might have been intentional for the embed mode or might have been a debugging leftover. Since the PR author was unavailable and the single reviewer did not specifically approve the global CSS change, the team could not definitively classify this as expected or unexpected. The change was temporarily reverted to `8px` pending the author's return, and a task was created to implement embed-mode styles using CSS scoping rather than modifying global tokens.

## Lessons Learned

Changes to global CSS tokens should always be explicitly called out in PR descriptions, not buried among component changes. When a global token change contradicts an existing known change document (CHANGE-003 says 12px, PR sets 0), that is a strong signal something is wrong. Require explicit sign-off on `globals.css` changes. See RUNBOOK-004 for border/radius diagnostics and RUNBOOK-009 for settings form specifics.
