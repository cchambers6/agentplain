# Pattern: loop track pass (L1 / L2 + L3 governor)

**Group:** orchestration · **Seeded by:** `docs/loop/prompts/{TRACKS.md,L1-journey-mapper.md,L2-profitability-lens.md,L3-haiku-heartbeat.md}`, `docs/loop/templates/{journey.md,profitability.md}`.

> Full parametric prompt template: **[`../orchestration/loop-track-pass.md`](../orchestration/loop-track-pass.md)**.

## When to use
"Run an L1 journey-mapper pass" · "L2 profitability-lens pass" · "advance the loop."

## The primitive
Loop v3 = 9-track weighted rotation, 30-min L3 heartbeat governor. Every worker pass: read `state.yaml` (schema v3) → consume `corrective_nudge` for its track → one increment of design work → close state with `last_pass_deliverables` ({type: design-decision|fix-spec|action, ref}) → voice-gate + commit. **No stop condition; no milestone field.**

## Output shape
- **L1** → a journey doc (persona → 8-stage map → micro-moment tables → YAML block → cross-vertical clusters).
- **L2** → a profitability design-decision tracing a workstream to margin.
- **L3** → conductor only: reconcile in-flight (4h timeout) → fire next by weighted rotation → tick metrics.

## Guardrails
- Read state on every fire (cold-start-safe). Every pass ships a deliverable or it's `drift`. Governor schedules, workers design. **Verify the governor is actually scheduled** (#349 dormant is the recurring failure).

See the template for the full paste-in prompt and worked example.
