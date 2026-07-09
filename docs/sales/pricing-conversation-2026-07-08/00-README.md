# Pricing conversation scripts — README

**Date:** 2026-07-08 · **Owner:** Conner (founder-voiced; the fleet maintains, never sends or quotes on its own)
**Sits on top of:** `docs/sales/deep-dive-2026-07-02/04-discovery-call-playbook.md` (the call itself) and `06-pipeline-and-forecasting.md` (what happens to the row afterward). Where this directory and the playbook disagree on call mechanics, the playbook wins; where either disagrees with code, **code wins** (`lib/pricing/tiers.ts`, `lib/billing/facts.ts`).

## What this directory is

The "how much?" moment, scripted. Every price, trial length, and guarantee term in these files traces to the billing SSOT. Nothing here invents a number, and nothing here is allowed to drift from the code without a PR that says so.

**Naming note (prevents a recurring drift):** the tiers are **Regular / Partner / Max** (`tierDisplayName`, `lib/pricing/tiers.ts:256-260`). "Solo" is not a tier — it is the 1-seat *band label* ("Solo (1 seat)", `lib/pricing/tiers.ts:137-143`). Say "Regular at the solo seat price" on a call, never "the Solo tier."

## Which script, when

| Situation | Script | Why |
|---|---|---|
| Prospect is a design-partner candidate (first-5 cohort, RE beachhead, qualified per playbook §4) | `01-design-partner-script.md` | The offer is 3 months free paid in proof, and the post-pilot price is stated up front so conversion never surprises anyone |
| Qualified but not a design-partner fit, or the cohort is full, or they decline the asks | `02-paid-tier-script.md` | Standard published pricing, value anchored before the number is named |
| "Seems expensive versus [FUB / Sierra / their CRM's AI]" — any comparison push-back | `03-response-to-cheap-comparison.md` | The DIY-vs-run-for-you reframe with the cost-of-time math |
| You are tempted to bend a term, or they ask you to | `04-discount-and-concession-limits.md` | The hard lines. Read it before the call, not during |
| Deciding *when* in the call to open pricing | `05-timing-and-cadence.md` | Default is the last quarter of the call; the signals that move it |
| Call prep and post-call review | `06-common-mistakes.md` | The 8 traps, each with the sentence that avoids it |

## What Conner memorizes vs reads

**Memorize (must come out naturally, without paper):**
1. The design-partner "how much?" opening (01 §2) — one paragraph.
2. The five numbers: **$199** Regular solo seat, **$299** Partner solo seat, **7-day** trial (14 for CPA/Law), **14-day** money-back, **3 months** free for design partners. (`lib/pricing/tiers.ts:110-123`, `lib/billing/facts.ts:27-30,51`.)
3. The concession floor: **never below the published ladder, ever, without your own prior written decision** (04 §2 — yes, you approving yourself, on purpose: the rule forces the decision out of the live call).

**Read from the page (fine to glance at, on-screen during a video call):**
- The full seat-band ladder (02 §3) — five bands × three tiers is a table, not a memory item.
- The objection long-forms in 03 — the short forms are memorized, the long forms are reference.
- The concession decision table in 04.

**Never on a call:** a price not in `lib/pricing/tiers.ts`; a trial or guarantee term not in `lib/billing/facts.ts`; a model-vendor name in either direction (playbook objection #6 is the only handling); "pilot pricing" (banned phrase — the design-partner program is 3 months free, which is a different and better-shaped thing).
