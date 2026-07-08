# Pattern: docs-only PR

**Group:** code/process · **Seeded by:** the planning/audit/kaizen/department/outreach/pilot PRs — all docs-only (e.g. PR #344 master synthesis, #356–#365 department heads, #366 pilot runbook, #368 coordination); memory across the 2026-07 planning wave.

## When to use — trigger phrases
- "write a plan / audit / retro / runbook / ruling"
- "this is documentation, not code"
- any deliverable that is prose + decisions, no runtime change

## Inputs
- The doc(s) to write, and the directory convention they belong in (`docs/<area>/<date>/`).

## Procedure
1. Confirm the deliverable is **only** files under `docs/` (plus, at most, a new doc directory). No `lib/`, no components, no schema.
2. Write to the dated convention: `docs/<area>/<YYYY-MM-DD>/<NN-topic>.md`.
3. Run the relevant gates that apply to docs (voice-gate for `docs/marketing/*`; nothing runtime).
4. Open the PR with a `docs(<area>): …` title.

## Output
A PR whose diff is exclusively documentation — fast to review, zero deploy risk.

## Guardrails
- **Truly docs-only.** If you find yourself editing `lib/billing/facts.ts` or a component, it's no longer a docs PR — split it. (This catalog PR itself is held to this: docs only, no runtime code, no brand assets.)
- **Dated, numbered convention.** `docs/<area>/<date>/00-…` keeps passes idempotent and sortable.
- Docs PRs still respect Truth Wave — cite the artifacts you reference.
- Don't smuggle a decision into code. A docs-only planning PR *proposes*; the fix wave *implements* (this is the STOP-list discipline: "no more analysis layers without a fix following").

## Worked example
The coordination pass (PR #368) unified 14 days of plan-of-record across ten head plans as pure docs under `docs/departments/2026-07-03/COORDINATION/`. The MASTER-SYNTHESIS (PR #344) is 11 docs and zero code. This skills catalog is the same shape.
