---
name: dispatch-amend-in-flight
description: Correct a running agent session without restarting it — send_message to the live session for urgent amendments, or a durable corrective_nudge in the state store for the track's next fire. Use when a running pass needs a new constraint, a scope correction, or a stop. Amend, don't respawn; pick the channel by urgency vs durability.
---

# Amend an in-flight session (live message vs durable nudge)

A new Agent/dispatch call starts fresh and loses the session's accumulated context. Two amendment channels exist; choosing wrong either loses the correction (live message to a session that dies) or delays it a tick (nudge when it can't wait).

## The two channels

| Channel | Survives cold start? | Latency | Use for |
|---|---|---|---|
| **Live `send_message`** to the session ID | No | immediate | urgent stop/redirect that can't wait a tick |
| **`corrective_nudges` entry** in the state store | Yes | next fire of that track | quality corrections, added constraints |

The loop's design makes the durable channel primary: the governor **never edits worker output** — it writes nudges "the NEXT pass (which has judgment) must address," and each pass must mark its nudges `status: consumed` before doing new work. Stop messages are the sanctioned live use: a ≥4h-stalled session gets `send_message` (stop) + its scope re-queued.

## Procedure

1. Identify the live session (dispatch ID or the registry — see [[payload-oversize-handling]]).
2. Pick the channel by the table. When both apply, write the nudge AND send the live message referencing it.
3. **Self-contained amendment** — the session won't re-read your reasoning: state what changed, why, and what to do differently *now*. Never "as discussed." **Never start it with a `/word`** — same slash-command interception as launch prompts ([[orchestrator-prompt-hygiene]]): a resume nudge beginning `/goal` gets swallowed and the session sees nothing.
4. Verify it landed: the session's next visible action (or the nudge's `consumed` mark) is the receipt — a dead session silently drops live messages.

## Rules

- **Amend, don't restart** — restarts forfeit context and fork files.
- **Durable for correctness, live for urgency.** A live-only correction to a track that cold-starts next fire is lost.
- **One nudge per failure**, written at gate time (`accepted-with-nudges` verdict), not batched into prose.
- **Nudges are consumed, not just read** — unmarked nudges re-fire; that's the idempotency guard.

## Example invocation

> **Input:** "The running L1 pass is mapping the wrong persona — fix it without losing its two hours of work."
>
> **Output shape:** nudge written to `state.yaml` (`target: L1, note: scope is <persona-B> per queue item N, status: pending`) + live message to the session: "Scope correction: queue item N names persona-B, not persona-A. Keep your stage-map work; re-target the persona section. Nudge <id> filed — mark it consumed." → next tick confirms consumed.

## Compose with

[[heartbeat-governor]] (who writes nudges) · [[payload-oversize-handling]] (finding the session) · [[orchestrator-prompt-hygiene]] (message format traps) · [[loop-track-pass]] (who consumes them)

## Origin

`docs/loop/prompts/L3-haiku-heartbeat.md` (STEP 1b stop message; QUALITY GATE nudge verdicts) · `docs/loop/prompts/L1-journey-mapper.md` (consume-and-mark preamble) · `docs/loop/00-DESIGN.md` ("quality problems are fixed by the smart layer, one pass late, rather than badly by the cheap layer immediately").
