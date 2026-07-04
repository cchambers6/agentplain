# Path to profitable — the equation, the scenarios, the first $10K MRR

**Pass 1, 2026-07-02. Prices from `lib/pricing/tiers.ts` / `lib/billing/facts.ts` (code supersedes this doc). COGS model from kaizen 07-finance. Funnel rates from the sales deep-dive — operator estimates, not earned benchmarks. Fixed costs are NOT MEASURED; the bands below are planning bands and say so.**

## 1. Definition

Two lines, in order:

- **Cash-profitable:** monthly contribution margin ≥ all-in monthly cash cost.
  `Σ (seats × price × (1 − v)) ≥ Z`
- **Truly profitable (the real bar):** cash-profitable *plus* the business pays for Conner's hours at a rate he sets.
  `Σ (seats × price × (1 − v)) ≥ Z + (H × R)`

Where:

| Variable | Value | Status |
|---|---|---|
| `price` | Regular $199 solo → $99 (50–99 seats); Partner $299 → $199; Max quote | Ratified, in code |
| `v` (variable cost share) | Stripe ~2.9% + $0.30, plus $1.50–$10/mo modeled tokens → **contribution ≈ $183–191/RE solo seat (~$185), ≈ $280–288/CPA Partner seat (~$282)** | Modeled, not measured — no customer has ever exercised the runtime |
| `Z` (fixed monthly cash: infra + fleet tokens + GTM stack + counsel amortized) | **Not measured.** Spend telemetry is unwired (`stampSessionCost()` zero call sites) | The single most embarrassing gap in this doc |
| `H × R` (Conner hours × his rate) | Not on record | Conner sets R; see 04-open-questions |

## 2. Cash-breakeven scenarios (planning bands, not measurements)

| Band | Z assumption | RE-only (@~$185/seat) | CPA-only (@~$282/seat) | Blended example |
|---|---|---|---|---|
| Lean (infra + GTM stack ~$100–160/mo, key paused) | ~$500/mo | **3 seats** | 2 | 2 RE + 1 CPA |
| Operating (key live under governor, telemetry vendor, content ops) | ~$1,500/mo | **9 seats** | 6 | 5 RE + 3 CPA |
| Growth (adds the gated $1.5–3K/mo paid test) | ~$4,500/mo | **25 seats** | 16 | 15 RE + 7 CPA |

The honest headline: **cash-breakeven is a single-digit-customers problem.** At ~95% modeled margin, this business does not need scale to stop losing money — it needs *any* customers. The first fleet task implied by this table is not a feature; it is wiring the spend pipeline so Z becomes a number (kaizen master #1).

## 3. First $10K MRR — the named milestone

$10K MRR matters because it is approximately the **truly-profitable** line: at Z ≈ $1,500 and founder time priced at ~$150/hr × ~10 hrs/wk (~$6,450/mo — illustrative; Conner sets R), the requirement is ~$8K/mo of contribution ≈ **$10K MRR at blended pricing**. Below it, the business runs on donated founder time; above it, it is a real company.

**Customer math (mixes that hit ~$10K):**

- Pure RE solo: **51 seats** × $199.
- Realistic blend: 2 small brokerages (8 seats @ $179 ≈ $2,864) + 20 RE solos ($3,980) + 11 CPA Partner solos ($3,289) ≈ **$10.1K from ~33 accounts**.
- CPA-heavy is fewer logos (34 solos) but is **blocked today**: TaxDome/Karbon unconnectable, CPA sentinel un-verified by counsel, no entity for engagement-letter-grade buyers. RE is the only walkable path right now — which is why it's the ratified beachhead.

**Timeline arithmetic on the sales plan's own rates** (5 sends/wk → ~1 discovery/5 sends → ~1 agreement/3–4 calls; design partners run 3 months free): day-90 target is 3–5 signed partners and $0 revenue; first paid conversions land day 90–120. If those rates hold and referrals/content add a second trickle, **$10K MRR is a month-8-to-12 event from a July start — and only if sending starts this week.** Every week of send-delay shifts the entire curve right by a week. No faster path exists that doesn't require proof we don't have or spend we've gated.

## 4. Sensitivity

- **Price:** the ladder cuts price ~2x at volume ($199→$99), so seat-count-to-$10K roughly doubles if growth comes through large brokerages. Early solo/small-team mix is margin-favorable. Do not discount below the ladder — at 95% modeled margin the constraint is trust, not price (and "pilot pricing" is banned; design partners get 3 months free instead, which is a better-shaped concession).
- **Churn: unmeasured and unmeasurable until customers exist.** At 5%/mo, holding 50 seats costs ~2.5 new seats/mo; at 10%, ~5/mo — which exceeds the founder-led acquisition rate the plan assumes. Translation: above ~7–8%/mo churn, founder-led outreach alone cannot hold $10K. The churn defenses are already ranked in the profitability lenses: saved-time evidence (guarantee writers), approval-loop notifications, honest trial terms.
- **CAC:** currently ~$0 cash — the channel is founder hours (~2 hrs/wk pre-pilot, +30 min/pilot). The paid test, if its gate is ever met, is judged on cost per qualified trial start against contribution of ~$185/mo — i.e., a CAC of $370 pays back in 2 months. That's the box paid spend must fit in.

## 5. What the fleet must ship before $10K is even possible

In order, all from the existing top-20 fix table — nothing new:

1. **Activation works:** Connect button wired to the credential form; first drafted value in 5 minutes (profitability RE row 1 — S effort, unblocks the whole funnel).
2. **Guarantee counts money right:** saved-time writers on all calibrated actions; auto-refund in human-review mode until then. This is margin defense — the only known recurring dollar leak.
3. **Trial truth everywhere** from `facts.ts` — the buy-moment surface cannot contradict itself.
4. **Prod key un-paused under the verified cost governor + per-workspace budgets** — a design partner cannot pilot on a paused key. Sequenced with the first outreach reply, not before, not after.
5. **Measurement:** spend pipeline wired (Z becomes real) + minimal product analytics (activation funnel, approval latency) — you cannot manage churn or CAC blind, and day one of real customers must not be day one of debugging.
6. **For the CPA slice of the mix:** the TaxDome/Karbon truth fix now (S), the QBO books-recon worker next (M — the only CPA agent whose data dependency is already live), live adapters later (L).

Everything else on the roadmap is either downstream of these or on the kill list (03).
