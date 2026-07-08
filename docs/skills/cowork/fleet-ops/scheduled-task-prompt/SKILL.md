---
name: scheduled-task-prompt
description: Write a prompt for an unattended scheduled/cron agent that must run correctly from zero context. Use when scheduling a recurring or one-off automated pass with no human in the loop. Make it self-contained, cold-start-safe, and idempotent — no "as we discussed."
---

# Scheduled-task self-contained prompt

A scheduled fire has **no conversation history** and **no operator present**. Write the prompt so a cold agent produces correct work from nothing.

## What every scheduled prompt must carry inline

1. **Which durable state to read first** — the state file, the memory index, the queue. (Read it every fire; assume nothing survived in memory.)
2. **The standing frame** — the ratified constraints / positioning rules the pass operates inside (paste them; don't reference a prior turn).
3. **The precise deliverable** — what to produce and exactly where it goes.
4. **The gates** — what to run before committing (e.g. voice-gate).
5. **Commit + report convention** — the message format and how to report back.

## Rules

- **Cold-start-safe** — durable state read on every fire; nothing assumed in memory.
- **Self-contained** — no "as we discussed," no dependence on conversation history.
- **Idempotent** — guard against double fires via the state queue (act only if the queue item is still open), not luck.
- **Verify it's actually scheduled** — a designed-but-unscheduled task is dead weight (see `heartbeat-governor`).
- **Pass timestamps in** — don't rely on ambient "now" being meaningful across a resume.

## Origin

The loop worker prompts (`docs/loop/prompts/TRACKS.md`, `docs/loop/RUNBOOK.md`) open by reading `state.yaml` and re-deriving scope from the queue, with the ratified frame and commit convention baked in — so a 30-minute cold fire produces a correct pass unattended.
