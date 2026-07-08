---
name: payload-oversize-handling
description: Reconcile a dispatch/launch call that returned an error — payload oversize, tool-response error, timeout — before assuming the session didn't start. A launch error is about the RESPONSE, not the spawn; the session often runs anyway. Verify via the session list; never double-dispatch on an unverified error.
---

# Payload-oversize / launch-error handling (verify via the session list)

The error you got back and the session you tried to start are different objects. Sessions frequently survive their own launch call erroring.

## Procedure

1. **Don't conclude failure from the error.** An oversize/tool-response error on the launch call often means the session **started and is running** — CoS Pass 1 landed as "PR #352 (retry)" precisely because the first dispatch "errored" while the session had actually started.
2. **Query the session registry** (`list_sessions` / `list_code_tasks`) for a live session matching the dispatch **before** any re-fire. This is the same reconciliation the loop governor runs every tick: state-claims are checked against the actual session list (`docs/loop/prompts/L3-haiku-heartbeat.md` STEP 1).
3. **Running → let it run.** Two competing sessions writing the same files is strictly worse than one slow one.
4. **Genuinely absent → re-fire with a trimmed payload:** move bulk context into a file the prompt *reads* (paths, not pasted walls); keep the prompt body lean. Prefer file-referenced context from the start so the oversize path never triggers.
5. **Session died mid-flight later?** Same tool: in-flight-claimed but missing from the list = died silently → re-queue its scope (the governor's 1c branch).

## Rules

- **A launch error ≠ no launch.** Registry first, always.
- **Never double-dispatch unverified** — the observed cost is forked work and state-file races.
- **Singleton tasks check the list before spawning** — the Librarian roll-up's charter requires a `list_sessions` check for an existing instance before it spawns (singleton constraint).
- Runaway detection is the flip side: a pass emitting >100k output tokens is misbehaving — kill and inspect (`docs/loop/RUNBOOK.md` sanity caps).

## Example invocation

> **Input:** "start_code_task returned a payload-too-large error — retry it?"
>
> **Output shape:** `list_sessions` → a session with the matching title/branch is live and 4 minutes old → answer: no retry; monitoring it; next dispatch will pass context by file path. (Or: no session found → re-fire with the brief's 3-page context moved to `docs/briefs/<slug>.md` and a one-line pointer.)

## Compose with

[[wait-gate-on-outcome]] (the artifact is the truth) · [[dispatch-amend-in-flight]] (talking to the live session) · [[heartbeat-governor]] (the institutionalized form) · [[orchestrator-prompt-hygiene]] (lean prompt bodies)

## Origin

`project_cos_pass1_2026_07_02` (PR #352 "retry" that had actually started) · `docs/loop/prompts/L3-haiku-heartbeat.md` STEP 1 reconciliation · Librarian singleton check: `docs/kaizen/2026-07-02/10-fleet-ops.md` baseline table.
