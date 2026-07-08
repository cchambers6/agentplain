---
name: ratified-frame-preamble
description: Prepend a standing decisions block to any orchestrator prompt so the agent reasons inside the guardrails instead of re-litigating settled questions. Use before dispatching any pass that plans, prioritizes, cuts, or decides. Carries the model default, the biggest lever, the kill list, and positioning overrides.
---

# Ratified-frame preamble

If a pass produces decisions, it gets this preamble. Without it, agents re-litigate settled questions, drift positioning, or propose already-killed work.

## The block (paste at the top; refresh the bracketed facts each time)

```md
## RATIFIED FRAME — you operate inside these standing decisions. Do not re-litigate them.

### Model default
- Orchestrator and worker passes run on the strong default model. A cheaper conductor
  (heartbeat) is fine, but worker passes use the strong model.

### Biggest lever this week
- [the single lever — e.g. "the first N design-partner sends and the replies they produce."]
  Everything competes with that lever for priority.

### Kill list (do not propose killed work)
- [KILL #1 … #N, each with its restart trigger. Note any that were OVERRIDDEN and now stand.]

### Positioning overrides (never drift)
- Audience is [the exact audience label]. Never [the banned synonyms].
- We are a service layer ON TOP OF the underlying model, not a competitor. BANNED: compete /
  replace / instead-of / alternative-to.
- Model/vendor invisible on customer surfaces. Sole exception: /privacy + /security subprocessor lists.
- Customer vocabulary, not engineer labels. No quick fixes — best fixes only.

### Output discipline
- Decisions, not narrative. Every claim cites a real artifact (no fabrication).
- End with ≥1 concrete deliverable, or the pass is `drift`.
```

## Rules

- **Refresh the dated facts, keep the shape.** Kills, the lever, and the model default change over time — pull current values before pasting.
- **Don't add new standing rules here.** A pass that wants a new rule proposes it as a deliverable for the human; it doesn't smuggle it into the frame.
- **One source of truth per fact.** If two sources disagree, flag the conflict for a human ruling — don't pick silently.

## Origin

The "Ratified frame" block opening every 2026-07 orchestrator pass (CEO, CoS, department heads, loop tracks); the coordination pass (PR #368) used it to catch drifted plans before they shipped.
