# Strategy gaps — what nobody has named yet

The audits and deep-dives are thorough about *product* gaps. These are the gaps in the
*strategy itself* — things no current workstream owns.

## 1. The legal entity is the biggest silent gap (and everyone is ignoring it)

Kaizen 08 states it plainly: **entity unconfirmed, zero counsel signoff on the published ToS,
AUP, and Privacy policy.** Yet every plan on disk assumes signatures happen:

- The design-partner program (sales 02) requires a signed agreement — signed *by what entity*?
- Card-at-signup + a 14-day money-back guarantee means taking and refunding money — *as whom*?
- The published ToS binds customers to terms no counsel has reviewed, published by an entity
  that may not exist.

This is not a legal-department detail; it is a strategic gate. The entire GTM plan has a
day-30–60 window where a real broker-owner says yes — and at that moment the business either
has papers or improvises them. It takes Conner hours (form the entity or confirm it exists,
assign IP, one counsel pass on the three published documents) and it gates preconditions 2, 3,
and 5 of the direction verdict. Nobody owns it because it's 100% Conner-side and the Conner
queue is empty (see 01).

## 2. "Profitable" is undefined while a loop is being built to run until it's reached

The live directive for the loop expansion is *run non-stop until `profitable_milestone_reached:
true`.* That key exists nowhere: not in `memory/data/loop/schema.yaml` (v2), not in
`state.yaml`, not in any finance doc. There is no formula, no data source, and — worse — the
inputs that any definition would need don't flow: `stampSessionCost` has zero call sites (kaizen
09), week-to-date spend is NULL (kaizen 07), and revenue is $0 by construction until day 90–120.

An undefined stop condition on a continuous loop is an unbounded burn commitment after Jul 7,
when Fable moves to usage credits. The definition is a one-page decision (see 05, move 3), and
it should exist *before* the 9-track expansion fires, not after.

## 3. Single-channel, single-human distribution with no warm fallback

The ratified #1 channel is founder-led design-partner outreach. Fine — it's the right channel
pre-PMF. The unnamed gap: it is the *only* live channel, and its sole operator has sent zero
emails in 2.5 weeks. The marketing deep-dive's content cadence (2/week published) is the natural
fallback channel, but it is a plan without an operator, publishing target, or distribution list,
and the site has **zero analytics** to tell anyone whether it works. If precondition 2 (Conner's
rhythm) fails, the business currently has no second way to generate a design-partner
conversation. The strategy should name this: either commit to the founder channel with a
calendar-level commitment, or fund the content channel as a genuine hedge (instrumentation
first — it's week-1-2 work in marketing 06 and hasn't started).

## 4. Zero observed customer signal — and no plan to get it besides the partners themselves

Every persona, want, and ROI number traces to analyst-derived JTBD tables and stack-cost
estimates. The journey loop is honest about this (it tracks `persona-research` as a standing
want), but the strategy implication is unnamed: **the design partners are not just proof
assets, they are the company's first real customer research.** That changes how the pilots
should run — structured weekly learning capture, not just success management — and it strengthens
the sequencing argument (03): every fleet-hour spent deepening analyst-derived journey maps
depreciates the moment the first real partner starts talking.

## 5. Support has no inbound path for the customers the plan is about to create

Ticketing and SLAs exist on main; **inbound email does not** (kaizen 06). The first design
partner who emails hello@agentplain.com gets whatever Conner happens to notice. For a business
whose pitch is "we run it for you," the first support miss is a positioning wound, not a bug.
Small build, currently unowned, needs to land before pilot week 1 — the same deadline as the
saved-time fix.

## 6. The Jul 7 model-economics cliff has no plan on the other side

All current velocity assumes plan-included Fable (~$0 marginal). In four days that flips to
usage credits, and the only artifacts addressing it are option lists (RUNBOOK: on-demand vs
Opus continuous vs stop). There is no ratified post-Jul-7 operating tier: what the fleet's
steady-state weekly burn should be, measured against what milestone. Given gap 2 (no cost
stamping), the re-tier decision on 07-06 will be made without data unless the meters get wired
this week. The no-ceiling rule was scoped to the burst window; nobody has written what replaces
it.

---

**The single biggest silent gap:** #1, the entity. Everything else on this page degrades the
plan; #1 makes the plan's success moment — a partner saying yes — legally unanswerable. It
costs Conner one day. It has been unconfirmed for at least three weeks.
