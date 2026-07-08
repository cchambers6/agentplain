---
name: heartbeat-governor
description: Design a cheap deterministic conductor that schedules worker agents on a fixed cadence without doing their work. Use when building a loop conductor, a heartbeat, or any system that must fire the next pass, detect stalls, and issue corrective nudges. The conductor conducts; workers design — and it must be the ONLY governor running.
---

# Heartbeat governor (conductor, not a worker)

A conductor ticks on a fixed cadence (30 min), keeps exactly one worker moving, and never designs anything. Cheap model (Haiku), deterministic branching, single instance.

## The tick — four steps, always all four

1. **Reconcile the in-flight pass** against the *actual session list* (`list_code_tasks` vs `pass_in_flight_session_id`):
   - running < 4h → leave it;
   - running ≥ 4h → presume stalled: stop message, `stalls_logged`++, scope back to queue head;
   - claimed in-flight but **no such session** → died silently: same recovery;
   - completed since `last_tick_at` → run the quality gate.
2. **Quality gate — mechanical checks only** (parse the yaml, count the rows, grep the paths, run voice-gate). Verdicts: `accepted` / `accepted-with-nudges` (one `corrective_nudges` entry per fixable failure) / `rejected` (re-queue at head + nudge). **Never edit worker output** — judgment problems are fixed by the next smart pass, one pass late, not badly by the cheap layer now.
3. **Fire the next pass** by weighted rotation — invariant track always queued; freshness cap; explicit idle branch.
4. **Always finish:** write `last_tick_at`, append the tick metric. `last_tick_at` is the staleness canary — older than ~2h means the conductor itself is down.

## Rules

- **Exactly one governor.** Ticks are idempotent (step-1 reconciliation makes double-*firing* safe), but two concurrent governors race on the state file — "one scheduled task only" (`docs/loop/RUNBOOK.md`).
- **The governor is the single writer of `pass_in_flight_session_id`** — that single-writer rule is what makes parallel-fire races lose harmlessly (loser re-gated from its files; docs-only, no data loss).
- **Deterministic branching only** — same state in, same decision out; "if in doubt, defer" is load-bearing.
- **Cold-start-safe** — read the state store every tick; nothing survives in memory (see [[scheduled-task-prompt]]).
- **It must actually be scheduled AND able to dispatch** — the two dormancy modes are distinct; see [[scheduled-task-liveness]] before declaring the loop live.
- Sanity caps: a pass emitting >100k output tokens is misbehaving — kill and inspect.

## Example invocation

> **Input:** "The loop hasn't produced a pass since yesterday — what's wrong?"
>
> **Output shape:** read `last_tick_at` → older than 2h ⇒ conductor down (check the schedule per [[scheduled-task-liveness]]); fresh ⇒ read the tick metrics — `stalled-replaced` entries, an empty queue ("fired 0" honestly), or a rejected pass with nudges pending. Diagnosis names which branch of step 1 fired, cited from the tick log.

## Compose with

[[scheduled-task-liveness]] (is it firing and CAN it fire) · [[loop-track-pass]] (the workers) · [[scheduled-task-prompt]] (cold-start rules) · [[dispatch-amend-in-flight]] (nudge mechanics)

## Origin

`docs/loop/prompts/L3-haiku-heartbeat.md` (STEP 1–4, quality gate, 4h stall rule) · `docs/loop/00-DESIGN.md` (failure-mode table, "the governor is deliberately dumb") · `docs/loop/RUNBOOK.md` (single-governor rule, sanity caps).
