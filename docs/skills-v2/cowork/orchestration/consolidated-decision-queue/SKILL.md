---
name: consolidated-decision-queue
description: Merge every forced decision the fleet surfaces into ONE ranked queue for the human — each item carrying a default-if-silent and a fire date — and keep exactly one store of it. Use after lens/head passes, when "what does the founder need to decide" comes up, or when the queue has split-brained across stores. Silence executes defaults; the exceptions are named.
---

# Consolidated decision queue (one queue, defaults that fire)

The founder's queue is only the decisions the fleet genuinely cannot make. Two lists in two stores is the recorded failure; items without defaults that silently age is the expensive one.

## Item schema

```
{decision, default-if-silent, fire-date, what-it-blocks, time-to-decide}
```

Rank by what-it-blocks: a decision gating the critical path outranks a cosmetic one.

## Rules

- **One store.** The canonical split-brain: the repo `conner-queue.yaml` showed 0 rows while fleet memory held 5 (CoS Pass 1, PR #352). Pick one store; reconcile the other TO it; cross-index (see [[librarian-inbox-rollup]]).
- **Silence executes defaults** — every item carries the default and the date it fires (the COORDINATION standing rule). **Except where silence is unsafe:** the prod-key un-pause cap was explicitly marked *silence-unsafe* (unconfigured = NO_CAP) and required active ratification — name such items as hard blockers, don't give them fake defaults.
- **Items age visibly or the queue rots.** The same 5 items were re-listed verbatim in every daily brief for ~2 weeks — including a leaked PAT that went **23 days unrevoked** while "in the queue daily." Give the queue an SLA lane: security items escalate on a timer, not on re-listing.
- **Systematic items don't belong here.** If a competent ops manager would find it tedious, it's the fleet's job — automate or do it; the queue holds judgment calls only (`feedback_fleet_handles_systematic`).
- **3–5 items is a queue; 30 is a backlog.**

## Example invocation

> **Input:** "Build Conner's queue from the ten head plans."
>
> **Output shape:** one ranked list — e.g. `1. Un-pause cap ratification — NO DEFAULT (silence-unsafe, NO_CAP); blocks the entire 14-day plan; decide by Jul 7. 2. Entity ruling — default: LLC filing proceeds Jul 10. 3. Daily-cap conflict $4 vs $5 — default: Fin-Ops $4 stands if silent by Jul 8.` — with every other head-plan ask either folded into these or routed to the fleet as systematic.

## Compose with

[[lens-pass]] + [[head-of-department]] (the producers) · [[cross-department-coordination]] (where merging happens) · [[report-back]] (the transport) · [[no-secrets-in-chat]] (the PAT lesson)

## Origin

`docs/chief-of-staff/2026-07-02/03-conner-queue-priority.md` + `docs/ceo/2026-07-02/04-open-questions-for-conner.md` · split-brain: `project_cos_pass1_2026_07_02` (PR #352) · silence-executes-defaults + the NO_CAP exception: `docs/departments/2026-07-03/COORDINATION/00-UNIFIED-14D-PLAN.md` standing rules, `02-conflicts-requiring-conner.md` C1 · 23-day PAT: `docs/kaizen/2026-07-02/MASTER-IMPROVEMENT-PLAN.md` friction-5/action-15.
