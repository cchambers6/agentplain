# Marketing deep-dive 2026-07-02 — Executive plan (next 90 days)

**Date:** 2026-07-02 · **Baseline:** `origin/main` @ `2beadb1` (post-#316/#320 Heritage rollout)
**Inputs:** full-product audit 2026-07-02 (depts 1–10, `docs/audits/full-audit-2026-07-02/agentplain/`), marketing kaizen retro (`docs/kaizen/2026-07-02/04-marketing.md`), money + GTM pack (`docs/business-plan/`, memory `project_money_gtm_pack_2026_06_14`), ratified positioning canon (`project_agentplain_mission_and_positioning`, `project_sbm_wrapper_positioning_2026_06_06`).
**Binding constraint:** Truth Wave. agentplain has zero paying customers and no on-record design partners. Every claim in this plan and every asset it produces must be defensible today. No invented counts, no vanity metrics, no "trusted by."
**Operational constraint:** the production LLM key is paused by policy — degraded mode is the live customer experience. Nothing in-market promises always-on AI. The honest frame is cadence: drafts land in your queue; you approve and send.

---

## Where we actually are (one paragraph)

The marketing *production system* is built and good: locked positioning, an executable voice and brand gate, a full Truth Wave behind us, ten deep vertical pages, AEO surfaces, paste-ready ad copy, a 90-day content calendar, and design-partner outreach packets. What we do not have is **distribution, proof, or measurement**: the number-one nav item 308-redirects past its own page (audit dept 1, P0), the strongest risk-reversal page is orphaned, one home-page proof number is unsubstantiated, nothing has shipped to an audience on a cadence, no analytics exist at all, and the proof shelf is empty because no customer is on record. The next 90 days are not about producing more assets. They are about **repairing the front door, earning proof, publishing on a rhythm, and wiring measurement — in that order.**

## The three highest-leverage plays

1. **Fix the front door before sending anyone to it.** One engineering-day of P0/P1 fixes from audit dept 1 — delete the `/how-it-works` redirect, link and sitemap `/guarantee`, substantiate or drop the `$2,900–$10,600/mo` proof-card range, add the root 404 — plus promoting the truth/voice/vendor gates from pre-push to required CI checks. Every dollar and every founder-hour of distribution lands on this surface; right now the site argues against itself.
2. **Run the design-partner proof engine.** Founder-led outreach to recruit 10 real-estate design partners (the ratified #1 channel — real-estate is the beachhead: live killer workflow, counsel-ready corpus, Conner's network). The goal is not revenue; it is the **proof shelf**: 3 named, permissioned proof assets (a quote, a workflow story, a saved-time number a customer will stand behind). Proof is the input every other channel is starved of.
3. **Turn the content library into a publishing cadence.** The calendar, the AEO surfaces, and the ground-truth docs exist; nothing publishes on a rhythm and nothing is measured. Stand up the weekly pipeline (brief → draft against ground truth → gates → publish → measure) at 2 pieces/week against vertical long-tail intent. Compounding beats bursts, and it is the only channel that costs no cash and no claims.

Paid media is deliberately **fourth**: it unlocks only when the front door is fixed, measurement is wired, and at least one proof asset exists (see `04-ad-creative-and-distribution.md` for the gate).

---

## Quarterly outcomes (Jul 2 – Sep 30, 2026)

Each outcome has one owner-readable result and one **leading indicator** reviewed weekly (cadence: the existing kaizen weekly loop, PR #273).

### Outcome 1 — The marketing surface is truthful, reachable, and gated in CI
**Result by Sep 30:** all audit-dept-1 P0/P1 marketing findings closed; brand-gate + voice-gate + a vendor-invisible check run as required CI status checks (so `HUSKY=0` can no longer land drift); a claims linter blocks vertical copy that asserts live compliance for a vertical not in `BASELINE_LIVE_VERTICALS`.
**Leading indicator:** open P0/P1 marketing-surface defects (target: 0 within 2 weeks, stays 0).
**First moves (week 1):** delete the `/how-it-works` redirect from `next.config.mjs`; link `/guarantee` from closing CTA + footer + FAQ and add it to the sitemap; replace the proof-card range with the ROI calculator's derivable math; open the CI-gate PR.

### Outcome 2 — A proof shelf exists: 3 on-record design-partner proof assets
**Result by Sep 30:** 10 real-estate design partners actively using the product; **3 permissioned, named proof assets** published (quote + workflow story + a saved-time figure the customer signed off on). Until then, marketing surfaces keep the current honest posture: dogfooding (the flatsbo brokerage) is the only production story we tell.
**Leading indicator:** design-partner conversations held per week (target: 5/wk founder-led; tracked in the sales pipeline of record).
**Dependency:** the guarantee/saved-time plumbing gaps from audit dept 9 (4 of 7 calibrated actions write no saved-time minutes) must close before we publish any saved-time number — a wrong number on the proof shelf is worse than an empty shelf.

### Outcome 3 — Content publishes on a measured weekly cadence
**Result by Sep 30:** 20+ pieces live (2/week sustained) against the keyword map in `02-seo-aeo-content-pipeline.md`, every piece passing voice-gate/brand-gate and written from the ground-truth docs; the 90-day calendar upgraded from plan to tracker (drafted / gated / published / measured).
**Leading indicator:** pieces published per week that pass all gates (target: 2, never 0).
**Second-order indicator (lagging, checked monthly):** indexed pages and answer-engine citations for our owned vocabulary ("run-for-you", service-partnership comparisons).

### Outcome 4 — Measurement is wired before a dollar of spend
**Result by Sep 30:** privacy-respecting analytics live on the marketing surface (currently there is none at all — audit dept 1 confirms zero tracking), UTM discipline documented, a self-reported "how did you hear about us" field at signup, and a weekly funnel review (visits → trial starts → activation) folded into the kaizen loop. Privacy page updated for whatever we deploy, through the counsel packet.
**Leading indicator:** % of new trials with a known source (target: >80% once live).

### Outcome 5 (conditional) — One measured paid test in real estate
**Result by Sep 30, only if Outcomes 1, 2 (first proof asset), and 4 are green:** a 6–8 week paid test on the realty concepts in `04-ad-creative-and-distribution.md`, $1.5K–$3K/month, judged on cost per qualified trial start — a reading, not a scaling decision.
**Leading indicator:** cost per qualified trial start vs. the planning band set in `06-measurement.md`.
**If the gate isn't met:** the budget rolls to photography production (the kaizen's #2 investment — the Heritage system ships with five photography briefs and zero produced photos).

---

## What marketing does NOT do this quarter

- **No new verticals, no repositioning, no rename.** Brand and positioning are locked (`project_brand_locked`, `feedback_no_new_verticals_finish_locked`).
- **No claims ahead of the runtime.** Only real-estate has a live compliance scanner; the other verticals' copy stays in "reviewed against your vertical's rules" territory per the claims linter.
- **No fabricated social proof.** No logos, counts, ratings, or "as seen in" until permissioned. The honest posture *is* the brand ("the most honest voice in a category full of hype" — content thesis).
- **No naming the model or vendor on any customer surface.** Sole exception: subprocessor disclosure on the privacy/security pages (`feedback_model_vendor_invisible_on_customer_surfaces`).
- **No promised email cadence we can't run.** The no-outbound architecture makes a "weekly newsletter" promise untrue; the waitlist stays honest by construction.

## Operating cadence

| Rhythm | What | Who |
|---|---|---|
| Weekly | Kaizen loop reviews the 5 leading indicators + the publishing tracker | Marketing owner (fleet) |
| Weekly | Flagged-for-Conner decision queue, batched (bio, `/security` absolutes, headline pricing, photography selects) — decisions that miss 2 cycles get an explicit "hold" and the surface hedges honestly | Conner, 30 min |
| Monthly | Competitive-intel scan updates `/compare/[alt]` + the SBM positioning memory | Marketing owner (fleet) |
| Monthly | Lagging metrics: indexed pages, answer-engine citations, funnel conversion | Marketing owner (fleet) |

## File map for this deep-dive

| File | What it gives a 2-person team on Monday |
|---|---|
| `01-competitive-positioning.md` | Who we're against per vertical and the words that win |
| `02-seo-aeo-content-pipeline.md` | 100 target keywords, content types, cadence, answer-engine tactics |
| `03-per-vertical-narrative.md` | ICP, pains, before/with, objections, and the proof to earn — per vertical |
| `04-ad-creative-and-distribution.md` | 25 ad concepts, budgets, platform mix, and the spend gate |
| `05-brand-voice-do-and-dont.md` | The applied voice rules every asset must pass |
| `06-measurement.md` | What we track before spending, attribution, and 30/60/90 "working" |
