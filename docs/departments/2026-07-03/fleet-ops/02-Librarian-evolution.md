# Librarian evolution — from roll-up to corrective nudger

**Today:** the Librarian (charter: `memory/LIBRARIAN_CHARTER.md`) is a rollup-only
singleton — drain INBOX, refresh WORKING_STATE, maintain the YAML layer, claim
pending fires, decay-sweep. It observes and records; it never corrects. The kaizen
10/10 retro showed the cost of that: YAML rotted for 17 days, a stale in-flight table
propagated through 13 passes, and the same 5 queue items were re-listed daily while a
leaked PAT aged to 23 days.

**Next step:** the Librarian writes **corrective nudges** — targeted, evidence-cited
notes that the systems it watches are drifting — while keeping every hard line in its
charter. The loop v3 design already has the receiving slot: `corrective_nudges` in
`memory/data/loop/state.yaml`, consumed by the next pass on the targeted track. This
evolution gives that channel a second author (today only the governor writes it).

## Invariants that do not move

- **Never fires work.** No session spawning, no `start_code_task`. A nudge is a file
  write; acting on it belongs to the governor, the Dispatch parent, or a pass.
- **Only writes what it can verify mechanically.** Every nudge carries the check that
  produced it (a git command, a file mtime, a diff). No judgment calls — judgment
  stays in the expensive layer, exactly the governor/pass split from 00-DESIGN.
- **Append-only on shared queues**, per the pending-fires discipline already in the
  charter.
- **Bounded:** max 3 nudges per pass, one open nudge per (class, target) — a nudge
  that isn't consumed gets its age incremented, not a duplicate.

## Nudge classes (phase 1 — all mechanically checkable)

| # | Class | Trigger check | Target | Nudge content |
|---|---|---|---|---|
| N1 | **Dormant conductor** | `state.yaml: last_tick_at` > 2h old, or the governor scheduled task absent while `tracks` has eligible queue items | WORKING_STATE `loop-health` + T2/T3 escalation per `01-…monitoring.md` | "governor silent since {ts}; {n} eligible items waiting" |
| N2 | **State-vs-reality divergence** | for every branch/PR WORKING_STATE or state.yaml calls in-flight: `git merge-base --is-ancestor` / PR REST state says otherwise | dated STATUS CORRECTION in the affected memory file (the 06-18 precedent, now systematic) + nudge to `chief-of-staff` track | "claimed in-flight, actually merged {date} — correct downstream copies" |
| N3 | **Rule conflict / superseded rule live** | two memory files assert incompatible rulings (detected during INBOX merge or decay sweep), or a doc cites a memory slug that does not exist on disk | Conner queue (conflicts needing ratification) or `chief-of-staff` nudge (missing-file follow-ups) | per charter: < 80 words, action-oriented |
| N4 | **Deadline with a default** | a dated decision (e.g. Jul-7 `pass_model`) is unset within 24h of its date | T3 standalone ping duty + brief ESCALATED block | "decision {x} unset; default {y} applies at {ts} per {doc}" |
| N5 | **YAML staleness** | any `memory/data/*.yaml` > 24h older than its newest reachable primary source | self-correcting: the pass **hydrates** rather than nudges (below) | — |

## Hydration (the N5 fix is doing, not nudging)

Adopting kaizen 10/10 improvement #1 as charter duty: each roll-up pass derives the
data layer from primary sources instead of waiting for INBOX reports — merged-PR count
and cadence from `git log origin/main`, open-PR state from the REST API it already
uses, session costs from pass close-out stamps (`01-…monitoring.md` § instrumentation
2). Acceptance is unchanged from the retro: no `data/*.yaml` more than 24h older than
its newest reachable source; the next re-tier audit runs on real numbers after two
aborts for lack of them.

## Drift-pattern priority — what to catch first

**N1, dormant conductor.** The fleet's record shows its worst losses came from
machinery that silently wasn't running, while looking fine: dispatch unreachable 17
days; the weekly kaizen skipped unnoticed; autofire firing 0 into a starved queue with
no seeder heartbeat; the v3 loop itself shipping with its governor unscheduled. A
drifting pass wastes one pass; a dormant conductor wastes every pass it never fired —
during the Fable window that is the single most expensive failure available to us, and
it is also the cheapest to detect (one timestamp compare). N2 (state-vs-reality) is
second: it is the failure that *hides* N1, because a stale WORKING_STATE keeps
asserting the loop is fine.

## Rollout

1. **Phase 1 (this fortnight):** N1 + N5-hydration + N2 on the branches/PRs already
   listed in WORKING_STATE. Charter amendment PR adds the nudge duties and bounds;
   the scheduled task prompt gets the same edit (the two copies must move in
   lockstep, per the charter's own sync note).
2. **Phase 2 (after one clean week):** N3 rule-conflict scanning folded into the
   decay sweep; N4 deadline registry seeded with the Jul-7 entry.
3. **Not in scope:** anything requiring judgment about content quality — that stays
   with the governor's gate and depth passes. The Librarian never gains opinions,
   only checks.

Cost: each check is a git/REST call the roll-up already makes or a file mtime read —
inside the existing $0.50/run cap. If a pass would exceed the cap, hydration wins and
nudge scanning defers to the next pass.
