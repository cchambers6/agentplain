# Pattern: dispatch send_message to amend an in-flight session

**Group:** orchestration · **Seeded by:** the fleet dispatch/orchestration layer (session send_message); memory: project_dept_fleet_ops_head_2026_07_03, project_loop_v3_nine_tracks.

## When to use — trigger phrases
- "the running agent needs a correction / new constraint" 
- "amend the in-flight pass without restarting it"
- a governor issuing a `corrective_nudge` to a live worker

## Inputs
- The target session/agent ID (from the dispatch or `list_sessions`).
- The amendment (a new constraint, a scope correction, a stop instruction).

## Procedure
1. Identify the live session (its agent ID from launch, or via `list_sessions`).
2. Send a **message to that session**, don't spawn a new one — the point is to preserve its accumulated context.
3. Keep the amendment self-contained (the session may be deep in its work): state the correction, why, and what to do differently now.
4. For loop workers, the durable channel is a `corrective_nudge` written to `state.yaml` for the track's *next* fire; use a live message only for something that can't wait a tick.

## Output
The running session absorbs the correction and continues with its context intact — no restart, no lost work.

## Guardrails
- **Amend, don't restart.** A new Agent call starts fresh and loses context; `send_message` (or SendMessage to the agent ID) continues the same session.
- **Self-contained amendments.** The session won't re-read your reasoning — say what changed and what to do, not "as discussed."
- **Prefer the durable channel for loops.** A `corrective_nudge` in `state.yaml` survives a cold start; a live message does not. Use live messages for urgency, nudges for correctness.
- Verify the message landed (a payload-oversize or dead session can silently drop it — see `payload-oversize-handling`).

## Worked example
The L3 heartbeat governor's design (`docs/loop/prompts/L3-haiku-heartbeat.md`) reconciles an in-flight pass and, on stall/drift, writes a `corrective_nudge` the next fire of that track consumes (step 2 of the worker skeleton) — the durable form of "amend in flight." For non-loop dispatches, continuing the existing session via its agent ID is the live form.
