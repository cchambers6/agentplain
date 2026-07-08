---
name: voice-gate-check
description: Check customer-facing copy for LLM-ese and banned phrasing before it ships. Use after changing marketing pages, emails, or UI strings, and as a landing gate on any copy PR. Flags hollow intensifiers, "it's not just X, it's Y" constructions, robotic hedging, and the banned-phrase list.
---

# Voice-gate compliance check

Run an automated voice gate over changed customer-facing text so copy reads human, not model-generated. It is the owner of the LLM-ese categories — don't hand-wave "it reads fine."

## Procedure

1. Run the gate over the changed surfaces (`npm run voice-gate` in this repo; equivalent linter elsewhere).
2. It flags **LLM-ese A–D**: hollow intensifiers, "not just X, it's Y" constructions, robotic hedging, and a banned-phrase list.
3. Fix flagged lines to the voice guidelines; re-run until clean.
4. **Landing gate:** a copy/marketing PR does not merge until the gate is green.

## Rules

- **Run it — don't eyeball it.** The gate owns LLM-ese detection.
- **Know the scope.** It covers marketing surfaces and marketing docs; it does **not** cover outreach copy — read that manually.
- **The gate wins.** If you think a flagged phrase is fine, rewrite it anyway; the banned list is the spec.
- **Compose** with model/vendor-invisible and the no-fabrication check for customer surfaces.

## Origin

`npm run voice-gate` and `docs/brand/voice-guidelines-2026-06-19.md`; the de-AI voice pass (PR #309) made the gate the owner of LLM-ese A–D. The loop track skeleton runs it as the pre-commit step on every pass.
