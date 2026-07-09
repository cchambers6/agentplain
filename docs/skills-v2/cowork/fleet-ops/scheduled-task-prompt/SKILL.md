---
name: scheduled-task-prompt
description: Write a prompt for an unattended scheduled/cron agent that runs correctly from zero context. Use when scheduling any recurring or one-off automated pass with no human in the loop. Self-contained, cold-start-safe, idempotent — and it must fail clean rather than wait for input.
---

# Scheduled-task self-contained prompt

A scheduled fire has no conversation history and no operator present. The prompt must reconstruct everything from durable state, guard against double-fires, and never block on a human.

## What every scheduled prompt carries inline

1. **Which durable state to read first** — the state file, memory index, queue. Read it *every* fire; provider session memory is a speed-up, never a correctness dependency (`feedback_cold_start_safe_agents`).
2. **The standing frame** — paste the [[ratified-frame-preamble]]; don't reference a prior turn.
3. **The precise deliverable and its path** — plus the allowed write paths (the loop restricts commits to inert paths: `docs/journeys/`, `docs/profitability/`, `docs/loop/backlog/`, `memory/data/loop/`).
4. **The gates to run** before committing (voice-gate etc.).
5. **Commit + report convention** — message format, report-back shape.
6. **The memory-inbox block** — see [[librarian-inbox-rollup]]: observations append to INBOX; the Librarian formats.

## Rules

- **No "as we discussed."** Zero prior context exists. Historical facts come from explicit reads of durable files, cited by path.
- **Idempotent** — act only if the queue item is still open; a double fire must not double-write. (The loop governor is safe to double-*fire* precisely because step-1 reconciliation is built in — see [[heartbeat-governor]].)
- **Never AskUserQuestion / never wait for input.** An unattended task that blocks on a question wedges for hours (observed 2026-05-31). If it genuinely can't proceed: ship what it has, fail clean, report why.
- **Pass timestamps in** — ambient "now" isn't meaningful across resume; watch for typo'd IDs/paths in the prompt (a scheduled task once shipped with a typo'd session-UUID and an inline note telling the agent to go find the right one — silent no-op).
- **Design smells to reject at review:** "continue where we left off" (where is that state on disk?), "remember the user said X" (it's in the prompt or in memory, or it doesn't exist).
- **Verify it will actually run and can dispatch** — [[scheduled-task-liveness]], before calling it live.

## Example invocation

> **Input:** "Schedule the weekly kaizen fire."
>
> **Output shape:** a prompt that opens with `Read memory/data/... and docs/kaizen/<latest>/MASTER-IMPROVEMENT-PLAN.md`, pastes the ratified frame, names the exact output dir `docs/kaizen/<date>/`, lists the gates, ends with the report-back shape and the INBOX block — plus a liveness check note: first fire verified manually, `last_tick_at`-style stamp written each run. (Precedent for the check: kaizen silently skipped its 2026-06-28 fire.)

## Compose with

[[scheduled-task-liveness]] · [[heartbeat-governor]] · [[ratified-frame-preamble]] · [[librarian-inbox-rollup]] · [[report-back]]

## Origin

`docs/loop/RUNBOOK.md` + `docs/loop/prompts/TRACKS.md` (state-first prompts, allowed paths) · `feedback_cold_start_safe_agents` · `feedback_long_task_performance_2026_05_31` (rule 1: no AskUserQuestion — a completeness-audit task wedged on one for hours) · `docs/kaizen/2026-07-02/10-fleet-ops.md` (typo'd-UUID silent no-op).
