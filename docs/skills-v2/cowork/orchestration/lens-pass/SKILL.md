---
name: lens-pass
description: Run a CEO, Chief-of-Staff, or direction-check pass — one perspective applied to a bounded scope, emitting decisions. Use for "biggest lever this week" (CEO), "sequence the next two weeks / what's blocked" (CoS), or "is our strategy right" (direction-check). Each lens has a fixed file set and a fixed ending; a file with no call is drift.
---

# Lens pass (CEO / Chief-of-Staff / direction-check)

One perspective, bounded scope, decisions out. The lenses compose because they stay distinct — a CEO pass that starts sequencing is doing the CoS's job.

| Lens | Question | Fixed ending |
|---|---|---|
| **CEO** | Shortest path to profitable; the single biggest lever this week? | open questions for the founder, each `{default + blocker + ratification-required}` |
| **Chief-of-Staff** | Right execution sequence; what's blocked or redundant? | a one-page 1-1 brief + the founder's queue |
| **Direction-check** | Is the strategy right; where does it stall? | three-line verdict + what-to-stop/start + when planning fires again |

## The prompt

```md
{{RATIFIED-FRAME-PREAMBLE}}

# You are the {LENS} for agentplain. Scope: {SCOPE}. Emit DECISIONS, not narrative.

## Read first (cite; don't re-derive): {master synthesis, retros, memories}
## Write under docs/{ceo|chief-of-staff|planning}/{DATE}/: {the lens's file set}
## Discipline per lens:
- CEO: name the ONE lever + the action that pulls it; a cut list extending the kill list.
- CoS: sequencing principle → Days 0–2 / 2–7 / 7–14; the founder's queue separate from the fleet's.
- Direction-check: verdict line each for strategy / activity-mix / execution-stall, up top;
  preconditions table with probability calls; end with cadence (when this fires again).
```

## Rules

- **Bounded scope, single lens** — outputs compose instead of overlapping.
- **A summary file with no call is `drift`.**
- **The direction-check can pull the brakes** — its what-to-stop enforces KILL #1 (no new analysis loops); respect it rather than spawning another audit because a lens "found gaps."
- **CEO open-questions + CoS queue merge into ONE queue** — [[consolidated-decision-queue]]; the split-brain (repo YAML 0 rows vs memory 5) is the recorded failure.
- **Lens outputs propagate literally:** the CEO lever ("first 5 GA-RE design-partner sends") became the frame line every downstream head reasoned inside — write the lever sentence as if it will be quoted, because it will.

## Example invocation

> **Input:** "Is our strategy right, and should more planning fire?"
>
> **Output shape (direction-check):** `docs/planning/<date>/00-direction-verdict.md` opening: "strategy right / activity mix wrong / fails on execution-stall" · "entity = biggest silent gap" · next planning fire ~{date} (PR #350 is the reference output; the verdict's three lines were quoted verbatim in coordination and memory).

## Compose with

[[ratified-frame-preamble]] · [[consolidated-decision-queue]] · [[head-of-department]] (the lens's downstream consumers) · [[kaizen-retro]] (feeds the read-first list) · [[report-back]]

## Origin

`docs/ceo/2026-07-02/` (PR #348 — the lever + cash-breakeven 3–9 customers) · `docs/chief-of-staff/2026-07-02/` (PR #352) · `docs/planning/2026-07-02/` (PR #350 — the three-line verdict).
