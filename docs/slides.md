# Demo Day Presentation Plan

10-minute presentation. Mix of slides and live demo — interleaved, not sequential.

---

## Pre-work (before demo day)

- [ ] **PR #1 (pre-staged, completed):** A sample app PR that changes a CSS variable affecting multiple pages. Triage run already completed with results waiting in the dashboard. This is the walkthrough PR.
- [ ] **PR #2 (pre-staged, ready to trigger):** A second sample app PR ready to push. Trigger at the start of the talk so CI + classification runs during the slides (~2 min). The SSE moment lands around minute 7-8.
- [ ] **Dashboard open** in browser, logged in, on the runs page for the sample app repo.
- [ ] **GitHub PR page** open in a second tab for showing merge gate checks.

---

## Presentation flow

### 0:00-1:30 — Slides: Setup

**Slide 1: Hook**
- Visual: before/after screenshot diff (or a grid of 6 diffs)
- "Your CI produces 6 visual diffs. Which ones matter?"
- Frame the problem: reviewing every diff manually is tedious, most teams skip it

**Slide 2: Why now**
- AI is writing more code than ever — testing becomes the human's job
- Existing tools show diffs but don't answer "should I care?"
- Human in the loop is still crucial, especially for established products with active users
- Triaige: AI-powered triage that tells you which visual changes are expected and which are bugs

### 1:30-2:30 — Slides: Architecture + AI techniques

**Slide 3: How it works**
- Simple diagram: App → CI (Playwright) → Triaige Runner → Dashboard
- Highlight key AI/ML techniques at a high level:
  - **Agentic RAG pipeline** — retrieves relevant triage knowledge to inform classification
  - **Two-pass classification** — initial analysis followed by a devil's advocate review for accuracy
  - **Episodic memory** — human feedback improves future classifications over time
  - **Known failure tracking** — system remembers what's already broken so you don't re-triage it
- Keep this high level — explain what each does, not how it's implemented

### 2:30-3:00 — Transition to live demo

- Switch to browser
- Open the sample app PR (PR #1) — briefly show the code change
- "This PR changes a CSS variable that affects card backgrounds across 4 pages. Let's see what Triaige found."

### 3:00-5:30 — Live: Walk through completed triage run

- Open the dashboard, navigate to the completed run
- Walk through the run card: PR title, failure count, classification badges
- Open a failure card:
  - Show the rationale (3 bullet points — why this was classified this way)
  - Show the screenshot diff (baseline vs actual, swipe slider)
  - Show the classification badge
- Walk through multiple cards:
  - "4 expected — the cards changed because we told them to"
  - "1 unexpected — the header changed and the PR didn't intend that. Worth investigating."
- Take time here — this is the core value prop. Let people absorb what they're seeing.

### 5:30-7:00 — Live: Approve/reject + submit workflow

- Approve an expected failure (show the tinted button, label)
- Reject the unexpected failure
- Hit "Submit Changes"
- Show what happened:
  - Approved → baseline committed directly to the PR branch
  - Rejected → GitHub issue filed with bug report
- Switch to GitHub PR tab:
  - Show the merge gate check — was "Action required", now flips to passing
  - "Every visual change has been reviewed. The PR is safe to merge."

### 7:00-8:30 — Live: Real-time SSE moment

- "I pushed a commit to another PR at the start of this talk. Let's check in."
- Switch to the dashboard runs page
- The new run card should have appeared without a page refresh (SSE)
- Briefly walk through the new results
- This is the closer for the live demo — the system is alive, always watching

### 8:30-10:00 — Slides: Landing

**Slide 4: Results**
- "6 CI failures → 1 investigation. Minutes, not hours."
- Frame around productivity: accessible to designers, QA, and developers — not just engineers who can read diffs

**Slide 5: AI in action (recap after seeing it live)**
- Episodic memory: "Every human decision makes future classifications smarter for your codebase"
- Known failure tracking: "The system remembers what's already broken — no re-triage, no noise"
- Two-pass classification: "A built-in second opinion catches edge cases before you see them"

**Slide 6: Close**
- "Continuing to build toward a product developers can rely on"
- Keep it forward-looking but brief — no feature roadmap, no pricing

---

## Timing notes

- The live demo (3:00-8:30) is 5.5 minutes — more than half the talk. This is intentional. The product working is more impressive than slides about the product.
- PR #2 needs ~2 minutes for CI + classification. Triggering at 0:00 means results should land by 2:00-3:00, well before the 7:00 SSE moment. Build in margin — if it's not ready by 7:00, extend the submit workflow section and check back at 8:00.
- Practice the transitions between slides and browser. Each switch should feel intentional, not fumbling.

## Backup plan

- If PR #2 hasn't completed by 8:00: skip the SSE moment, describe it verbally ("In real time, new runs appear on the dashboard as they complete — no refresh needed"), and spend the extra time on the closing slides.
- If the dashboard is slow or unresponsive: have screenshots/screen recording of the full flow as a fallback. Never rely solely on live demo.
