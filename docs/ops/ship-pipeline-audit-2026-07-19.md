# Ship-pipeline audit — why improvements stopped shipping (2026-07-19)

Fired by Conner's "why are improvements not shipping" ask. Every claim below was
re-derived live on 2026-07-19 (19:40–20:30Z) from scheduler state files, git object
stores, and session transcripts — not from memory recall. Where a prior memory claim
was wrong, the correction is noted.

## The one-sentence answer

Nothing in the autonomous ship pipeline can currently convert "work identified" into
"PR opened" without a human in the loop: the L3 loop governor was deployed into a
runner that can neither dispatch sessions nor write state (≈800 no-op ticks over
17 days), the audit-queue autofire has computed fire-eligible = 0 for 68 consecutive
runs while its only fire path stayed untested, and the schedulers on both machines
silently drop enabled tasks — so the pipeline's own failure never surfaced.

## The two-scheduler map (nobody had written this down)

| Instance | Store | Tasks | Runner capabilities |
|---|---|---|---|
| Fleet Cowork desktop (`Claude_pzs8sxrjxfjjc` package) | `local-agent-mode-sessions/e96926c9…/3e6a77a8…/scheduled-tasks.json` + prompts in `C:\Users\conne\Claude\Scheduled\` | `agentplain-loop-heartbeat`, `agentplain-librarian-rollup`, `agentplain-watchdog`, `agentplain-audit-queue-autofire`, `agentplain-morning-brief`, `chiron-demo-readiness-watchdog`, `dispatch-journal-daily-sweep` (dead) + 12 disabled one-shots | **No** dispatch tools, **no** writable repo (mount `C:\agentplain` pinned to `plan/production-growth-2026-06-03`) |
| Claude Code desktop (this app) | `C:\Users\conne\.claude\scheduled-tasks\` | 14 flatsbo-*/agentplain-* fleet tasks | Full git + push token + PR REST recipes — **repo-write capable** (probe result below) |

The 2026-07-19 memory files the fleet wrote live in the fleet memory dir
(`…/3e6a77a8…/agent/memory/`), not in the Claude Code project memory — an auditor
reading only one side sees half the picture.

## Ranked findings (live evidence per item)

1. **L3 loop: governor ticking, zero passes ever fired by it.** `state.yaml` on main
   (`5606114b`): `pass_number: 1`, `last_tick_at: null`, 6 of 9 tracks
   `passes_completed: 0`; scheduler shows `agentplain-loop-heartbeat` `*/30`,
   `lastRunAt 2026-07-19T19:37:02Z` — ticking. Causes: (a) runner has no
   `start_code_task` (verified absent by the 12:09Z tick's own ToolSearch probe);
   (b) runner cannot write main (stale pinned mount); (c) deployed task text was
   stale v2 with an expired 2026-07-07 stop branch that the committed v3 spec
   forbids. Class: **registered, fires, cannot act** — dormancy mode 2. Also lost
   35 of ~96 ticks in the 48h to 19:37Z to `global_limit` scheduler skips
   (`recordedSkips`).
2. **`dispatch-journal-daily-sweep`: enabled, dead 65 days, root cause found.** Its
   `SKILL.md` was deleted from `C:\Users\conne\Claude\Scheduled\` (~2026-05-15 cohort
   purge; every other May-era task dir is gone too). The scheduler keeps
   `enabled: true` and refreshes `nextRunAt` but silently no-ops on a missing prompt
   file. Class: **registered, dispatch attempted(?), launch silently fails** — new
   dormancy mode 4. Fixed 2026-07-19 with a tombstone `SKILL.md` (visible no-op);
   deletion queued for Conner.
3. **Autofire: 68 consecutive "fired 0" runs — but the blocker never bound.** Task
   healthy (`lastRunAt 17:02Z`, 4×/day). Every run computed
   fire-eligible-and-not-in-flight = 0 (eligible items merged as #276/#277, rest are
   Conner-gated guardrails or below the 4/5 customer-value bar). The missing
   `start_code_task` is real; the "therefore no fire path exists" conclusion was
   never tested. Class: **registered, fires, starved feeder + untested fire path**
   (modes 3 + 2). Fire-path probe result below.
4. **This machine's scheduler drops tasks too.** During today's 19:35Z and 19:51Z
   catch-up bursts it fired six tasks (some off-schedule) but skipped
   `agentplain-audit-queue-seeder-local` (`*/30`, `lastRunAt 2026-07-12`, `nextRunAt`
   already in the past), `flatsbo-conner-decision-package-morning` (daily,
   `lastRunAt 2026-07-12`), and `agentplain-weekly-kaizen` (missed its Sunday
   2026-07-19 slot entirely; `nextRunAt` jumped to 07-26). All three SKILL.md files
   exist — this is a different mechanism from finding 2 and is unexplained; the new
   liveness watchdog (below) will catch recurrences.
   **4b. Scheduled sessions on this machine run in `C:\business`** — the archived
   RecoverAI folder. Verified from three 19:51Z run transcripts (all landed under
   `~/.claude/projects/C--business/`, e.g. `flatsbo-b2b-sales-rep-daily-reply-sweep`
   session `ae2b58ed…`). Every flatsbo-* scheduled task has been executing with the
   wrong working directory and the wrong project memory; tasks with fully absolute
   paths in their prompts survive this, anything relying on cwd or project memory
   does not. Likely a stale app-level default-folder setting from the RecoverAI era.
5. **Stale-memory false alarms retired.** (a) `chiron-demo-readiness-watchdog` is
   healthy — fired 16:03Z and 18:04Z on 2026-07-19 (correct blackout self-skips);
   the "never fired" memory line was corrected in place. (b) The overnight
   2026-07-19 Fable session **did finish green** (transcript ended 05:17Z: prod
   deploy verified, 6 P0s fixed, demo runbook written) and its
   `docs/demo/2026-07-19-morning-status.md` **is on flatsbo origin/main**
   (commit `5015fb4`) — the "doc does not exist" observation checked a stale local
   working tree. Same fallacy the Librarian documented: a stale checkout does not
   mean the tree is unreadable.

## Fire-path probe (the untested claim, tested)

One-shot task `fire-path-probe-2026-07-19` created on the Claude Code scheduler at
19:50Z, fired 19:52Z. It attempted, from a scheduled-task-spawned session, using
plumbing only (no working-tree contact): fetch → `commit-tree` off `origin/main` →
push to `probe/fire-path-2026-07-19` → independent API verification.

**Result — the chain fails at DISPATCH, not at repo-write.** As of 20:18Z (26+ min
past `fireAt`, task still `enabled` with no `lastRunAt` and no session transcript
anywhere on disk), the one-shot was never dispatched — while the same scheduler
dispatched six other task sessions at 19:51Z and other sessions in the same window.
That is a live reproduction of the silent-drop failure on a freshly created
one-shot. Two conclusions:

- **Repo-write from this runner is PROVEN** — this audit session (same environment
  a dispatched task session gets) pushed and remote-verified
  `fix/ship-pipeline-scheduler-audit-2026-07-19` (`63598f0`) during the same window.
- **The scheduled-task fire path remains UNPROVEN end-to-end**, and the weak link is
  now identified: dispatch reliability, not session capability. Until one-shot
  dispatch is shown reliable, `create_scheduled_task` must NOT be adopted as the
  autofire fire mechanism — a fire that silently never dispatches is
  indistinguishable from no fire, which is precisely the failure mode this audit
  exists to kill. If the probe fires late, its artifact
  (`.fire-path-probe-result-2026-07-19.md` in the Claude Code agentplain project
  memory dir) and the `probe/fire-path-2026-07-19` branch supersede this paragraph
  for the session-capability half only.

## What was changed on disk (2026-07-19)

- Fleet heartbeat task text regenerated v3-conformant (backup:
  `SKILL.md.pre-20260719-v2text`): reads state via `git show origin/main:…`, probes
  dispatch, and exits silently when nothing changed — ends the
  4-KB-DEFERRED-block-per-tick spam; fires only per the committed spec if the
  runner constraint ever lifts.
- `dispatch-journal-daily-sweep` tombstone SKILL.md written (visible no-op pending
  deletion).
- Fleet memory `project_scheduler_silently_drops_enabled_tasks_2026_07_19.md`
  corrected in place (watchdog-healthy correction + mode-4 root cause).
- This repo: RUNBOOK runner-requirements section + liveness skill mode 4 (this PR).
- Claude Code scheduler: `scheduler-liveness-watchdog` (daily) added — three-way
  `lastRunAt` check + prompt-file existence across BOTH schedulers, surfacing dead
  tasks instead of letting them rot silently; `agentplain-loop-governor` staged as a
  manual-only (ad-hoc, unscheduled) task in the repo-write-capable runner, pending
  Conner's go decision.

## Conner's queue (exact minimal actions)

1. **Decide the loop's runner + model** (`l3-loop-inert-needs-runner`, standing since
   12:09Z): say GO and the staged `agentplain-loop-governor` task gets its `*/30`
   cron in the capable runner — after its first manual acceptance pass — and the
   fleet-side `agentplain-loop-heartbeat` gets disabled (never run two governors).
   Also confirm `pass_model` (RUNBOOK Option A/B; Fable window closed 07-07).
2. **Delete `dispatch-journal-daily-sweep`** in the fleet Cowork task UI (tombstoned,
   safe meanwhile).
3. **Revoke/rotate the plaintext PAT in `C:\agentplain\.git\config`**
   (`revoke-flatsbo-pat`, queued since the 582nd roll-up — still open).
4. Optional: click "Run now" once on `scheduler-liveness-watchdog` to pre-approve its
   tools so future runs never pause on permission prompts.
5. **Fix the scheduled-run working directory** on the Claude Code desktop app —
   scheduled sessions currently start in `C:\business` (archived RecoverAI), finding
   4b. Point the default at `C:\flatsbo` (or per-task folders) in the app settings.
