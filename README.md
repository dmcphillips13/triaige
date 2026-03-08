# Triaige — Agentic RegressionOps

AI-powered visual regression triage system that classifies CI test failures, surfaces actionable context, and automates baseline updates — all through a human-in-the-loop review dashboard.

**Live app:** https://triaige-dashboard.vercel.app/

## How it works

1. A merged PR triggers Playwright visual tests via GitHub Actions
2. Failures are sent to the Triaige runner, which classifies each as **expected**, **unexpected**, or **uncertain**
3. The dashboard shows grouped results with screenshot diffs, confidence scores, and rationale
4. A human approves or rejects each classification — approved decisions feed back as episodic memory for future triage
5. Approved expected changes can update baseline screenshots via an auto-generated PR

## Stack

- **Runner:** FastAPI + LangGraph agent with GPT-4o-mini (text) and GPT-4o (vision)
- **Memory:** Qdrant Cloud — semantic retrieval (triage corpus) + episodic memory (human feedback)
- **Dashboard:** Next.js App Router with Tailwind CSS
- **Deploy:** Render (runner) + Vercel (dashboard)

## Project Structure

```
apps/
  dashboard/    # Next.js review dashboard
  runner/       # FastAPI + LangGraph agent service
packages/
  shared/       # Shared types and schemas
docs/           # Documentation
```

## Getting Started

See individual app READMEs for setup instructions.
