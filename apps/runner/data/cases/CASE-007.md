---
doc_type: case
id: CASE-007
component: header
date: 2026-01-05
tags: [visual_diff, color, header, regression]
classification: unexpected
---

## Symptom

The "overview page" and all other full-page Playwright tests failed with approximately 5.6% pixel difference. The header appeared transparent, with main content showing through the header region. Page title text was still visible but now overlapped with the content below. The sidebar and all non-header regions looked identical to the baseline.

## Root Cause

A merge conflict in `globals.css` was resolved incorrectly. The conflict markers were removed, but the `--color-bg-header: #ffffff;` line was silently deleted in the resolution. Without this property, the header background fell back to `transparent` (the CSS default for background-color). The merge was part of an unrelated PR that touched spacing values nearby in the file.

## Investigation

Following RUNBOOK-006, we inspected the header element and found `background-color` computed to `rgba(0, 0, 0, 0)` (transparent). Checking `globals.css` confirmed the `--color-bg-header` declaration was missing entirely. The git log showed a merge commit that resolved conflicts in `globals.css`. Diffing the merge commit against both parent commits revealed the deleted line. No known change documents described a header color change, and no PR description mentioned making the header transparent.

## Resolution

Classified as **unexpected**. This was a regression caused by a bad merge conflict resolution. The fix was to restore `--color-bg-header: #ffffff;` to the `:root` block in `globals.css`. A regression test was added to verify the header has an opaque background. The team adopted a practice of running visual tests after merge conflict resolutions to catch silent deletions.

## Lessons Learned

Merge conflicts in `globals.css` are dangerous because silently deleted CSS custom properties do not cause build errors or runtime errors. The property simply becomes undefined and the styling falls back to browser defaults. A transparent header is particularly severe because it breaks visual hierarchy. Always diff `globals.css` carefully after merge conflict resolution and verify every CSS custom property is still present. See RUNBOOK-006 for the full header diagnostic checklist.
