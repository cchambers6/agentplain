# agentplain — Per-Vertical Pricing

**Prepared:** 2026-06-14 · **Companion to:** `docs/business-plan/unit-economics.md` ·
**Status:** decision input

Cost is ~5% of revenue and **near-identical across verticals** (all five live killer
workflows are deterministic templates — see unit-economics §0). So per-vertical pricing
is driven entirely by **value and willingness-to-pay, not cost.** The question for each
vertical is: *what billable-hour or commission-dollar does the killer workflow displace,
and how price-sensitive is the buyer?*

**Bottom line: per-vertical pricing DOES differ — but on the default tier anchor and
trial length, not on the price points themselves.** High-billable verticals (CPA, Law)
anchor on **Partner ($299)**; price-sensitive, volume verticals (Real Estate, Home
Services) anchor on **Solo ($199→$99)**. This is already partially implemented — the CPA
and home-services vertical pages render the Plus/Partner tier ($299)
(`lib/verticals/cpa/content.ts`, flagged in the 2026-06-11 sales audit). This doc
formalizes and justifies it.

### Trial rules (new policy, applied below)

| Rule | Value |
|---|---|
| Default trial | **7 days** |
| CPA + Law trial | **14 days** (longer sales/eval cycle, compliance review) |
| Money-back guarantee | **14 days**, all verticals |
| Card at signup | captured at signup (single source-of-truth decision still open per sales audit) |

ROI math uses the verified labor rates and minutes-saved constants from
`lib/measurement/value-impact.ts` (BLS 2024 medians: $45/hr admin, $55/hr professional,
$75/hr compliance & finance).

---

## 1. Real Estate `real-estate` — LIVE

**Killer workflows:** `lead-triage-realestate` (per-inbound scoring + first-touch draft),
`invoice-chasing-realestate` (commission chase). Both template-based; lead-triage adds an
optional cached Opus refine only when FEEDBACK rules exist.

**Cost profile:** ~Profile A. LLM $1.50/mo, total COGS ~$9.61/mo.

**Trial:** 7 days. **Recommended anchor: Solo $199** (→$99 at 50-99 seats / brokerage).

**ROI math (value-impact constants):**
- `LEAD_TRIAGE`: 12 min saved × $55/hr = **$11.00 per lead** triaged + drafted.
- A solo agent fielding **40 inbound leads/mo** → 40 × $11 = **$440/mo** of displaced
  time, plus the conversion upside of a <5-min first-touch (the "Sarah's counter-offer"
  day-in-the-life). At $199, ROI ≈ **2.2× on time alone**, before a single extra closing.
- One additional closing/year at a $9k commission dwarfs the $2,388/yr subscription.

**Competitive context:** Follow Up Boss ($69/user), Lofty/Chime ($449+), kvCORE bundled
in brokerage fees. agentplain is **not a CRM** — it is the operator that works the CRM,
priced between a point tool and a platform. Anchor the conversation on *hours back*, not
seat-vs-seat.

**Pricing script:**
> "You're getting 40-ish leads a month and most go cold because the first reply takes
> hours. Plaino scores every lead and drafts the first touch in under five minutes — you
> just approve. That's about ten hours a month back at your desk, and the leads that
> actually convert. It's $199 a month, first month free, cancel anytime. One extra
> closing a year pays for a decade."

---

## 2. CPA / Accounting `cpa` — LIVE

**Killer workflow:** `month-end-close-cpa` (missing-doc detection, batched chase drafts,
client status update). Template-based; LLM polish flag-gated off.

**Cost profile:** ~Profile B. LLM ~$2.83/mo, total COGS ~$14.80/mo.

**Trial:** **14 days** (per new rule — matches the eval cycle of a firm checking it
against one real close). **Recommended anchor: Partner $299.**

**ROI math:**
- `computeCloseValueImpact` (`value-impact.ts:415`): one assembled close saves
  `chaseDrafts×12 + outstandingItems×4 + receipts×5 + status×10` minutes at **$75/hr**.
  A typical 8-client close with ~6 chase drafts, ~20 outstanding items, ~15 loose
  receipts, status note = (72 + 80 + 75 + 10) = 237 min = **3.95 hrs × $75 = $296 per
  close cycle, per client batch** — and that repeats every month.
- A 30-client firm running monthly closes: the doc-chase alone is **$1,000s/mo** of
  staff time (the "March-17 doc-chase $42K/yr" day-in-the-life). At $299, ROI is
  **5–15×**.
- Billable-hour framing: a CPA's realization rate makes admin doc-chase pure margin
  leakage — every hour Plaino removes is an hour redeployed to billable advisory.

**Competitive context:** TaxDome ($800/yr/user), Karbon ($59-89/user), Canopy. These are
practice-management *systems*; agentplain is the operator that chases the documents those
systems only *track*. Partner tier signals "managed service," which a CPA values over a
DIY tool. SOC 2 is a procurement blocker for larger firms (sales audit) — note the gap.

**Pricing script:**
> "Month-end, your staff spends days chasing missing documents from clients. Plaino runs
> the checklist against every engagement, drafts every chase email in your firm's tone,
> and drafts the client status update — your team just approves. That's roughly four
> hours back per close, per client, every month, at $75-an-hour staff time. It's $299 a
> month, and you get fourteen days to run it against a live close before you decide."

---

## 3. Law `law` — LIVE

**Killer workflow:** `law-intake-conflict-screen` (deterministic conflict match against
firm ledger + formal attorney notice draft). Zero LLM, fully deterministic — the highest-
trust posture of any vertical (no model in the legal-conclusion path).

**Cost profile:** ~Profile B, slightly lower LLM. Total COGS ~$13/mo.

**Trial:** **14 days** (per new rule — matches counsel review cadence).
**Recommended anchor: Partner $299** (Max for multi-office firms).

**ROI math:**
- A blown conflict check is an existential risk (disqualification, malpractice,
  bar referral) — the value is **risk avoidance**, not minutes. Even at the admin rate,
  a paralegal conflict screen is 20–40 min; at scale across every intake that is real,
  but the *insurance* framing dominates: one avoided conflict pays for years.
- `COMPLIANCE_FLAG`-class work is rated $75/hr in `value-impact.ts`; a firm screening
  30 intakes/mo saves ~15 hrs and removes the human-error tail on the screen itself.

**Competitive context:** Clio ($89-139/user), MyCase, Smokeball. Practice-management
systems with conflict-check *features*; agentplain runs the screen deterministically and
drafts the formal notice. **Counsel sign-off gate** governs any rewrite generation
(`project_compliance_counsel_gate_two_layer`) — lead with that as a trust feature, not a
limitation. SOC 2 gap applies.

**Pricing script:**
> "Every new matter needs a conflict screen, and one miss is a malpractice problem.
> Plaino screens each intake against your full client ledger deterministically — no AI
> guessing on the legal question — and drafts the formal notice to the responsible
> attorney. The attorney still makes the call; Plaino does the search and the paperwork.
> $299 a month, two weeks to run it against your real intake flow."

---

## 4. Home Services (trades) `home-services` — LIVE

**Killer workflow:** `home-services-estimate-followup` (stage-routed homeowner nudges,
cold-estimate rep handoff). Template-based, high item volume, zero LLM per item.

**Cost profile:** ~Profile C if multi-seat. LLM ~$5.64/mo even at 300 chat msgs +
40 support; total COGS ~$36/mo at 3 seats / $837.

**Trial:** 7 days. **Recommended anchor: Solo $199→$99 (volume), or Partner $279/seat for
multi-crew shops** — the vertical page already shows the Partner tier.

**ROI math:**
- Estimate follow-up is the entire margin of a trades business — unfollowed estimates are
  lost jobs. `FOLLOW_UP_NUDGE` is rated 5 min × $45/hr = $3.75/nudge, but the real number
  is **conversion**: a roofer with 60 open estimates/mo at a $9k avg ticket and a 5-point
  follow-up lift = **$27k+/mo** of recovered pipeline. At $199-279, ROI is not close.
- The "hailstorm 73-call triage" day-in-the-life: surge events are exactly when manual
  follow-up collapses and Plaino's batching shines.

**Competitive context:** ServiceTitan (enterprise, $$$$), Housecall Pro ($59-149),
Jobber ($69-249), plus point AI tools (Avoca, ServiceAgent). agentplain layers on top of
whatever FSM they run — it is the follow-up operator, not a replacement FSM. Price-
sensitive owner-operators: lead with Solo $199 and the volume ramp; reserve Partner for
multi-crew shops who feel the seat value.

**Pricing script:**
> "How many estimates did you send last month that you never heard back on? Plaino works
> every open estimate on a cadence — a nudge at the right moment, a phone-call handoff
> when one goes cold — and you approve each one. Recover even two jobs a year and it's
> paid for itself ten times over. $199 a month, first month free."

---

## 5. General on-ramp `general` (all-vertical) — LIVE

**Killer workflows:** `chief-of-staff-scheduler`, `inbox-triage-general`,
`follow-up-chaser-general`, `support-handler`, plus the weekly pulses. The cross-role
on-ramp for any local business that doesn't fit a named vertical.

**Cost profile:** ~Profile A. Total COGS ~$9.61/mo.

**Trial:** 7 days. **Recommended anchor: Solo $199.**

**ROI math:**
- `CHIEF_OF_STAFF_MEETING` 15 min, `INBOX_TRIAGE` 8 min, `FOLLOW_UP_NUDGE` 5 min, all at
  $45/hr. A small-business owner clearing 22 inbox items + 10 follow-ups + 8 scheduling
  proposals/mo = (176 + 50 + 120) min = **5.7 hrs/mo × $45 = $257/mo** of owner time —
  the owner's time, the most expensive in the building. ROI ≈ 1.3× on time, before any
  revenue effect.

**Competitive context:** the "virtual assistant" comparison ($25-50/hr human VA, or
$300-2,000/mo done-for-you VA services). agentplain is the always-on, never-sick,
no-onboarding version at a flat $199. This is the wrapper positioning in its purest form:
**"the easy way to actually use Claude"** for a business with no IT.

**Pricing script:**
> "You're the bottleneck on your own inbox, calendar, and follow-ups. Plaino drafts the
> replies, proposes the meetings, and chases the threads that went quiet — you approve
> from your phone. It's about six hours of your week back, for $199 a month. First month
> free."

---

## 6. Summary table

| Vertical | Status | Anchor tier | 1-seat $ | Trial | COGS/mo | Margin | Value driver |
|---|---|---|---|---|---|---|---|
| Real Estate | LIVE | Solo | $199 | 7d | $9.61 | 95% | leads worked < 5 min |
| CPA | LIVE | **Partner** | $299 | **14d** | $14.80 | 95% | month-end doc-chase, $75/hr staff |
| Law | LIVE | **Partner** | $299 | **14d** | ~$13 | 95% | conflict-screen risk avoidance |
| Home Services | LIVE | Solo / Partner | $199–279 | 7d | $36 (3-seat) | 96% | recovered estimate pipeline |
| General | LIVE | Solo | $199 | 7d | $9.61 | 95% | 6 hrs of owner time/wk |

**Verticals NOT yet priced for self-serve** (credential-gated, schema-only per
`lib/verticals/readiness.ts`): insurance, mortgage, property-management, title-escrow,
RIA, recruiting. They stay on the waitlist until a live production caller exists; when
activated they will follow the **Partner-anchor, 14-day-trial** pattern of the high-
compliance verticals (insurance/mortgage/title) or Solo-anchor for volume verticals.

**The one cross-vertical rule:** never let the price-anchor whipsaw the sales audit caught
recur — a buyer who sees $199 on the homepage must not land on $299 on the vertical page
without an on-page explanation. Either show the vertical's anchor tier consistently from
the first touch, or explain the Partner upgrade inline. Pricing-data must read from
`lib/pricing/tiers.ts`, never hardcoded bands (the $269/$239 drift, INBOX 2026-06-10).
