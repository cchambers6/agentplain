---
name: kaizen-retro
description: Run a structured retrospective on a function — 10 evidenced wins, 10 evidenced friction points, top-5 process improvements with measures — then synthesize across functions into a ranked, deduped fix queue with a STOP list. Use for "weekly retro" or a periodic improvement pass; respect the freeze (KILL #1) when one is active.
---

# Kaizen retro

The deliverable is a **ranked, deduped fix queue**, not a feelings-dump. Evidence on every line; dedup at the master level; a STOP list as a first-class output.

## Per-function skeleton

1. **Header** — scope (dates, repos, data sources) + a sourcing caveat listing any briefed inputs that **don't exist** ("the four memory files this retro was asked to read do not exist in the code-side memory" is a model caveat — flag ghosts, never cite them; [[truth-wave-check]]).
2. **10 patterns we do well** — each with a citation ("14/17 CI runs green, 3 blocked on schema drift" — not "we ship fast").
3. **10 patterns causing friction** — each with measured impact.
4. **Top 5 process improvements** — `[title]: [what changes]` · `Measure: [baseline → target]` · `Workstreams affected`.
5. **Notes on method** — how numbers were derived, not estimated.

## Master synthesis (across functions)

- **Dedup clusters:** one underlying issue reported by five retros = ONE fix, counted once. (2026-07-02: "wire `stampSessionCost` into dispatch" surfaced independently as finance imp-1, data imp-1, fleet-ops friction-1, engineering fleet-gap-3 — one fix.)
- **First-five ranked fixes** — what converges across every retro.
- **Impact/effort table:** `# | Fix | Impact | Effort | Source retros | After | Risk if skipped`.
- **A STOP list** — practices to stop, as a deliverable ("no more analysis layers, no surfaces without activation, no hand-maintained gate lists").

## Rules

- **Evidence or it isn't a finding.**
- **Dedup at master, cite all sources** — the convergence count is itself the priority signal.
- **Respect freezes:** retros sit under KILL #1 — frozen until the fix table burns down; a retro loop that spawns retros defeats itself. And check the retro's own schedule fired — the 2026-06-28 kaizen was silently skipped ([[scheduled-task-liveness]]).
- **The retro hunts for built-but-unwired** — producers with no consumers are its highest-value catch (see [[wired-not-just-built]]).

## Example invocation

> **Input:** "Retro the engineering function for the last 30 days."
>
> **Output shape:** `docs/kaizen/<date>/01-engineering.md` per the skeleton — e.g. friction-2 "PR-blocking CI is path-scoped; a PR touching app/ runs no GitHub check," friction-5 "schema-drift is 82% of CI failure; 8 duplicate hand-minted migration timestamps on main" — each with counts, then the top-5 with baselines→targets; report-back = the top finding + the one fix you'd do first.

## Compose with

[[wired-not-just-built]] · [[truth-wave-check]] · [[consolidated-decision-queue]] (where cross-retro decisions land) · [[docs-only-pr]] · [[report-back]]

## Origin

`docs/kaizen/2026-07-02/01…10 + MASTER-IMPROVEMENT-PLAN.md` (the reference sweep; PR #334–#343) · weekly loop introduced PR #273 · freeze: `docs/kills/2026-07-03/RATIFIED.md` KILL #1.
