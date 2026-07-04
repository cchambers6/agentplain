# Fleet Ops — Head of Department plan, 2026-07-03 → 2026-07-17

**Role:** keep the fleet running so no manual re-fire, stuck PR, or rotted queue eats
Conner-time. The CEO lever this week is five design-partner emails on Monday
(`docs/ceo/2026-07-02/`); fleet-ops' contribution is that Conner spends zero minutes
babysitting agents while he sends them.

**Operating frame (ratified 2026-07-03):** no new audits, retros, or planning layers —
the 2026-07-02 cycle produced the analysis; fleet-ops executes. The loop designs FOR
profitable and never stops (PR #349, v3). flatsbo stays live. Fable window closes
2026-07-07 — burn it now, switch models deliberately.

## The one-line diagnosis

The fleet's dominant failure mode is **silent non-execution, not bad execution**. The
evidence is consistent: dispatch MCP unreachable 17+ days while every doc assumed the
autonomy loop worked (kaizen 10/10 friction #3); the weekly kaizen skipped 2026-06-28
unnoticed (RUNBOOK failure table); autofire fired 0 for weeks with no way to tell
"queue empty" from "seeder dead" (friction #7); the loop-v3 governor task is designed,
seeded, and **still unscheduled** — PR #349 lands dormant. Everything in this plan
attacks that failure mode.

## 14-day plan

### Days 0–2 (Jul 3–5): make the loop actually run, at Fable-max

1. **Land PR #349** (loop v3). It is docs + state only; nothing runtime. Blocker for
   everything below.
2. **Create the `agentplain-loop-governor` scheduled task** per
   `docs/loop/RUNBOOK.md` § Scheduled task — the loop has never had a conductor. This
   is the single highest-leverage fleet-ops action of the fortnight: every un-fired
   pass before Jul 7 is free Fable capacity discarded.
3. **Manual-fire the first pass immediately** (RUNBOOK § Manual-fire recipe) rather
   than waiting for the first tick, and verify the pass close-out writes state.yaml
   correctly. One verified pass proves the whole read/gate/fire path.
4. Stand up the loop-health signals from `01-loop-health-monitoring.md` (they are
   derivations over state.yaml + `loop:` commits, not new infrastructure).

### Days 2–4 (Jul 5–7): the model transition, executed not defaulted

5. Execute `03-post-Jul-7-model-transition-plan.md`: the recommended Option B-plus
   split (strategic tracks on Opus 4.8, mapping tracks paused-with-queues-intact,
   governor stays Haiku) is a two-line state.yaml edit with a default that fires
   even if Conner says nothing. The trap named in the v3 RUNBOOK — window closes,
   passes keep firing Fable at usage-credit rates — must not happen by default.
6. Librarian gets a one-time Jul-6 nudge duty: surface the transition decision with
   the default attached (see `02-Librarian-evolution.md`, nudge class N4).

### Days 4–14 (Jul 7–17): hygiene that compounds

7. **Librarian evolution phase 1** (`02-Librarian-evolution.md`): hydrate the YAML
   layer from primary sources every pass (kills the `week_to_date_usd: null` class of
   rot — three consecutive weeks stale per kaizen 10/10 friction #1), and start
   writing corrective nudges for the drift classes it can verify mechanically.
8. **Memory hygiene follow-ups** from `04-memory-rules-audit.md`: land the four
   missing canonical rule files the loop docs already cite, stamp the superseded
   recommendation inside the direction-check memory, reconcile the fleet-token
   recipe contradiction (verified this session: the minter exists), and let the
   Librarian's decay sweep demote the June sprint ledgers.
9. **Stop list** (`06-what-fleet-ops-must-stop.md`) applied: prune the 264
   WORKING_STATE snapshots, retire spent one-shot scheduled tasks, no new
   analysis layers.
10. Escalation SLAs live in the brief: security-class Conner-queue items past 3 days
    move to a top-of-brief ESCALATED block (the flatsbo PAT sat 23 days unrevoked
    while listed daily — kaizen 10/10 friction #5; it is now Conner action #1 per
    the CoS pass).

## What I am explicitly not doing

No new audit of anything. No new retro. No new planning layer. No re-diagnosis of the
41 pre-existing test failures on main (documented in the send-path wave, PR #355). No
re-litigating ratified rulings: kill list stands, flatsbo stays live, the loop has no
stop condition, pricing tiers are locked.

## Acceptance for this plan (checked at the 2026-07-17 mark)

- Governor task exists and `last_tick_at` in `memory/data/loop/state.yaml` is never
  more than 2h stale across the window.
- ≥ 8 Fable passes complete before the Jul-7 window closes (governor fires them
  back-to-back; pass runtime is the only limiter).
- Jul 7 passes with `pass_model` (and track pauses) set by explicit decision, with a
  dated note in state.yaml — not by default.
- `memory/data/*.yaml` files are each ≤ 24h older than their newest reachable primary
  source (kaizen improvement #1 acceptance, unchanged).
- Zero manual re-fires performed by Conner; zero security-class queue items past SLA
  without a standalone notification.
- The four missing rule files exist; the direction-check supersession stamp is in.

Companion docs: `01` loop health · `02` Librarian evolution · `03` model transition ·
`04` memory audit · `05` asks of other heads · `06` stop list · `07` profit
contribution.
