---
name: heartbeat-governor
description: Design a cheap, deterministic conductor that schedules other agents on a fixed cadence without doing their work. Use when building a loop conductor, a heartbeat, or any system that must fire the next pass, detect stalls, and issue corrective nudges. The conductor conducts; workers design.
---

# Heartbeat governor (conductor, not a worker)

A conductor that ticks on a fixed cadence (e.g. every 30 min), keeps exactly one worker moving, detects stalls, and never designs anything itself. Keep it cheap and deterministic.

## The three steps every tick

1. **Reconcile the in-flight pass** — is one running? Past the timeout (e.g. 4h)? Stalled? On clean completion, apply the quality gate. On stall or `drift`, write a **corrective nudge** to the state store for that track's next fire.
2. **Fire the next pass** by weighted rotation — keep any invariant track always-queued (e.g. CEO); apply a freshness cap (eligible if last-fired ≥ N hours ago or never); handle idle/empty branches explicitly.
3. **Write tick metrics** — update `last_tick_at`, record the tick.

## Rules (load-bearing)

- **Conductor conducts, workers design.** Keep it a state machine. Worker passes can run a strong model; the conductor can stay cheap (a small/fast model is fine).
- **It must actually be scheduled.** The classic failure: a governor is *designed* but left *unscheduled*, so the whole loop sits dormant. Verify the cron/schedule exists and fires.
- **Deterministic branching only** — same state in → same decision out (resume-safe, no creative latitude).
- **Cold-start-safe** — read the durable state store every tick; never rely on in-memory state surviving.
- **Silence must be safe** — the "nothing eligible" branch is explicit, not a crash.

## Origin

Loop v3's L3 heartbeat (`docs/loop/prompts/L3-haiku-heartbeat.md`). Its recurring, recorded risk across fleet-ops retros: the schedule was never wired (`#349 dormant`). Design the conductor *and* confirm it's on a cron.
