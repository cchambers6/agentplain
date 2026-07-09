# 04 — Discount and concession limits

**Why this file exists:** at ~95% modeled margin the constraint is trust, not price (CEO path-to-profitable §4). Discounting doesn't buy trust; it signals the list price was fiction. The concession budget is therefore spent in *shapes other than price*: free months paid in proof, activation-clock fairness, the money-back guarantee. The ladder itself already contains the only price concession we make — volume (`lib/pricing/tiers.ts:106-131`).

**The one-sentence rule:** the published ladder is a floor, not an opening position.

---

## 1. What CAN be offered on a call, no prior approval needed

These are the program and the policy, already ratified. Offering them is executing the plan, not conceding:

| Concession | Terms | Source |
|---|---|---|
| Design-partner program | 3 months free × weekly founder call × early access × joint case study — in exchange for ALL THREE asks (weekly call, on-record testimonial, reference willingness). Cohort capped at 3–5 across all verticals | Claims spine §5 |
| Pilot clock starts at activation | Free months begin when drafts flow, not at signature; our-side blockers stop the clock | Pipeline doc §4, ACTIVATION row |
| Seat-band ladder pricing | The published per-seat step-downs, applied to their true seat count — $199→$99 Regular, $299→$199 Partner. Quoting the correct band is accuracy, not discounting | `tiers.ts:106-131` |
| Trial per policy | 7 days; 14 for CPA/Law. Card at signup (not waivable — architecture, not discretion) | `facts.ts:27-39,54` |
| 14-day money-back guarantee | From first charge, independent of trial; cancel anytime | `facts.ts:51,57` |
| Standard-paid alternative to a DP slot | For prospects who decline the proof asks: published pricing, standard trial | Pipeline doc §4, DP-TALK unstick |
| DP benefits to a day-one payer | A qualified prospect who *chooses* to pay from day one may keep the weekly calls + case study for 3 months (we come out ahead) | 01 §5 |

## 2. What NEEDS Conner's own prior decision — never invented live on a call

The rule's real function: **it moves the decision out of the live conversation**, where reciprocity pressure makes bad economics feel generous. The sentence that buys the room, every time:

> "I keep terms identical for everyone in writing, so let me take that away and come back to you by [date] rather than make it up on a call."

Requires a deliberate, written, pre-call decision by Conner (a note in the CRM row before the call counts; mid-call improvisation does not):

- **Any price below the published ladder cell** for the prospect's true tier and seat count. Including "round it to $150," "first paid month at half," or applying a lower band's price to a smaller seat count.
- **Extending the design-partner free period** beyond 3 months, or a 4th/5th free month "to close."
- **Waiving or softening any of the three DP asks** while keeping the free months.
- **A 6th design-partner slot** beyond the 3–5 cap (the cap is what makes the weekly call real — claims spine §5).
- **Trial extensions** beyond `facts.ts` (7/14 days) — the money-back guarantee already covers the "I need more time" case; say so first.
- **Case-by-case guarantee stretches** ("can I get 30 days money-back?").
- **Committing a roadmap item with a date** as part of a deal (a Custom-flagged, prospect-funded build is a `/custom` scoping conversation, not a call-close concession — playbook §4).

## 3. What is NEVER offered — by the fleet, in drafts, or by Conner in the room

The fleet drafts outreach and follow-ups; none of these may ever appear in a draft, and Conner declines them in person:

- **Annual commitments or annual-discount pricing.** No annual plan exists (`tiers.ts` is monthly-only, `lookupKeyFor` → `_monthly`; `CANCEL_ANYTIME`, `facts.ts:57`). Month-to-month with bounded downside IS the trust posture we sell (playbook objection #2) — inventing a lock-in to close a deal breaks the story everywhere else. If a prospect *asks* to prepay annually: "We're month-to-month on purpose — I'd rather earn month thirteen than contract for it."
- **Sub-floor pricing** — anything below the $99 Regular / $199 Partner 50–99-seat cell, for anyone, at any seat count. The bottom of the ladder is the bottom (`tiers.ts:115,122`).
- **"Pilot pricing."** Banned phrase and banned shape (CEO doc §4). The design-partner program is 3 months free with proof asks — a different thing with a different name; keep it that way.
- **Unbounded or recurring founder time.** Conner-time is Max/Custom only (`CONNER_TIME_TIERS`, `facts.ts:65`); the DP weekly call is 30 minutes, weekly, for the pilot's 3 months, then ends. Never "call me whenever," never standing calls at Regular/Partner (`facts.ts:15-17`).
- **An improvised Max quote.** Max is quote-based after scoping (`isSelfServeTier`, `tiers.ts:46-50`); a number said on a discovery call becomes the ceiling of the real negotiation.
- **Free months without the asks.** Free-with-no-strings is a discount wearing a costume; the program is payment in proof or it's the standard deal.
- **Feature promises with dates** to close (trap #5 in `06-common-mistakes.md`): "on the roadmap, and I won't give you a date I can't keep" is the whole sentence.
- **Invoice/PO or net-terms billing agreed on a first call** (trap #6): card at signup via Stripe is the system (`facts.ts:54`); genuinely procurement-bound buyers are a Max/Custom-shaped conversation, taken away, not agreed in the room.

## 4. If a concession already slipped

It happens; the recovery is honesty within 24 hours, in writing:

> "I told you [X] on our call. I checked, and the terms I'm able to offer are actually [Y] — I'd rather correct it now than surprise you at signup. Everything else we discussed stands."

Log it verbatim in the CRM row and in the playbook §7 heard-objection log. A corrected over-promise costs a little pride; a kept one costs the pricing integrity of the whole cohort, because design partners talk to each other — that's what references are.
