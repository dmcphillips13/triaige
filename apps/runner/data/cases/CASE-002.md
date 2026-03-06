---
doc_type: case
id: CASE-002
component: header
date: 2025-10-28
tags: [visual_diff, layout, header, spacing]
classification: expected
---

## Symptom

All four full-page Playwright tests (overview page, users page, settings page, reports page) failed with approximately 2.8% pixel difference each. The diff overlay showed the header region was taller, and all main content below the header had shifted down by 16px. A new line of smaller, grey text appeared in the header below the page title.

## Root Cause

The `--header-height` CSS custom property was changed from `64px` to `80px` in `globals.css` as part of the planned header redesign. A subtitle element was added to the header component using `--font-size-sm` (14px) and `--color-text-secondary` (#64748b). This change was documented in CHANGE-004 and was part of a planned UX improvement to show contextual breadcrumb information.

## Investigation

Following RUNBOOK-006, we inspected the header element and confirmed its computed height was 80px instead of the baseline 64px. The git diff showed `--header-height: 80px` in `globals.css` and a new subtitle `<p>` element in the header component. Cross-referencing CHANGE-004 confirmed this was the planned header redesign. We verified that only the header height and the subtitle addition caused the diffs; no other CSS properties were modified.

## Resolution

Classified as **expected**. The header change precisely matched CHANGE-004. All visual test baselines were updated. The 16px vertical shift of main content was an expected consequence of the taller header. We confirmed that no content was clipped or overlapping after the height increase. The updated baselines were committed alongside the header component changes.

## Lessons Learned

Header height changes have a large blast radius because they shift all content below. When reviewing header changes, check all page tests, not just a header-specific test. The 2.8% diff across all pages was initially alarming but was entirely explained by the 16px vertical shift. Future header changes should be flagged in advance so the team expects widespread baseline updates.
