---
doc_type: known_change
id: CHANGE-001
component: global
date: 2026-01-15
tags: [spacing, design_system, planned]
title: Spacing unit 4px to 5px rollout
---

## Change Description

The base `--spacing-unit` CSS custom property is being updated from `4px` to `5px` across the entire application. This change was approved by the design team to improve visual breathing room and align our spacing scale with the updated brand guidelines. All derived spacing tokens (`--spacing-xs`, `--spacing-sm`, `--spacing-md`, `--spacing-lg`, `--spacing-xl`, `--spacing-2xl`) will scale proportionally since they use `calc()` expressions based on `--spacing-unit`.

## Affected Components

Every page and component that uses spacing tokens will show visual differences. The sidebar navigation item padding will increase from 4px to 5px for `--spacing-xs` and from 8px to 10px for `--spacing-sm`. KPI cards on the overview page will have wider gaps since they use `--spacing-lg` (changing from 24px to 30px). The users data table row padding uses `--spacing-md` (changing from 16px to 20px). Settings form field margins use `--spacing-lg`. Report cards use `--spacing-md` for internal padding and `--spacing-lg` for grid gaps.

## Expected Diffs

Visual regression tests will show pixel differences on all pages. The "overview page" test will show approximately 3.1% pixel difference due to increased card gaps and content reflow. The "sidebar component" test will show roughly 1.8% difference from padding changes. The "users page" test will show about 2.4% difference from table spacing. Expect all elements to appear slightly more spacious. No color or font changes should be visible.

## Verification

Confirm that only `--spacing-unit` was changed in `globals.css` and no other properties were modified. Measure padding and gap values in the rendered pages: `--spacing-xs` should compute to 5px, `--spacing-sm` to 10px, `--spacing-md` to 20px, `--spacing-lg` to 30px, `--spacing-xl` to 40px, and `--spacing-2xl` to 60px. All diffs should show uniform expansion of whitespace with no changes to colors, fonts, or borders.
