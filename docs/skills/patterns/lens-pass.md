# Pattern: lens pass (CEO / Chief-of-Staff / direction-check)

**Group:** orchestration · **Seeded by:** `docs/ceo/2026-07-02/`, `docs/chief-of-staff/2026-07-02/`, `docs/planning/2026-07-02/`.

> Full parametric prompt template: **[`../orchestration/lens-pass.md`](../orchestration/lens-pass.md)**.

## When to use
"CEO pass / biggest lever" · "chief-of-staff / sequence the next 2 weeks / what's blocked" · "direction check / is our strategy right."

## The primitive
Apply **one perspective to a bounded scope** and emit decisions. CEO = shortest path + single biggest lever. CoS = execution sequence + blocked/redundant + Conner queue. Direction-check = three-line verdict on strategy/activity-mix/execution-stall + preconditions table. Same output shape: cited sources, decisions > narrative, ratified frame, actionable end-state.

## Output shape
A dated dir of short decision docs (see template table). CEO/CoS feed the consolidated Conner queue; direction-check gates whether more planning loops fire (can enforce KILL #1).

## Guardrails
- Bounded scope, single lens — don't let CEO drift into sequencing (that's CoS).
- Decisions, not a book report.
- Consolidate the Conner queue — avoid the split-brain (repo YAML vs fleet memory).

See the template for the paste-in prompt and worked example (PR #348 lever, PR #350 verdict).
