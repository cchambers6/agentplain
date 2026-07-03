# Loop health monitoring — how we know the heartbeat is doing useful work

**Scope:** the L3 governor + track passes (loop v3, PR #349) and the four Tier-1/2
scheduled tasks (Librarian, Watchdog, autofire, morning brief). Everything below is a
derivation over artifacts that already exist — `memory/data/loop/state.yaml`,
`pass_records`, `loop:` commits on main, `LIBRARIAN_LOG.md` — no new runtime.

## The core distinction: alive ≠ useful

The kaizen 10/10 retro proved the fleet can be perfectly *alive* and useless at the
same time: 185+ consecutive quiet Librarian passes at full cadence over a week-idle
repo, while the actually-load-bearing loop (autofire → dispatch) was down for 17 days.
So health is measured on two axes, and both must be green:

**Axis 1 — liveness** (is the machinery ticking?)

| Signal | Source | Green | Red |
|---|---|---|---|
| Governor tick freshness | `state.yaml: last_tick_at` | < 2h old | ≥ 2h → conductor down (precedent: kaizen skipped 06-28 unnoticed) |
| Pass in flight or recent | `pass_in_flight_session_id` + newest `pass_records` entry | a pass every 1–3h while any track eligible | > 6h with eligible queue items and no fire |
| Stall rate | `stalls_logged` | 0–1 per week | rising — passes dying mid-flight |
| Scheduled-task heartbeats | LIBRARIAN_LOG last entry; brief arrival | daily cadence unbroken | any task silent past 2× its cadence |

**Axis 2 — usefulness** (is the ticking producing deliverables that move profit?)

| Signal | Source | Green | Red |
|---|---|---|---|
| Deliverable rate | `last_pass_deliverables` per `pass_records` entry | every pass ≥ 1 typed deliverable | any `drift` verdict; two on one track = prompt problem, fix TRACKS.md via PR |
| Gate verdict mix | `pass_records.verdict` | mostly `accepted` | `rejected`/`accepted-with-nudges` trending up |
| Consumption | backlog cards (`docs/loop/backlog/`) vs merged PRs citing them | cards get picked up within ~a week | card count grows while merges don't — the loop is writing to a shelf |
| Track balance | `tracks[].passes_completed` | all tracks advance over a week | a track flat-lines (starved or always fresh-capped) — a strategy signal the CEO track reads, per the v3 failure table |
| Verdict honesty | depth passes re-verdicting `delivering: yes` claims | verdicts survive re-check | verdicts flip on re-check — L1 was hallucinating delivery (worst failure in the 00-DESIGN table) |

## What "drift" looks like, concretely

Drift is a pass that ran, spent the window, and left the business design no more
profitable. Recognizable forms, in observed-likelihood order:

1. **Analysis re-layering** — the pass produces another audit/retro/synthesis instead
   of a decision, fix spec, or action. Caught mechanically by the governor's
   `deliverable_ok` gate (v3's primary gate; this is the failure the v3 amendment
   exists to prevent).
2. **Re-litigating ratified ground** — proposing flatsbo dark, a stop condition, a
   pricing rename, a kill-list re-argument. Not machine-checkable in general; the
   ratified-decisions section of RUNBOOK + the Librarian's rule-conflict duty
   (`02-Librarian-evolution.md` N3) is the net.
3. **Verdict inflation** — `delivering: yes` without an opened code path. Only depth
   passes and human skims catch it; that is why depth passes re-verdict by design.
4. **Shelf-writing** — deliverables typed correctly but never consumed (usefulness
   table, row 3). This one is invisible per-pass and only shows in the weekly trend.
5. **State-vs-reality divergence** — state.yaml/WORKING_STATE claims (in-flight,
   merged, running) that no longer match git/PR reality. Precedent: two branches
   listed "in-flight NOT merged" for 13 passes after they merged (kaizen friction #2).

## What kicks Conner (tiered — repetition without escalation trains skimming)

| Tier | Condition | Channel |
|---|---|---|
| T0 silent | everything green; quiet passes | nothing (a healthy loop is boring) |
| T1 brief line | single drift verdict; a track flat-lining; verdict mix worsening | one line in the morning brief, with age |
| T2 brief ESCALATED block | governor down > 4h during the Fable window; 2+ drift verdicts on one track; security-class queue item past 3-day SLA; backlog cards untouched 7 days | dedicated top-of-brief block, item ages in days |
| T3 standalone ping | governor down > 12h; Jul-7 model decision unset by Jul 6 18:00 ET; security item past 2× SLA; a pass commits outside its allowed paths | Watchdog SendUserMessage, not the brief |

## Instrumentation (all derivation, no new services)

1. **`loop-health` block in WORKING_STATE**, refreshed by every Librarian pass:
   last_tick_at age, passes in last 24h, deliverables by type, drift count, per-track
   passes_completed delta, stall count. Source: state.yaml + `git log --grep '^loop:'`.
   The Librarian already reads both; this is a formatting duty, not a new capability.
2. **Per-pass cost stamp** into `memory/data/session-costs.yaml` at pass close-out
   (the pass writes its own row — `stampSessionCost` has zero call sites today, kaizen
   9/10). Needed for the post-Jul-7 cost table in `03-…transition-plan.md` to run on
   measurements instead of card-rate estimates; first week of `pass_records` is the
   calibration artifact the v3 RUNBOOK already names.
3. **Consumption tracker**: a Librarian-maintained count in the same loop-health block
   — backlog cards open vs cited-by-merged-PR. Cheap grep over `git log origin/main`.
4. **Escalation state machine** lives in the brief prompt (T1→T3 above); the only new
   write is the Watchdog's T3 ping conditions, which stay within its message-only
   charter.

Acceptance: given the artifacts of any past week, a fresh session can compute every
row of both tables from sources named here, and every T2/T3 escalation is traceable to
one row.
