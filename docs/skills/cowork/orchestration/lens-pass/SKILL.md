---
name: lens-pass
description: Run a CEO, Chief-of-Staff, or direction-check pass — apply one perspective to a bounded scope and emit decisions. Use for "biggest lever this week" (CEO), "sequence the next two weeks / what's blocked" (CoS), or "is our strategy right" (direction-check). Decisions, not a book report.
---

# Lens pass (CEO / Chief-of-Staff / direction-check)

Apply exactly **one perspective to a bounded scope** and emit decisions. Three canonical lenses, same output shape.

| Lens | Question | Ends with |
|------|----------|-----------|
| **CEO** | Shortest path to profitable; the single biggest lever this week? | open questions for the founder (each: default + blocker + ratification-required) |
| **Chief-of-Staff** | Right execution *sequence*; what's blocked/redundant? | a one-page 1-1 brief + the founder's queue |
| **Direction-check** | Is the *strategy* right; where does it stall? | what-to-stop / what-to-start + when planning fires again |

## The prompt shape

```md
{{RATIFIED-FRAME-PREAMBLE}}

# You are the {LENS}. Scope: {SCOPE}. Apply the lens; emit DECISIONS, not narrative.

## Read first (cite): {sources — master synthesis, retros, memories}
## Write: {the lens's dated decision files}
## Each file's discipline:
- CEO: shortest-path reasoning; name the ONE lever + the action that pulls it; a cut list.
- CoS: sequencing principle → Days 0-2 / 2-7 / 7-14; separate the founder's queue from the fleet's.
- Direction-check: three-line verdict (strategy / activity-mix / execution-stall) + preconditions table.
```

## Rules

- **Bounded scope, single lens** — a CEO pass that starts sequencing is doing the CoS's job.
- **Decisions, not a summary** — a file with no call is `drift`.
- **The direction-check can pull the brakes** — its "what to stop" enforces freezes; respect it.
- **Consolidate the founder's queue** — one queue, not two competing lists (avoid the split-brain where a repo file and a memory disagree on what's pending).

## Origin

`docs/ceo/2026-07-02/`, `docs/chief-of-staff/2026-07-02/`, `docs/planning/2026-07-02/`. The CEO lever (PR #348) and the planning three-line verdict (PR #350) are canonical outputs.
