---
name: loop-track-pass
description: Run one worker track of a continuous design loop (e.g. journey-mapper or profitability-lens). Use for "run an L1/L2 pass" or "advance the loop." Reads durable state, consumes corrective nudges, does one increment of design work, and closes state with a declared deliverable. No stop condition.
---

# Loop track pass (worker)

A loop worker does **one increment** of design work per fire and closes the shared state with a declared deliverable. A separate conductor (see `heartbeat-governor`) schedules which track fires.

## The hard skeleton (do all five, in order)

1. **Read** the durable state store (`state.yaml`, schema-versioned). Confirm your assigned scope matches the queue item.
2. **Consume corrective nudges** targeting your track; mark each `status: consumed`.
3. **One increment of design work** for your track (no new analysis layer).
4. **Close state**: remove your queue item; stamp `last_completed_at`; increment `pass_number`; write `last_pass_deliverables` as `[{type, ref}]` (type ∈ design-decision | fix-spec | action); append ≤5 follow-ups. **Every pass ships ≥1 deliverable or it's marked `drift`.**
5. **Gate + commit**: run the voice gate; commit `loop: pass {N} [{track}] — {scope-short}`.

## Track examples

- **Journey-mapper (L1)**: persona (every claim cited or `persona_source` set) → 8-stage map (Awareness→…→Advocacy) → per-stage micro-moment table `| Want | Signal | Delivering? | Evidence/gap |` → machine YAML block → cross-vertical clusters.
- **Profitability-lens (L2)**: take one workstream, trace it to gross-margin impact, emit a design-decision that raises contribution or cuts cost-to-serve.

## Rules

- **Read state on every fire** — cold-start-safe; nothing assumed in memory.
- **No stop condition, no milestone field** — design continues toward profitable indefinitely; don't reintroduce a milestone.
- **A pass ships a deliverable or it's drift** — analysis-only passes are the failure mode.
- **The conductor assigns scope; the worker doesn't re-pick it.**

## Origin

Loop v3 (`docs/loop/prompts/{TRACKS.md,L1-journey-mapper.md,L2-profitability-lens.md}`, templates in `docs/loop/templates/`). 9-track weighted rotation driven by a 30-min heartbeat.
