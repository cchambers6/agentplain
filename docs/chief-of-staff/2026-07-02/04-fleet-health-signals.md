# Fleet health signals — how the machine that builds the business is running

**Green/yellow/red per subsystem. Every signal cites its artifact; nothing here is a vibe.**

## GREEN — working as designed

- **Truth discipline.** All ten kaizen retros corrected their own briefs rather than laundering
  claims; claims trace to `file:line`; "DATA MISSING" instead of invented numbers (kaizen
  MASTER §1.1). This is the fleet's strongest cultural asset.
- **Forward-fix discipline.** Zero reverts in 60 days / 667 commits; incidents become durable
  gates (pre-push build gate, `VERCEL_ENV` migrate gate, #277 dispatch-coverage gate) (kaizen
  MASTER §1.2).
- **The approval spine.** 100% approval-gate coverage on all 10 mutating connectors, held under
  hostile audit; autofire held guardrail items for Conner even at 4/5 scores (kaizen MASTER
  §1.4; audit 4: zero P0s).
- **The Librarian loop.** 109 consecutive on-schedule roll-ups, INBOX fully drained, backup
  discipline observed (`WORKING_STATE.md` 2026-07-03 20:36Z). The memory substrate is the most
  reliable component in the fleet.

## YELLOW — degraded, functioning on fallback

- **Production capacity vs landing capacity.** June audit findings re-confirmed **verbatim** in
  July because fixes never merged; 4 of 20 July audits weren't pushed when synthesis ran (audit
  MASTER pattern 5; CEO Pass 1 `00`, Team). The fleet out-produces its own merge throughput —
  the core imbalance every July document circles.
- **Session reliability.** The first CoS pass (`local_b37ce9e4`) received its prompt and died
  before turn 1, producing this retry. One observed instance — but silent zero-output death is
  the worst failure mode a fleet session can have, because nothing downstream notices. Worth a
  cheap watchdog: any leadership-tier session that ends with zero commits/PR writes a one-line
  INBOX entry, so the Librarian's next roll-up flags it instead of a human.
- **Workspace hygiene.** Primary checkout `C:\agentplain` sits on a stale HEAD (a4a8429; main
  is d95d279) with ~30 untracked worktree dirs and one-off scripts (git status, this session);
  the memory mount carries ~260 `WORKING_STATE.md.preXXXX` snapshots (`WORKING_STATE.md`
  hygiene note). Noise, not damage — but it taxes every session's situational awareness.
- **Directive coherence.** Two open PRs give contradictory standing orders (#349 run-9-tracks
  vs #350 freeze-the-loop — `02-redundant-work.md` §3), and memory carries superseded-but-live
  tensions (e.g., a 2026-06-12 "Fable 5 disabled, calls error on turn 1" reference alongside
  the 2026-07-02 "Fable is default" rule — this session ran on Fable 5, so the former is stale
  for fleet use and should be scoped to customer-facing surfaces or retired). Sessions obeying
  different layers of memory will diverge.

## RED — broken or never wired

- **Dispatch MCP: unreachable 17+ days.** Autofire scores work and fires nothing; file-bridge
  fallback carries everything (kaizen 10-fleet-ops; `WORKING_STATE.md` 2026-07-03: "Dispatch
  MCP still UNREACHABLE"). The fleet's self-driving tier is running with the engine
  disconnected from the wheels.
- **Cost telemetry: NULL for three straight weeks.** `stampSessionCost()` has zero call sites;
  `budget-state.yaml` week-to-date reads NULL (kaizen 07, 09). The business's largest real
  outflow — fleet tokens — is invisible to itself. Fix is wave item 5, fleet-executable.
- **Loop governor: never scheduled.** `agentplain-loop-governor` scheduled task not created;
  `state.yaml` `last_tick_at: null` (PR #350 `04` §1). The journey loop has run exactly one
  manually-fired seed pass; the continuous system exists only on paper.
- **The repo Conner queue: zero rows ever.** The YAML decision-surfacing layer never received
  a write while a parallel queue lived on the memory mount (`02-redundant-work.md` §2). The
  single most important interface in the company — fleet→founder — was split-brained and
  half-empty.
- **CI: gates are local-only.** 14 of 17 recent CI failures were schema-drift; brand/voice/
  vendor gates run at pre-push (skipped in fresh worktrees) with no server-side floor (kaizen
  01, 03; `feedback_prepush_gate_skipped_fresh_worktrees`). Every invariant the fleet relies
  on is enforceable by honor system until wave item 4 lands.

## The one-line health read

The fleet's *product* muscles (truth, safety, forward-fix) are genuinely strong; its
*metabolism* — landing what it produces, seeing what it spends, routing decisions to the one
human — is the weak system, and all five RED items are metabolism. The 14-day sequence in
`00-fleet-sequence` is, deliberately, a metabolism repair plan.
