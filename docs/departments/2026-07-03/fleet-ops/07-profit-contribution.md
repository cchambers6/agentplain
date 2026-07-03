# Fleet-ops profit contribution — Conner-time is the runway

**The chain:** agentplain reaches cash-breakeven at 3–9 customers (CEO Pass 1); the
ratified path to those customers is founder design-partner outreach (money+GTM pack,
sales deep-dive) — work only Conner can do. Every hour the fleet hands back to him is
an hour on the one revenue-generating activity the business has. Fleet-ops does not
earn revenue; it converts machine reliability into founder selling time and keeps the
machine's own cost bounded. Both extend runway.

## Where fleet-ops saves Conner-time (mechanism → time class saved)

1. **No manual re-fires.** The governor's stall-replacement (4h cap, re-queue at
   head) and the dispatch fix (E1) remove the "notice a dead session, re-launch it,
   re-explain context" loop. Before the file bridge, a dropped fire waited on
   Conner's next message by design — founder attention as infrastructure. That
   pattern ends.

2. **Decisions arrive with defaults.** The CoS decision queue plus the Librarian's
   N4 deadline nudges mean every open decision reaches Conner as
   "recommendation + default + date it fires on silence" (the Jul-7 model switch in
   `03-…transition-plan.md` is the template). Deciding from a prepared default is
   minutes; reconstructing context to decide is the expensive part, and the fleet
   now does that half.

3. **Escalation replaces vigilance.** The SLA tiers (`01-loop-health-monitoring.md`)
   mean Conner does not need to *read carefully* to stay safe — a security item
   past SLA arrives as a standalone ping, not as line 4 of a daily list he has
   learned to skim. The 23-day PAT is the never-again case.

4. **Fix specs he never writes.** The loop's deliverable rule requires merge-ready
   specs sized for a cold fleet session. When the specs are good, the entire chain
   from gap → spec → PR → merge runs founder-free, with Conner appearing only at
   ratification points the rules already define.

5. **The record stays trustworthy.** Librarian hydration + state-vs-reality checks
   (N2/N5) mean the brief Conner reads is verified against primary sources, not
   thirteen passes stale. A founder who trusts the morning brief doesn't re-verify
   it himself — trust is the time saving.

## The cost side (fleet-ops as spend governor)

Directional, card-rate numbers; the first measured week (D1 cost stamps) replaces
them:

- Scheduled-task overhead: capped ≈ $44/day, actuals unmeasured-but-lower; the
  cadence backoff (`06-…stop.md` #4) cuts the quiet-fleet share.
- Loop post-Jul-7: recommended split ≈ **$6–14/day** (vs the $40–60/day
  do-nothing Fable trap the transition plan exists to prevent).
- Worst-case fleet total ≈ $50–60/day ≈ $1.5–1.8K/mo — real money against a
  pre-revenue P&L, which is why every component above carries a cap, a backoff, or
  a pause knob, and why loop spend has an explicit review trigger (deliverable
  consumption, D2). The honest rule: **loop spend is justified exactly as long as
  its fix specs are being consumed faster than they are filed.** When that inverts,
  fleet-ops pauses tracks — that is a state.yaml edit, not a project.

## What this is worth (kept honest)

No fabricated dollar-per-hour figures. The claim is structural: the business's
binding constraint this month is founder attention on outreach (ratified by CEO Pass
1 and the direction check), fleet-ops is the only department whose entire output is
denominated in that constraint, and its own cost is bounded and reversible. The
fortnight's acceptance test is in `00-EXECUTIVE-PLAN.md`: zero manual re-fires, zero
SLA breaches without standalone notification, model switch by decision not default —
each one a class of founder interruption that stops recurring.
