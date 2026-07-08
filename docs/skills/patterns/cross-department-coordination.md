# Pattern: cross-department coordination + handoff matrix

**Group:** orchestration · **Seeded by:** `docs/departments/2026-07-03/COORDINATION/` (unified 14-day plan, handoff matrix, conflicts, conner queue, critical path, standup agenda); memory: project_coordination_pass_2026_07_03 (PR #368).

## When to use — trigger phrases
- "reconcile the head-of-department plans into one plan-of-record"
- "what conflicts across the departments" / "build the handoff matrix"
- after N parallel orchestration passes that need to become one sequence

## Inputs
- The set of head-of-department (or track) plans to reconcile.
- The ratified frame (kills, lever, sequencing constraints).

## Procedure
1. **Unify** the N plans into one 14-day plan-of-record: Days 0–2 (merge decision PRs, park conflicts, close stale PRs) → Days 2–7 (a *sequential* fix wave + a parallel Conner-decision pack) → Days 7–14 (verify, measure, hold the line).
2. **Handoff matrix**: for each department, "what I need from others" ↔ "what others need from me" — every dependency has a named producer and consumer.
3. **Conflicts**: list every place two plans disagree; resolve to one, or escalate the residual to Conner (don't silently pick).
4. **Consolidated Conner queue**: merge all heads' forced decisions into one queue (see `consolidated-conner-queue.md`).
5. **Critical path**: name the ONE bottleneck the whole 14 days hinge on.

## Output
`COORDINATION/00-UNIFIED-14D-PLAN.md` + handoff matrix + conflicts doc + consolidated queue + critical-path doc + standup agenda.

## Guardrails
- **Sequential, not parallel, for overlapping work** — the fix wave is 5–6 sequential landings, not a parallel free-for-all (memory: feedback_sequential_not_parallel_for_overlapping_prs).
- **One bottleneck, named.** PR #368's headline was a *single* critical path: un-pause ratification (NO_CAP silence-unsafe, bundle due Jul 7).
- **Surface residual conflicts, don't resolve by fiat.** The Fin-Ops $4/day vs runbook $5/day daily-cap split was left as an explicit Conner ruling, not silently reconciled.
- Every dependency in the handoff matrix names both ends — an unowned dependency is a dropped ball.

## Worked example
The coordination pass (PR #368) reconciled ten head plans into one plan-of-record, pulled the entity ruling forward to Jul 10, resolved the cost-stamp and event-schema tangles, and reduced the whole two weeks to ONE bottleneck: un-pausing the production key. That single-bottleneck framing is the point of the pattern.
