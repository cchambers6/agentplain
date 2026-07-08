# Pattern: head-of-department orchestration pass

**Group:** orchestration · **Seeded by:** `docs/departments/2026-07-03/*/00-EXECUTIVE-PLAN.md` (10 heads).

> Full parametric prompt template: **[`../orchestration/head-of-department.md`](../orchestration/head-of-department.md)**.

## When to use
"Run a Head of {domain} pass" / "departmental plan-of-record for the next 2 weeks."

## The primitive
Dispatch an agent as the **Head of {DOMAIN}** with the ratified-frame preamble prepended. It writes `00-EXECUTIVE-PLAN.md` (fixed skeleton: current state → shape-of-function → day-by-day table with exit tests → explicit stops → success criteria → the ONE decision for Conner) plus 5–6 topic files. Decisions, not narrative.

## Output shape
`docs/departments/<date>/<domain>/00-EXECUTIVE-PLAN.md` + topic files; each head surfaces exactly one forced decision, later reconciled by the coordination pass.

## Guardrails
- Prepend the ratified frame (else drift/killed-work).
- One forced decision per head, not a list.
- Exit tests, not activities. Cite, don't estimate. Docs-only.

See the template for the full paste-in prompt and worked example (Head of Sales / CS passes).
