---
name: report-back
description: End a dispatched pass with a compact, decision-dense summary the orchestrator can act on — verified PR URL or file paths, what shipped, top findings, forced decisions with defaults, and declined work. Use whenever finishing a delegated task whose result feeds a parent session, the user, or a memory index.
---

# Structured report-back

A subagent's final message IS the result the parent sees — not the transcript, not shown to the end user. Make it the conclusion, verified.

## Return exactly this shape

```md
## Report-back
- **PR:** <full clickable html_url, curl-verified>     (or file paths, if docs-in-place)
- **What shipped:** <1–3 lines: counts, surfaces touched>
- **Top findings:** <2–4 bullets the orchestrator actually needs>
- **Forced decisions:** <the few things a human must decide — each with a default-if-silent>
- **Declined / out of scope:** <what you deliberately did NOT do, with reasons>
```

## Rules

- **Verify before you report.** The PR URL is curl-200'd ([[push-verification]]); counts and paths are re-read from disk, not recalled. A report-back is the one place a claim becomes "fact" downstream — `[UNKNOWN]`/`[ESTIMATE]` tags on anything unanchored (`feedback_no_guesses_no_estimates`).
- **Full URL, never a bare `#N`** — the reader may be on mobile where a number is a dead end (`feedback_always_link_prs`).
- **Findings, not narration.** "5 patterns extracted, top-1 = truth-seam defect" — not "I read a lot and wrote docs."
- **Declined work is mandatory** — silent omission reads as "covered everything" ([[no-scope-creep-fix]] makes the declines a deliverable).
- **Every forced decision carries a default** — see [[consolidated-decision-queue]]; a decision without a default is a hard blocker and should say so.
- **Write it like a memory-index line** — it usually becomes one ("Head of Sales plan DONE (PR #363) — 5 named GA RE prospects… goal 5 sends/2+ replies/1 call by 07-17" is a report-back that survived compression intact).

## Example invocation

> **Input:** (end of a department-head pass)
>
> **Output shape:**
> `PR: https://github.com/cchambers6/agentplain/pull/363 (curl 200)` · `Shipped: 00-EXECUTIVE-PLAN + 5 topic files under docs/departments/2026-07-03/sales/` · `Findings: 5 named GA-RE prospects; warm paths beat cold 3:1 in the audit data; audit 05-sales.md doesn't exist (05=connectors) — flagged, not fabricated` · `Forced decision: Monday send block owner — default: Conner sends 5 on 07-06` · `Declined: CPA/law prospect list (KILL #2)`.

## Compose with

[[push-verification]] · [[consolidated-decision-queue]] · [[librarian-inbox-rollup]] (the report's afterlife) · [[truth-wave-check]]

## Origin

Every 2026-07 fleet pass (department heads PR #356–#365; their report-backs are the memory index's entries verbatim) · verification discipline: `feedback_no_guesses_no_estimates`, `feedback_always_link_prs`.
