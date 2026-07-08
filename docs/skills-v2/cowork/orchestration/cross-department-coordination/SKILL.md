---
name: cross-department-coordination
description: Reconcile N parallel plans into one sequenced plan-of-record — a handoff matrix with named producers and consumers, an explicit conflicts file, one consolidated decision queue, and ONE named bottleneck. Use after several head-of-department or track passes that must become a single 14-day sequence. Residual conflicts escalate for a ruling; they are never resolved by fiat.
---

# Cross-department coordination + handoff matrix

Ten plans in, one plan-of-record out — and the whole window reduced to the single bottleneck it actually hinges on.

## Procedure

1. **Unify** into a 14-day sequence: Days 0–2 (merge the decision stack **sequentially as a train** — the reference pass ordered #348–#355 explicitly; park conflicts; close stale PRs) → Days 2–7 (a *sequential* fix wave + a parallel human-decision pack) → Days 7–14 (verify, measure, hold the line).
2. **Handoff matrix:** per function, "what I need from others" ↔ "what others need from me" — every dependency has a named producer, consumer, and date ("Dispatch environment confirmation, Eng → Fleet-Ops, before Jul 7").
3. **Conflicts file:** every place two plans disagree, resolved to one or **escalated with the disagreement stated** — the reference pass left the Fin-Ops $4/day vs runbook $5/day cap split as an explicit founder ruling (C1) rather than picking silently.
4. **Consolidated decision queue** — merge every plan's forced decision into ONE queue with defaults and fire dates ([[consolidated-decision-queue]]); mark silence-unsafe items as requiring active ratification.
5. **Critical path:** name THE bottleneck. The reference pass reduced two weeks of ten plans to one line: un-pause ratification.

## Rules

- **Sequential fix wave** — 5–6 ordered landings, not a parallel free-for-all ([[sequential-landings]] is the code-level same rule).
- **One bottleneck, named.** If the headline lists three, the pass isn't done converging.
- **Every dependency owned at both ends** — an unowned handoff is a dropped ball.
- **Pull decisions forward when the sequence allows** — the reference pass moved the entity ruling from "eventually" to Jul 10 because Days 2–7 had a slot for it.
- **Standing rules restated in the plan** ("silence executes defaults," the exception list) so downstream readers don't need the source docs open.

## Example invocation

> **Input:** "Reconcile the ten head plans into a plan-of-record."
>
> **Output shape:** `docs/departments/<date>/COORDINATION/00-UNIFIED-14D-PLAN.md` + handoff matrix + conflicts (each: both positions, the ruling asked, the default) + consolidated queue + critical path ("everything below Day 7 hinges on the un-pause ratification — NO_CAP silence-unsafe, bundle due Jul 7") + standup agenda. Report-back leads with the bottleneck.

## Compose with

[[head-of-department]] (inputs) · [[consolidated-decision-queue]] · [[sequential-landings]] · [[ratified-frame-preamble]] (drift caught here if heads skipped it) · [[report-back]]

## Origin

`docs/departments/2026-07-03/COORDINATION/` (PR #368) — the unified plan, the C1 cap-conflict escalation, the merge-train order, the entity pull-forward.
