# Fleet sequence — next 14 days (2026-07-03 → 2026-07-17)

**Chief of Staff lens, Pass 1 (retry of the killed 07-02 session). Sources: CEO Pass 1 (PR #348
branch `ceo/pass-1-2026-07-02`), direction check (PR #350 branch
`planning/direction-check-2026-07-02`), loop v3 spec (PR #349 branch
`loop/expansion-multi-track-2026-07-03`), kaizen master (`docs/kaizen/2026-07-02/
MASTER-IMPROVEMENT-PLAN.md`), audit master synthesis (`docs/audits/full-audit-2026-07-02/
MASTER-SYNTHESIS.md`), live `WORKING_STATE.md` + `conner-queue.yaml` on the fleet-memory mount,
live GitHub open-PR list (verified 2026-07-03). Every dated claim below cites one of these.**

## The sequencing principle

Four independent July documents converge on the same five fixes and the same first send
(see `02-redundant-work.md` §1). The CoS ruling is therefore not "what to do" — that question
is over-answered — but **enforcement of order**: land the decision-carrying docs, fire the one
fix wave everything agrees on, put the human decisions in one queue, and let nothing else
schedule until those three are done.

## Days 0–2 — land what's in flight, park what conflicts

1. **Merge PR #348 (CEO Pass 1) and PR #350 (direction check).** Both are docs-only,
   ready-for-review, and decision-carrying; every downstream track (including loop v3's `ceo`
   track, which reads "the newest prior CEO output") currently has to read them off branches.
   Unmerged strategy is unenforceable strategy.
2. **Re-scope PR #349 (9-track loop) to land dormant.** PR #350's stop-list item 1 freezes the
   expansion's *scheduling* until (a) `profitable_milestone_reached` is defined with a data
   source and (b) one backlog card has shipped as a merged fix. The prompts/schema can merge;
   the governor stays uncreated (it already is — `state.yaml` `last_tick_at: null`, per PR #350
   `04-what-to-stop.md` §1). #349 and #350 currently contradict each other while both open;
   this is the reconciliation.
3. **Close or explicitly park PR #351** (`claude/dewpoint-prediction-app-9q3oce`, draft) — a
   dew-point prediction app has no home in any plan on disk; it is fleet-attention leakage.
4. **This CoS PR merges** and the analysis tap closes per PR #350 stop-list item 2 (both
   in-flight passes were named exempt because already paid for; nothing after them).

## Days 2–7 (week 1) — the activation fix wave + the Decision Pack

Fleet work, sequential PRs (per `feedback_sequential_not_parallel_for_overlapping_prs`),
rebase-first, drawn verbatim from the converged list (kaizen master §3 first-five ≡ CEO Pass 1
`01` §5 ≡ direction-check Move 1):

1. **Connect-button dead ends** — FUB/Sierra credential form wired to tile CTA; TaxDome/Karbon
   flipped to honest coming-soon (audit 5 P0; the single highest-value S-effort change).
2. **`/how-it-works` redirect fix** (audit 1 P0) — the landing page every outreach link needs.
3. **Saved-time writers on the 4 uncovered calibrated actions + walk-away refunds through
   human review** (audit 9 P0 — the only known recurring dollar leak).
4. **Server-side CI floor** (`pr-checks.yml`: typecheck + invariant tests + brand/voice/vendor
   gates) — ends the gates-local-only pattern (kaizen 01/03).
5. **Wire the meters** — `stampSessionCost()` call sites so `budget-state.yaml` stops reading
   NULL after three straight weeks (kaizen 07/09).

In parallel (docs/YAML-only, no code overlap):

6. **Conner Decision Pack** — one PR that populates the repo's `memory/data/conner-queue.yaml`
   (zero rows ever written, per PR #350 verdict line 3) from the fleet-memory queue + CEO Pass 1
   `04-open-questions` + the kaizen contradictions, each with default, time estimate, and
   what-it-blocks. Includes reconciling the two queue files (see `02-redundant-work.md` §2).
7. **"Profitable" milestone ladder proposed in YAML** (direction-check Move 3): M1 first signed
   partner → M2 first activated pilot → M3 first paid conversion → M4 MRR ≥ trailing fleet
   spend + infra. Fleet proposes; thresholds go in the Decision Pack for Conner to ratify.

Conner work this week (his queue, not the fleet's — detailed in `03-conner-queue-priority.md`):
revoke the flatsbo PAT (10 min), calendar the 60–90 min send block, send the first five GA-RE
design-partner emails (CEO Pass 1 `02-biggest-lever`).

## Days 7–14 (week 2) — verify, measure, hold the line

- **Friday scoreboard (07-10):** sends / replies / discovery calls booked — three numbers
  (CEO Pass 1 `02`). Plus fix-wave scoreboard: which of the five merged and read back on main.
- **flatsbo: execute whichever ruling Conner makes** — one-day PII-endpoint gate or
  waitlist-dark (PR #350 stop-list 3 carve-out). One day maximum, not the synthesis's
  rows-1–8 week; the agentplain wave outranks it (direction-check error 4).
- **Prod-key un-pause pre-verification** — cost-governor + per-workspace budgets verified so
  the switch is instant when Conner's trigger (recommendation B: first booked discovery call,
  CEO Pass 1 `04` Q3) fires. Do not un-pause; make un-pausing a 5-minute act.
- **Loop restart check (07-14):** if by now "profitable" is ratified in YAML AND at least one
  backlog card has merged, the 9-track governor may be scheduled per its own spec. If not,
  it stays dormant — the restart condition, not the calendar, is the trigger.
- **CEO Pass 2 fires only per its own rule** (PR #348 `03` kill-list 1: "if Pass 2 finds
  Pass 1's decisions unexecuted, the series pauses too"). It is a delta check on execution,
  not a re-analysis.

## What is explicitly NOT scheduled in these 14 days

No new audits, retros, syntheses, or deep-dives (PR #344 ratified fixes-only; PR #350
stop-list 2). No new marketing assets (51 creative + 31 outreach + 25 ad-concept files exist
against zero sends — PR #350 stop-list 5). No CPA-depth journey passes (CPA closed until 2 RE
pilots — sales deep-dive rule, PR #350 stop-list 4). No mobile, no portal build-out, no new
connectors beyond the RE activation path (CEO kill-list 4/7). The test for any unlisted task:
does it appear in the top-20 fix table or the five profitability gates? If not, it waits.
