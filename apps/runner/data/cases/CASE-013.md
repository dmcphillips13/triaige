---
doc_type: case
id: CASE-013
component: global
date: 2026-02-22
tags: [visual_diff, font, typography, uncertain]
classification: uncertain
---

## Symptom

Multiple Playwright tests failed: "overview page" at 2.1%, "users page" at 1.8%, "settings page" at 1.5%, and "reports page" at 1.6% pixel difference. All text across the application appeared to have shifted vertically by approximately 1-2px. Status badges on the users page had text that no longer vertically centered within the badge container. The font shapes looked slightly different but sizes appeared the same.

## Root Cause

The `font-family` declaration in the body rule of `globals.css` was changed from `Arial, Helvetica, sans-serif` to `"Inter", Arial, Helvetica, sans-serif`. The Inter font was added as part of an intentional typography refresh. The font change was in the PR and was approved by the design team. However, Inter has slightly different ascender/descender metrics than Arial, causing a global vertical text shift. This shift broke the badge alignment, which relied on pixel-precise vertical centering.

## Investigation

Following RUNBOOK-003, we compared text rendering closely and confirmed character shapes were different (Inter vs. Arial). The git diff showed the `font-family` change and the addition of Inter font files. The PR description mentioned the typography refresh as an intentional change. However, the badge alignment issue was not mentioned in the PR or in any known change documents. We measured badge text offset: text was 1.5px higher than center in the new version.

## Resolution

Classified as **uncertain**. The font-family change was intentional and documented in the PR, but the badge alignment side effect was not anticipated. The team needed to decide whether to accept the badge misalignment as-is, fix badge CSS to accommodate Inter's metrics, or revert the font change entirely. This was escalated to the design team for a decision. The badge alignment was ultimately fixed with an adjusted `line-height` and `padding` on badge elements.

## Lessons Learned

Font-family changes have unpredictable side effects because different fonts have different metrics even at the same font-size. A change can be intentional at the macro level (new typeface) but create unexpected micro-level issues (badge alignment). When a font change is planned, run visual tests and specifically check inline elements with tight vertical constraints like badges, pills, and icon-text pairs. See RUNBOOK-003 for typography debugging guidance.
