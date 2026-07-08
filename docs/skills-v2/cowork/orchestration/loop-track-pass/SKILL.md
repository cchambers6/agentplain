---
name: loop-track-pass
description: Run one worker track of a continuous design loop (journey-mapper, profitability-lens, or a rotation sibling). Use for "run an L1/L2 pass" or "advance the loop." Reads durable state, consumes its corrective nudges, does ONE increment of design work, closes state with a typed deliverable, commits docs-only to allowed paths. Design FOR profitable — no stop condition.
---

# Loop track pass (worker)

A worker does one increment per fire and closes the shared state with a declared deliverable. The conductor ([[heartbeat-governor]]) assigns scope; the worker never re-picks it.

## The hard skeleton (all five, in order)

1. **Read** the state store (`memory/data/loop/state.yaml`, schema-versioned). Confirm assigned scope matches the queue item.
2. **Consume every `corrective_nudges` entry targeting your track** — apply each throughout the work, mark `status: consumed` ([[dispatch-amend-in-flight]]).
3. **One increment of design work.** The mandate verb is **DESIGN** — not audit, not assess, not analyze. Every pass produces (a) a design decision, (b) a merge-ready fix spec, or (c) an action the fleet/founder can take; anything else is flagged drift and inherits a nudge.
4. **Close state:** remove the queue item; stamp `last_completed_at`; increment `pass_number`; write `last_pass_deliverables` as `[{type: design-decision|fix-spec|action, ref}]`; append ≤5 follow-ups.
5. **Gate + commit docs-only to allowed paths** (`docs/journeys/`, `docs/profitability/`, `docs/loop/backlog/`, `memory/data/loop/`) directly to main, message `loop: pass {N} [{track}] — {scope-short}`. **No PR** — the paths are inert (never built, never customer-facing) and a ~2h PR cadence would deadlock on review; recovery for a bad pass is `git revert` + re-queue.

## Track shapes

- **L1 journey-mapper:** persona (every claim cited or `persona_source` set) → 8-stage map → per-stage micro-moment table `| Want | Signal | Delivering? | Evidence/gap |` in **customer vocabulary** (Setting up / Working / Watching — never cron/webhook/RLS) → machine yaml block (the contract; prose is commentary) → cross-vertical clusters. **Verdict against the degraded experience too** — the paused prod key is a live experience, not an edge case.
- **L2 profitability-lens:** one workstream traced to gross-margin impact → a design decision that raises contribution or cuts cost-to-serve.

## Rules

- **Cold-start-safe:** state is read on every fire; nothing assumed in memory.
- **No stop condition, no milestone field.** "Design it to be profitable, not design until it is profitable" (Conner, 2026-07-03) — the milestone field was removed on purpose; do not reintroduce it.
- **The yaml block is the contract** — the governor's gate parses it mechanically; make the prose agree with it, not vice versa.
- **A "delivering: yes" requires an opened code path** as evidence — the gate can't catch semantic hallucination; the evidence rule and depth passes do.

## Example invocation

> **Input (from the governor):** "L1. Scope: realty / broker-owner, depth mode. Pending nudges: `n-041: stage 4 wants lack signal refs`."
>
> **Output shape:** nudge consumed (refs added through stage 4) → newest realty journey file edited in place → yaml block parses, want-counts in range → `state.yaml` closed with `[{type: design-decision, ref: docs/journeys/.../realty--broker-owner.md#stage-4}]` → voice-gate → `loop: pass 23 [L1] — realty depth`.

## Compose with

[[heartbeat-governor]] · [[dispatch-amend-in-flight]] · [[scheduled-task-prompt]] · [[ratified-frame-preamble]] · [[truth-wave-check]] (the evidence rule)

## Origin

`docs/loop/prompts/{TRACKS.md,L1-journey-mapper.md,L2-profitability-lens.md}` + `docs/loop/templates/` + `docs/loop/00-DESIGN.md` (inert-paths rationale) · `feedback_design_for_profitable_not_until_2026_07_03` · `project_loop_v3_nine_tracks_2026_07_03`.
