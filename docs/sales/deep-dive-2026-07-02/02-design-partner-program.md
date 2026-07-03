# 02 — Design-partner program

**Why this exists:** the binding constraint is the trust gap — zero paying customers, zero social proof. The only honest cure is 3–5 named, on-record design partners. Everything in this program is engineered to convert founder attention into *publishable proof*.

**Terms authority:** program terms were ratified in `docs/marketing/design-partner-outreach/_shared/CLAIMS_GROUND_TRUTH.md` §5. This document operationalizes them; where the two disagree, the claims spine wins.

---

## 1. The deal (ratified terms, restated for execution)

**What the partner gets:**
1. **First 3 months free** (not "first month free" — that's the standard-plan framing; design partners get 3). After the pilot they convert to standard month-to-month pricing for their tier — no obligation.
2. **Weekly founder time during the pilot** — direct access to Conner. This is the *one sanctioned Conner-time exception* outside Max/Custom (`lib/billing/facts.ts` `CONNER_TIME_TIERS`; claims spine §4–5). It is the explicit design-partner consideration and it ends when the pilot ends.
3. **Early access + a real voice in the roadmap** — they see features first and their weekly call shapes what gets built.
4. **A joint case study, co-authored** — they approve every word before anything is public.

**What we ask back (pre-negotiated, in the agreement, not sprung later):**
1. A **weekly 30-minute call** during the pilot (their stack, what's working, what's not — recorded with consent).
2. An **on-record testimonial** once they've seen value — including a quarterly on-record quote thereafter (NPS-style, one sentence, they approve wording).
3. **Reference willingness** — a reference call or attributable quote for future prospects.
4. **Case-study rights** as scoped in §4 below (named use with word-approval).

**Cohort framing (resolves the kaizen discrepancy):** the signed cohort is **3–5 partners across all verticals** — small enough that each gets real founder attention. The money-GTM plan's "10 RE design partners" is read as the *prospecting-funnel width* (how many RE conversations we pursue), not the signed target. In outreach, say "a small cohort" / "a handful of partners" — never a fabricated countdown.

**Recommended cohort shape:** 2–3 real-estate + 1 property-management + 0–1 general (referral-sourced). Law and CPA partners wait for their lanes to open (document 01); a five-vertical cohort of five would recreate the five-front war.

## 2. Target profile per vertical

The design-partner filter is *stricter* than the ICP — these five accounts become our public proof, so select for reference quality, not just fit:

| Vertical | ICP (doc 01) plus… |
|---|---|
| Real estate | Broker-owner personally active in a named association (their testimonial carries local weight); willing to count hours honestly; not in the middle of an M&A or brand change |
| Property management | Owner who will let us publish door-count and workflow specifics; QBO books clean enough that collections drafts are demonstrable in week 1 |
| General | Referral-sourced only; a recognizable local business type (the case study must be legible to readers outside their niche) |
| CPA / Law (later) | Partner personally carries the compliance exposure and will say on record *why the approval gate satisfied them* — that quote is worth more than any ROI number |

One more filter across all: **they can activate.** Google/M365 + QuickBooks live, owner does their own email, no procurement/security-review gate. A design partner stuck in setup for six weeks burns the program's scarcest asset — founder weeks.

## 3. Outreach angle (referral > cold, Conner's network first)

Priority order for sourcing the cohort:
1. **Named warm paths** from Conner's FlatSBO-adjacent network — the warm column in document 01's list spec. A warm intro to a Georgia broker-owner is the single highest-probability path to partner #1.
2. **Community-adjacent warm**: people Conner can meet through the named channels (local/state Realtor associations, Lab Coat Agents, NARPM) where the first touch references shared context, not a database.
3. **Cold, association-sourced** (roster names with no path) — last resort, still honest: "you'd be among our first" is in the packets by design.

The packet library (`docs/marketing/design-partner-outreach/<vertical>/`) already contains the cold/warm email pairs, follow-up sequences, and call-booking templates for all of this. **No new outreach copy is needed and none is drafted here** (no-live-drafts rule — the fleet drafts into the approval queue when the weekly rhythm fires; Conner sends every one from his own inbox).

**The proof-ladder substitute while proof is zero:** before partner #1 signs, the only proof surfaces are (a) the founder himself — bio ship is sales-critical (00 §5), (b) a **recorded product walkthrough** on the synthetic-data demo runtime (PR #303 — real product, fabricated-data disclosure on screen), and (c) the dogfooding story ("this brokerage's own ops run on the same fleet" — the claims-spine-sanctioned version). Build (b) once, reuse everywhere, including as the async substitute when a prospect won't book a live call.

## 4. Legal predicate — design-partner agreement (PLACEHOLDER — counsel required)

> ⚠️ **These are placeholder terms to brief counsel, not a contract.** Nothing here is sent to a prospect. Counsel engagement is already flagged as the top legal gap (kaizen 08); this agreement joins the ToS/AUP/Privacy packet. Until a counsel-reviewed agreement exists, a partner may start a pilot on the standard ToS + a short signed letter covering only items 2–4 below.

Terms the agreement must cover:
1. **Program term:** 3-month pilot, free of charge; either party may end it with 14 days' notice; conversion to standard pricing is optional and at then-current published rates.
2. **Case-study & testimonial license:** partner grants use of name, logo, and approved quotes in marketing; **every public word requires prior written approval by the partner**; revocable prospectively (not retroactively for printed matter) with 30 days' notice.
3. **Data & confidentiality:** mutual NDA scope; our data handling per the published privacy policy; partner's client data never appears in any case study in identifiable form.
4. **No-warranty posture for the pilot:** service provided as-is during the free term; the standard money-back guarantee applies only after paid conversion (`MONEY_BACK_GUARANTEE_DAYS`, `lib/billing/facts.ts` — do not restate the number in the agreement; cite the policy).
5. **Founder-time scope:** weekly 30-minute call during the pilot term only; no reserved hours after conversion unless the partner buys Max/Custom.
6. **Feedback license:** ideas/feedback the partner gives us are ours to use without obligation (standard, but must be stated).

## 5. Pilot operating shape (what "activated" means)

- **Week 0 (pre-activation):** stack check (email + QBO + DocuSign connected), prod-key un-pause confirmed, saved-time measurement verified writing for their workflows (audit 9 P0-1 fix is a prerequisite — measurement defined *before* the pilot, per kaizen fix #5).
- **Week 1:** first drafts land in their queue; first weekly call; case-study template (document 05) opened with the "before" fields filled in *from their own words on the call*.
- **Weeks 2–12:** weekly call; drafts/week, approval rate, and hours-reclaimed accrue from instrumentation, not recollection; objection/product friction from calls feeds the living playbook (document 04).
- **Exit:** convert (standard pricing, Conner-time ends), or part cleanly — a partner who declines to convert but gives an honest on-record quote about what worked is still a program success. Never trade honesty for retention.

## 6. Program-level risks, stated

- **Founder-time is the hard cap:** 5 active pilots = 2.5 hrs/wk of calls plus prep on top of the outreach rhythm. Do not sign partner #4 while three pilots are mid-flight unless the calendar math works.
- **First partners are the most expensive references we'll ever mint:** selling ahead of the activation gates (prod key, measurement) risks burning them — sequencing in 00 §1 is not optional.
- **The quarterly on-record quote is the program's compounding asset:** calendar it from signing day; a program that produces one launch-day quote and silence has failed its purpose.
