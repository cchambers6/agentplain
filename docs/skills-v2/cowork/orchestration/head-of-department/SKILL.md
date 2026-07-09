---
name: head-of-department
description: Dispatch an agent as the "Head of {domain}" to write a 14-day executive plan for one function (sales, marketing, engineering, CS, legal, data, design, fin-ops, fleet-ops, product). Use for "departmental plan-of-record" or "what would the head of X do in two weeks." Decisions and a day-table with exit tests — converging on the ONE decision only the founder can make.
---

# Head-of-{DOMAIN} pass

One function, one accountable voice, one 14-day plan — ending in the single decision it escalates. Ten of these ran on 2026-07-03 and were reconciled by a coordination pass; the shape below is what survived.

## The prompt (paste, fill `{braces}`, prepend the frame)

```md
{{RATIFIED-FRAME-PREAMBLE}}                     <!-- [[ratified-frame-preamble]], facts refreshed -->

# You are the Head of {DOMAIN} for agentplain. Write a 14-day executive plan.
Mandate: design FOR profitable — every recommendation moves toward paying design
partners and founder-inclusive profitability, or it is out of the window.

## Read first (cite what you use; don't re-derive; flag what doesn't exist)
{audit paths} · {kaizen retro path} · {memory slugs}

## Write under docs/departments/{DATE}/{domain-slug}/
1. 00-EXECUTIVE-PLAN.md — EXACT skeleton:
   header (date, role, mandate) · current state (customers, constraints, live/killed)
   · the shape of this function at this scale (one honest paragraph)
   · day-by-day table | Day | Owner | Action | Exit test |
   · explicit stops · success criteria (primary / secondary / anti-goal)
   · THE ONE decision the founder must make (trigger + scope + a number)
2. {5–6 topic files, one concern each — e.g. first-partner runbook,
   what-I-need-from-others, what-we-must-stop, profit-contribution}

## Discipline
Decisions, not narrative · exit tests, not activities · every claim cites a real
artifact or is marked todo-real-signal · end on the escalated decision.

## Report back per [[report-back]]: paths · top 3 findings · the ONE decision.
```

## Rules

- **Prepend the frame or pay for it** — un-framed heads drift audience/positioning and propose killed work (a Sales head pitching CPA/law GTM violates KILL #2 and gets caught at coordination time instead of before).
- **One forced decision, not a list.** The CS head converged its entire plan onto the prod-key un-pause trigger/scope/cap — that convergence is the pass's value.
- **Exit tests, not activities:** "5 sends out, ≥2 replies by Jul 17" — not "draft 5 emails."
- **"The shape of this function at this scale" keeps the plan honest** — "CS at n=0 is a rehearsed first hour, not a department."
- **Flag ghost sources instead of citing them.** Multiple heads were briefed to read audits that didn't exist (05-sales, 01-engineering, 07-finance-ops); the good plans said so explicitly (see [[truth-wave-check]]).
- Docs-only; a plan proposes, a fix wave implements ([[docs-only-pr]]).

## Example invocation

> **Input:** "Run a Head of Sales pass before Monday."
>
> **Output shape:** `docs/departments/<date>/sales/00-EXECUTIVE-PLAN.md` + 5 topic files; report-back: paths, "5 named GA-RE prospects (warm paths first), Monday block runbook, audit 05-sales doesn't exist — worked from deep-dive docs instead," forced decision = the Monday send-block commitment with a number (PR #363 is the reference output).

## Compose with

[[ratified-frame-preamble]] (mandatory) · [[cross-department-coordination]] (what reconciles N heads) · [[consolidated-decision-queue]] (where the ONE decision lands) · [[report-back]] · [[docs-only-pr]]

## Origin

`docs/departments/2026-07-03/{10 domains}/00-EXECUTIVE-PLAN.md` (PR #356–#365); reconciliation in PR #368. Ghost-audit flags recorded in the head-plan memories (`project_head_of_sales_plan_2026_07_03`, `project_head_finops_plan_2026_07_03`, `project_dept_eng_head_plan_2026_07_03`).
