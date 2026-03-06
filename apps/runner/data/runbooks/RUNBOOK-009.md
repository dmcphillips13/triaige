---
doc_type: runbook
id: RUNBOOK-009
component: settings
date: 2026-01-15
tags: [form, input, debugging]
title: Debugging settings form issues
---

## When to Use

Use this runbook when visual diffs affect the settings page, which contains form inputs, labels, select dropdowns, toggle switches, and action buttons (Save, Cancel). Symptoms include input field styling changes (border, background, radius), button color changes, label text differences, or form layout shifts. The "settings page" Playwright test captures the complete form layout.

## Checklist

1. Compare the settings page baseline and current screenshots, checking all form elements.
2. Inspect input fields for `border`, `border-radius`, `background-color`, and `padding` values.
3. Check `--color-border-input` (#cbd5e1), `--color-bg-input` (#ffffff), and `--radius-md` (8px) on inputs.
4. Inspect button elements for `background-color` using `--color-accent` (#3b82f6) and text contrast.
5. Check form labels for font size using `--font-size-sm` (14px) and color using `--color-text-primary`.
6. Verify form spacing uses `--spacing-lg` (24px) for field groups and `--spacing-md` (16px) for label-to-input gaps.
7. Cross-reference RUNBOOK-004 if border-radius looks different and RUNBOOK-002 if colors changed.

## Common Causes

Button readability issues occur when `--color-accent` is changed as a side effect of an unrelated PR, making the button text unreadable against the new background. Input border-radius changes cascade from `--radius-md` updates (see CHANGE-003). Input borders can vanish from the same Tailwind upgrade issue that affects table borders. Form spacing changes cascade from `--spacing-unit` updates (see CHANGE-001). A `--radius-md: 0` value makes all inputs appear square, which may or may not be intentional.

## CSS Properties to Inspect

Inputs: `--color-bg-input` (#ffffff), `--color-border-input` (#cbd5e1), `--radius-md` (8px) for border-radius, `--spacing-sm` (8px) for internal padding. Buttons: `--color-accent` (#3b82f6) for primary button background, `--color-accent-hover` (#2563eb) for hover state. Labels: `--font-size-sm` (14px), `--color-text-primary` (#0f172a). Layout: `--spacing-lg` (24px) for field group gaps, `--spacing-md` (16px) for label spacing.

## Escalation Criteria

Classify as "expected" if form changes match known changes for spacing (CHANGE-001) or card style (CHANGE-003) updates. Classify as "unexpected" if button colors changed without a planned accent color update, especially if text becomes unreadable. Escalate as "uncertain" if `--radius-md` was set to 0 in a PR diff but it is unclear whether the designer intended flat inputs.
