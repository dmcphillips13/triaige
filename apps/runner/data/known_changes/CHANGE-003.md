---
doc_type: known_change
id: CHANGE-003
component: overview
date: 2026-02-10
tags: [border_radius, shadow, kpi_card, planned]
title: Card style refresh for radius and shadow
---

## Change Description

The design system is updating card styles to feel more modern and elevated. Two properties are changing: `--radius-md` moves from `8px` to `12px` and `--shadow-md` changes from `0 4px 6px -1px rgba(0, 0, 0, 0.1)` to `0 6px 12px -2px rgba(0, 0, 0, 0.12)`. These updates give cards softer corners and a more prominent floating effect. The change was part of the "Design Refresh Q1" initiative tracked in the design system changelog.

## Affected Components

KPI cards on the overview page use both `--radius-md` and `--shadow-md` and will be the most visually impacted. Report cards on the reports page also use these tokens and will show similar changes. The settings form container and the users table wrapper both use `--radius-md` for their border radius, so they will also show rounder corners. Any card-like component using these tokens will be affected.

## Expected Diffs

The "overview page" test will show approximately 1.9% pixel difference, concentrated at card edges and shadow regions. The "reports page" test will show roughly 2.1% difference. The difference will be most visible at the corners of card elements where the radius increase from 8px to 12px is apparent. Shadow regions below cards will appear slightly larger and more diffuse. No text, color, or spacing changes should be present.

## Verification

Confirm that only `--radius-md` and `--shadow-md` were modified in `globals.css`. Inspect card elements in DevTools to verify computed border-radius is 12px and the box-shadow matches the new value. Overlay before/after screenshots and confirm differences are limited to card edges and shadow areas. Interior card content (text, icons, values) should be pixel-identical.
