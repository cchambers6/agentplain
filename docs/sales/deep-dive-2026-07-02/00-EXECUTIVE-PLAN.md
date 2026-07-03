# Sales deep-dive 2026-07-02 — Executive plan (first 90 days)

**Date:** 2026-07-02 · **Directive:** Conner — "focus especially on sales after the product runs."
**Sources:** full-product audit 1–10 (`docs/audits/full-audit-2026-07-02/agentplain/`), sales kaizen retro (`docs/kaizen/2026-07-02/05-sales.md`, PR #341), design-partner claims spine (`docs/marketing/design-partner-outreach/_shared/CLAIMS_GROUND_TRUTH.md`), money-GTM pack (2026-06-14), pricing/trial facts (`lib/pricing/tiers.ts`, `lib/billing/facts.ts` — code supersedes every number in this directory).

This directory is the sales operating plan. Documents 01–06 are the working parts; this page is what Conner reads Monday morning.

---

## 1. Where we actually are

- **The product runs.** The draft→approve→audit spine is verified sound (audit 4: zero P0s, 100% approval-gate coverage). Live workflows exist for real-estate, property-management, and general; email + calendar + QuickBooks + DocuSign + Drive are the honest integration story.
- **The assets exist.** 31 outreach files across 5 verticals, all claims-grounded, merged 2026-06-16.
- **The motion does not.** Zero outreach has fired in ~2.5 weeks. Zero named prospects, no booking link, no CRM of record, no demo environment named in any script. (Kaizen 05, friction 1–5.)
- **The binding constraint is the trust gap.** Zero paying customers, zero social proof, founder bio unshipped. The only honest cure is 3–5 on-record design partners — which requires outreach to start.
- **Product gates that sequence sales** (do not sell past these):
  - Prod `ANTHROPIC_API_KEY` is paused pending live cost-governor verification. **A design partner cannot pilot until this un-pauses.** Outreach can start now (2–4 week lag to first pilot), but activation cannot.
  - CPA connectors TaxDome/Karbon are advertised-but-unconnectable (audit 5, P0-1). CPA outreach waits or scopes to QuickBooks-centric firms.
  - The client portal is 0%-activatable (audit 6). It is not demoable and not sellable.
  - The saved-time counter undercounts sweep work (audit 9, P0-1) and the "live counter" copy overclaims. Case-study measurement leans on it — fix before the first pilot's week 1.
  - `/how-it-works` is shadowed by a stale redirect (audit 1, P0). Outreach links point to `/` and `/pricing` until fixed.

## 2. The 90-day outcomes (defensible, not aspirational)

Design partners run **3 months free** (claims spine §5), so **the 90-day scoreboard is partners and pipeline, not revenue.** First paid conversion is a day-90–120 event by construction. Any standard self-serve trial that converts along the way is upside, not plan.

| Milestone | Day 30 | Day 60 | Day 90 |
|---|---|---|---|
| Named beachhead prospects (list, enriched) | 50 | 80 | 120 |
| First-touch sends (cumulative, founder-sent) | 20 | 45 | 70 |
| Discovery calls held | 3 | 8 | 12–15 |
| Design-partner agreements signed | 0–1 | 2 | **3–5 (the binding-constraint number)** |
| Pilots activated (gated on prod-key un-pause) | 0 | 1–2 | 2–3 |
| Case studies in flight (real, partner-approved fields filling in) | 0 | 1 | 2 |
| Weighted pipeline (MRR-equivalent at conversion, method in 06) | — | ~$1.0k | ~$2.0–2.5k |
| Revenue | $0 | $0 | $0 planned; first conversions land day 90–120 |

Assumption chain, stated so it can be checked weekly: 5 sends/week sustained → ~20–25% reply on warm-path + association-sourced RE outreach → ~1 discovery call per 5 sends → ~1 design-partner agreement per 3–4 discovery calls. These are operator estimates, not benchmarks we've earned; document 06 replaces them with observed rates from week 3 onward.

## 3. The three highest-leverage moves

**1. Start the clock: a weekly founder rhythm that dogfoods our own pattern.**
Monday: the fleet researches ~10 new prospects and drafts 5 first-touches + due follow-ups into an approval queue. Conner reviews, edits, and sends from his own inbox (60–90 min). Friday: 15-minute pipeline review against document 06. This is exactly the draft-and-approve, no-outbound architecture we sell — the founder's own approval queue becomes the first proof artifact. **5 sends/week sustained beats 50 sends once.** Nothing else in this plan matters if this rhythm doesn't start.

**2. Concentrate on the beachhead: real estate, Georgia-first, 50 names before any second front.**
Ratified channel (money-GTM 2026-06-14): founder-led design-partner outreach into vertical communities; beachhead = real estate (live killer workflow, counsel-ready corpus, Conner's FlatSBO-adjacent network and warm paths). Property-management and general open as secondary lanes only when the RE cadence is stable; **CPA and law stay closed until 2 RE pilots are live** (and, for CPA, until the connector P0 is fixed). This resolves the five-front-war default the kaizen flagged.

**3. Fix the conversion path before scaling volume.**
Every send today dead-ends at `{{CALENDLY_LINK}}`. Before week 1 closes: booking link provisioned, CRM of record live with the pipeline stages in document 06, the synthetic-data demo runtime (PR #303) named in the discovery agenda as *the* demo, and the prod-key un-pause sequenced with engineering so an eager partner isn't left waiting. Volume into a broken last mile burns the most expensive prospects we will ever contact — the first ones.

## 4. Operating cadence and the Conner-dead-day test

**Weekly founder budget: ~2 hrs pre-pilot** (Monday send block + Friday review), **+30 min per active pilot** (the sanctioned design-partner weekly call — the one Conner-time exception outside Max/Custom, per claims spine §5 and `lib/billing/facts.ts`).

**If Conner disappears for a day, nothing breaks:**
- All assets, ICPs, scripts, and this plan live in the repo; the CRM of record holds per-prospect state and next-action dates outside anyone's head.
- The fleet's Monday research/draft run fires regardless; drafts wait in the queue — by architecture, nothing sends itself.
- No SLA in the motion is shorter than 48h; a missed weekly pilot call reschedules by template.
- An SDR (or any operator) can run the entire motion from documents 01–06 except the discovery call itself and the weekly pilot call, which are founder-voiced until a repeatable recording library exists (document 04 starts one: every call recorded with consent).

**What degrades at a week+:** discovery calls stall (mitigation: the recorded product walkthrough in document 02's proof ladder substitutes a first live call); pilot weekly calls slip (mitigation: async Loom + written check-in template). The motion is deliberately shaped so the founder is the *closer*, not the *pipeline*.

## 5. Decisions this plan needs from Conner (blocking, in order)

1. **Cohort target ratified: 3–5 design partners total** (claims spine) — this plan adopts it and treats the money-GTM "10 RE partners" as the *prospecting funnel width*, not the signed-cohort target. Confirm or overrule.
2. **Founder-time budget:** commit the ~2 hrs/wk + 30 min/pilot. A number, on the calendar.
3. **Accounts + spend** (document 03): Apollo, Calendly, HubSpot Free — ~$100–160/mo Month 1. Cards and identities only Conner can create.
4. **Prod-key un-pause sequencing** with the cost-governor verification — target date, so outreach pacing can be set honestly.
5. **Founder bio + on-record identity** (held since the SEO wave). With zero customers, the founder is the only proof surface; this is sales-critical now.
6. **Pre-outreach copy fixes:** `/how-it-works` redirect (audit 1 P0), `/security` named-individual line (audit 1 P1), guarantee reconciliation (audit 9 P1-4) — skeptical, liability-conscious prospects will read these pages.

## 6. What this plan will not do

No fabricated logos, quotes, counts, or "trusted by." No outreach drafts written ahead of the program start (per the no-outreach-drafts-until-ready rule; the fleet drafts them into the queue when the rhythm fires, and a human sends every one). No outbound tooling inside the agentplain product — the GTM stack in document 03 is the founder's own toolchain, consistent with the no-outbound architecture. No naming the model vendor in any sales conversation (handling in document 04). No claims that don't trace to `CLAIMS_GROUND_TRUTH.md` or to code.
