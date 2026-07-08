# Pattern: kaizen retro (10 wins / 10 friction / top-5 process / top-3 investments)

**Group:** orchestration · **Seeded by:** `docs/kaizen/2026-07-02/01-engineering.md … 10-fleet-ops.md` + `MASTER-IMPROVEMENT-PLAN.md`; the weekly retro loop (PR #273).

## When to use — trigger phrases
- "run a kaizen retro on {department}"
- "weekly retrospective" / "what's working and what's causing friction"
- (Respect KILL #1 — retros are frozen until the top-20 fix table is burned down; run only when un-frozen.)

## Inputs
- The date range, repos, and data sources (PRs, memories, metrics) for the department under review.

## Procedure — the fixed skeleton
1. **Header**: scope (date range, repos, data sources, caveat on any missing memories).
2. **10 patterns we do well** — wins, each with an evidence citation.
3. **10 patterns causing friction** — failure modes, each with impact.
4. **Top 5 process improvements** — structured: `[title]: [what changes]`, `Measure: [baseline → target]`, `Workstreams affected`.
5. **(Top 3 investments)** — where to spend the next unit of effort, if the retro calls for it.
6. **Notes on method** — how numbers were derived, not estimated (Truth Wave).

Then a **MASTER-IMPROVEMENT-PLAN** synthesizes all department retros: dedup clusters, first-five ranked fixes, top-20 impact/effort table, a STOP list, and what each product needs next.

## Output
One retro doc per department + one master synthesis; a ranked, deduped fix queue.

## Guardrails
- **Evidence on every win and friction item** — "we ship fast" is not a retro finding; "14/17 CI runs green, 3 blocked on schema drift" is.
- **Dedup at the master level** — one underlying issue reported by five retros is ONE fix, counted once.
- **The STOP list is a deliverable**, not an afterthought (e.g. "no more analysis layers, no surfaces without activation, no hand-maintained gate lists").
- Retros are under KILL #1 — don't spawn a new retro loop just because you can; they restart when the fix table is burned down.

## Worked example
The 2026-07-02 kaizen sweep produced ten department retros and a MASTER-IMPROVEMENT-PLAN whose first-five converged fixes were: stamp wiring, CI floor, guarantee leak, data-min branch, and Conner-queue SLA (memory: project_kaizen_master_synthesis). The engineering retro's "CI 14/17 schema-drift" is a model evidence-cited friction item.
