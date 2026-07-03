# Planning cadence — how often to re-run this session, and what triggers it

## Recommendation in one line

**Event-triggered with a monthly floor, run as a standalone session — never inside the 9-track
loop.** One Fable-tier session, docs-only, same seven-file format, diffed against the previous
verdict.

## Why not inside the loop

Three reasons, each sufficient alone:

1. **Independence.** This session's job is to audit the fleet's direction — including the loops
   themselves (this run's top stop-list item *is* a loop). A track inside the machine cannot
   credibly conclude "shut down the machine." Direction verification must sit outside the thing
   it verifies.
2. **This session's own core finding is over-production of meta-work.** Scheduling planning as
   a continuous track would institutionalize the exact failure mode it just diagnosed. Strategy
   verdicts don't decay in 30-minute ticks; gap inventories do — that's what the journey loop
   is for.
3. **Cost shape.** Post-Jul-7, continuous Fable is real money. A direction check is a few
   dollars monthly on-demand versus a standing track that mostly re-confirms itself.

## Triggers (any one fires a re-run)

**Milestone triggers** — the direction bet's preconditions changing state:

- First design-partner agreement signed (the bet's first real market signal — re-check
  everything against observed data instead of analyst estimates)
- First pilot activated / prod key un-paused (economics move from projected to measured)
- First paid conversion (the "profitable" ladder starts mattering; re-tier the whole work plan)

**Failure triggers** — the plan visibly not executing:

- Outreach rhythm hasn't started within 2 weeks of the Conner Decision Pack shipping, or two
  consecutive weeks of zero sends after it starts (precondition 2 failing — the plan needs a
  channel rethink, not more patience)
- A load-bearing rule moves to CONTRADICTING in any audit/kaizen (alignment is the one thing
  this session checks that nothing else does)
- The stop list is ignored — e.g., the 9-track loop gets scheduled without its restart
  conditions met

**External triggers:**

- Anthropic SBM ships a managed-service or partner tier (the service-partnership moat needs
  immediate re-verdict)
- Model economics change materially (the Jul 7 flip already schedules the *first* re-run — see
  below)

**Floor:** if nothing fires for 30 days, run it anyway. A month of "no triggers" either means
healthy execution (cheap confirmation) or dead instrumentation (the session will notice —
this run caught an empty Conner queue precisely because it looked).

## The next run is already scheduled by events

Jul 7–10: the Fable window closes, the loop governor stops firing, the re-tier decision is due
(budget-state names 07-06), and the CEO/CoS passes will have landed. That confluence is the
natural next session — **~2026-07-08**, scoped as a *delta check*: did the stop list hold, did
the fix wave merge, did the Decision Pack reach Conner, what does post-Jul-7 fleet operation
look like against the (by then defined) profitability ladder.

## Format discipline for re-runs

- Re-runs update **00 (verdict), 01 (alignment), 04 (stop), 05 (start)** every time; 02 (gaps)
  and 03 (sequencing) only when a trigger implicates them. Keeps the session under a day and
  resists scope creep back into deep-dive territory.
- Each re-run leads with a **delta table against the prior verdict** — preconditions that
  changed state, stop/start items adopted or ignored. A direction check that can't say "what
  changed since last time" is just another synthesis.
- New dated directory per run (`docs/planning/YYYY-MM-DD/`); the newest verdict supersedes;
  prior runs stay as the audit trail of the company's judgment.
- Same constraints every time: docs-only, Truth Wave (no aspirational metrics stated as fact),
  every claim cites the artifact.

## Who consumes it

The verdict's sign-off question ("approve direction / change what?") goes to Conner via the
Decision Pack queue like any other judgment item — with the difference that this one is allowed
to say *stop things*, and the stop list should be treated as adopted unless Conner overrules,
not as a suggestion awaiting enthusiasm.
