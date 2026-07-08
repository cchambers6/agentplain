---
name: scheduled-task-liveness
description: Verify a scheduled/autonomous task is actually alive in all three senses — scheduled at all, able to dispatch (not triage-only), and distinguishable from a starved queue. Use before declaring any loop or cron "live," when a scheduled system goes quiet, or when a task can read state but its fires never start work. Silent non-execution is the fleet's dominant failure mode.
---

# Scheduled-task liveness — the three dormancy modes

A designed conductor that never fires does nothing, and each way it fails is silent. Check all three before calling a scheduled system live — and again whenever it goes quiet.

## Mode 1 — never scheduled

The classic: loop v3 shipped **dormant** (PR #349) with the governor designed but no scheduled task wired; kaizen's weekly fire was skipped on 2026-06-28 and nobody noticed. **Check:** the schedule exists in the scheduler (not just in a doc), and `last_tick_at` in the state store is fresher than ~2× the cadence. A kill-switch variable (e.g. a repo `USE_*_CRON` flag) counts as part of "scheduled" — it once sat false for 5+ days blocking every leadership cron (`feedback_leadership_runs_autonomously`).

## Mode 2 — scheduled but cannot dispatch (triage-only)

The subtle one: the task fires, reads state, triages… and **cannot start work**, because its environment doesn't expose the dispatch tools. Recorded twice:
- Dispatch MCP unreachable from scheduled-task VMs for **17 days** (from 06-15); auto-fire degraded to a `pending-fires.yaml` file-bridge that only converts to work "on Conner's next message" — a human bottleneck inside the loop built to remove one (`docs/kaizen/2026-07-02/10-fleet-ops.md` friction-3; memory `project_autofire_cannot_fire_dispatch_mcp_disconnected_2026_06_15`).
- The coordination plan made it a **blocking pre-check**: "Engineering confirms the scheduled-task environment exposes dispatch tools… Governor must not be N1-dormant on arrival; hard check before Jul 7" (`docs/departments/2026-07-03/COORDINATION/00-UNIFIED-14D-PLAN.md` §0.11).

**Check:** run one manual pass from the *scheduled environment* proving it can (a) read the state store, (b) call the session-list/launch/stop trio, (c) write state back. `allowed_tools` on the task must include the dispatch trio by the runner's actual tool names.

## Mode 3 — alive but starved (and you can't tell)

Auto-fire logged "fired 0, $0 spent" honestly for six consecutive runs — but "0 eligible" and "seeder dead" produce **identical run reports**; the queue seeder had in fact stopped feeding while manual audits were surfacing 11+ P0s (`docs/kaizen/2026-07-02/10-fleet-ops.md` friction-7, win-4). **Check:** every consumer with a feeder gets a feeder-health line in its report ("queue last grew at T"); N consecutive zero-fires with a stale feeder is an alert, not a no-op.

## Rules

- **Liveness is proven by a fire, not by design docs.** "First manual pass verified" is the acceptance test.
- **Graceful degradation still fails the autonomy bar** — the file-bridge fallback was good engineering and still left the loop human-gated for 17 days. Surface degraded mode loudly; don't let it become the steady state.
- **Every tick writes `last_tick_at`** — the canary that separates "conductor down" from "nothing eligible" ([[heartbeat-governor]]).

## Example invocation

> **Input:** "Is the loop governor live?"
>
> **Output shape:** three-line verdict — schedule exists + kill-switch on (mode 1 ✔/✘, cite the scheduler entry) · dispatch trio proven from the scheduled env (mode 2 ✔/✘, cite the manual pass) · feeder fresh (mode 3 ✔/✘, cite queue growth timestamp). Any ✘ → the single unblocking action, named.

## Compose with

[[heartbeat-governor]] · [[scheduled-task-prompt]] · [[wait-gate-on-outcome]] (liveness judged by observed fires) · [[report-back]]

## Origin

`project_loop_v3_nine_tracks_2026_07_03` ("governor task STILL unscheduled") · `docs/departments/2026-07-03/COORDINATION/00-UNIFIED-14D-PLAN.md` §0.11 + §2.9 ("silent non-execution is the fleet's dominant failure mode") · `docs/kaizen/2026-07-02/10-fleet-ops.md` friction-3/friction-7/win-4/win-6.
