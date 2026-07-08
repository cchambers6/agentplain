# Pattern: scheduled-task self-contained prompt

**Group:** fleet-ops · **Seeded by:** the loop RUNBOOK + scheduled fire prompts (`docs/loop/RUNBOOK.md`, `docs/loop/prompts/*`); memory: feedback_cold_start_safe_agents.

## When to use — trigger phrases
- "schedule this to run every N / at time T"
- "a cron agent" / "an unattended pass"
- any prompt that fires without a human in the loop and without prior conversation context

## Inputs
- The task, and everything it needs to run **from nothing**: which state file to read, the ratified frame, the exact deliverable, the commit/report convention.

## Procedure
1. Write the prompt as if the agent has **zero prior context** — because a scheduled fire does.
2. Include, inline: (a) which durable state to read first (`state.yaml`, memory index), (b) the ratified-frame preamble, (c) the precise deliverable and where it goes, (d) the gates to run, (e) how to commit / report back.
3. Never reference "as we discussed" or a prior turn — there isn't one.
4. Make it **idempotent** — a double-fire should not double-write (read state, act only if the queue item is still open).

## Output
A prompt that produces correct work on a cold fire, with no operator present.

## Guardrails
- **Cold-start-safe** — durable state is read on every fire; nothing is assumed in memory (memory: feedback_cold_start_safe_agents).
- **Self-contained** — the prompt carries its own context; a scheduled task has no conversation history to lean on.
- **Idempotent** — guard against double fires via the state queue, not luck.
- **Verify it's actually scheduled** — see `heartbeat-governor-conductor`; a designed-but-unscheduled task is dead weight.
- Pass timestamps *in* — a scheduled script can't rely on ambient "now" being meaningful across resume.

## Worked example
The loop worker prompts (`docs/loop/prompts/TRACKS.md`) open by reading `memory/data/loop/state.yaml` and re-deriving scope from the queue — precisely so a 30-minute cold fire produces a correct pass with no operator. The RUNBOOK bakes the ratified frame and commit convention into the prompt so nothing depends on conversation context.
