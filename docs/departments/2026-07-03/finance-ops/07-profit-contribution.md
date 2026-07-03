# Finance & Ops — contribution to "profitable"

**Date:** 2026-07-03 · **Owner:** Head of Finance & Ops
The loop mandate is design FOR profitable. At ~95% modeled gross margin, Finance & Ops cannot make the company profitable — only customers can (cash-breakeven is ~9 blended seats; truly profitable ≈ $10K MRR ≈ ~33 accounts). What this department contributes is making profit **measurable, defensible, and impossible to lose by accident.** Quantified where honest, labeled where modeled.

---

## 1. Make Z a number (the measurement contribution)

The profit equation `Σ(seats × price × (1−v)) ≥ Z + H×R` currently has an unmeasured Z and an unrecorded R — the CEO pass called Z "the single most embarrassing gap in this doc." The telemetry wiring (`01`) plus the three Conner inputs (`03` §4) convert the equation from planning bands to arithmetic. **Value: every downstream decision — hire timing, paid-media gate, price moves — currently runs on a ±3× band; after day 7 it runs on a ledger.** This is the department's largest single contribution and it costs roughly three S-sized engineering items.

## 2. Defend the 95% margin (the governor contribution)

The margin is not at risk from normal operation (templates, 0 LLM calls/run) — it is at risk from three specific events, each with a control this department owns:

| Threat | Modeled exposure | Control |
|---|---|---|
| Runaway/abusive workspace after un-pause | a single ungoverned workspace could burn a month of blended LLM COGS in a day | daily + monthly caps with explicit pilot values, `BREACH` alert, preflight rule of zero `NO_CAP` pilots (`04`) |
| Fleet-wide runaway (bug/abuse across workspaces) | unbounded without a stop-loss | $25/day fleet breaker + documented one-click re-pause (`04` Gap B) |
| The deliberate template→LLM quality upgrade, someday | heavy-profile LLM line ~$6 → ~$60–120/mo; at 1,000 such customers, margin 94% → ~70–75% (unit-economics §6) | the upgrade is only allowed through the budget governor — metered, per-tier, reversible. The governor existing **before** the upgrade is the whole point of building it at zero traffic |

## 3. Plug the one known recurring leak (the guarantee)

4 of 7 calibrated actions have no saved-time writer, so walk-away refunds can fire on customers the fleet actually served (audit 9/10; master fix row 11). Per wrongful refund the hard cost is the full month's price plus the unrecoverable Stripe fee (~$205–308 on a Regular/Partner seat) plus a false "we failed you" email — trust damage at exactly the customers who activated. Engineering owns the fix; Finance & Ops' contribution is keeping it ranked as **margin defense, not polish**, and requiring auto-refund stays in human-review mode until the writers land. **Value at 10 customers: prevents the only identified mechanism by which the product loses money it earned.**

## 4. Harvest the free margin already on the table

Two S/M items with permanent per-customer yield (`05` E6/E7):
- Haiku meter rates $1/$5 → $0.80/$4 — stops over-billing the customer usage meter (a truth fix as much as a finance one).
- `LLM_MODEL_ROUTING` on after verification — ~$0.30–0.40/customer/mo. Trivial at 10 customers (~$4/mo), real at 1,000 (~$300–400/mo), and free forever once verified.

And one for later, flagged now so it isn't forgotten: **Stripe is the largest COGS line at every scale** (~3.5% of revenue — bigger than LLM + infra combined). At $10K MRR that's ~$350/mo; the levers (ACH for annual plans, negotiated rates at volume) become worth an engineering week somewhere around 100+ customers. Parked with a trigger, not scheduled.

## 5. Keep CAC at zero until the math says otherwise

The current channel is founder sends at ~$0 cash CAC. Finance & Ops enforces the box the CEO pass drew: paid spend, if its 4-condition gate is ever met, is judged on cost per qualified trial start against ~$185/mo contribution — **CAC ≤ $370 for 2-month payback.** Until a measured funnel exists (D4), no paid test can even be evaluated, which is the financially correct reason it stays killed — not ideology, missing denominators.

## 6. The honest summary line

At current scale, Finance & Ops' 14-day plan changes the P&L by approximately **$0** — and that is the correct amount, because the P&L's problem is a numerator (revenue) this department doesn't own. What it delivers instead: **the ledger that makes profit visible (§1), the governor that makes margin un-losable (§2), the leak plug ranked where it belongs (§3), ~$0.40/customer/mo of permanent margin (§4), and the discipline that keeps burn in the lean band while the sends go out (§5).** When the first design partner signs, the finance side is a solved problem on day one — which is the only way a one-operator company can afford for it to be.
