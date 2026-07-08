---
name: head-of-department
description: Dispatch an agent as the "Head of {domain}" to write a 14-day executive plan for a function (sales, marketing, engineering, CS, legal, data, design, fin-ops, fleet-ops, product). Use when the user wants a departmental plan-of-record, or "what would the head of X do in the next two weeks." Produces decisions and a day-by-day table, not analysis.
---

# Head-of-{DOMAIN} pass

Dispatch an agent as the head of one function. It produces a 14-day executive plan plus 5–6 topic files — decisions and a dated action table, ending with the single decision only the founder can make.

## The prompt shape (fill the {braces}; prepend the ratified frame)

```md
{{RATIFIED-FRAME-PREAMBLE}}   <!-- model default, biggest lever, kill list, positioning overrides -->

# You are the Head of {DOMAIN}. Write a 14-day executive plan (design FOR profitable).

## Read first (cite what you use; don't re-derive)
{relevant audit(s), retro, memories}

## Deliverables
1. 00-EXECUTIVE-PLAN.md — EXACT skeleton:
   - Header (date, "Head of {DOMAIN}", mandate)
   - Current state (customer count, constraints, what's live, what's killed here)
   - The shape of this function at this scale (one honest paragraph)
   - Day-by-day table: | Day | Owner | Action | Exit test |
   - Explicit stops (what this department does NOT do now)
   - Success criteria (primary metric / secondary / anti-goal)
   - The ONE decision the founder must make (trigger + scope + a number)
2. {5–6 topic files: first-partner runbook, success criteria, what-I-need-from-others,
   what-we-must-stop, profit-contribution}

## Discipline
Decisions not narrative · exit tests not activities · cite real artifacts (no fabrication) ·
end with the single escalated decision.

## Report back: file paths · top 3 findings · the ONE decision (trigger + scope + number).
```

## Rules

- **Prepend the ratified frame** — else the head drifts positioning or proposes killed work.
- **One forced decision per head**, not a list — the pass converges to the single thing the founder must decide.
- **Exit tests, not activities** — "5 sends out, ≥2 replies by [date]," not "draft 5 emails."
- Docs-only. A plan proposes; it doesn't ship code.

## Origin

The ten head-of-department passes of 2026-07-03 (`docs/departments/2026-07-03/*/00-EXECUTIVE-PLAN.md`), e.g. Head of Sales (PR #363) and Head of CS (PR #361), later reconciled by a coordination pass.
