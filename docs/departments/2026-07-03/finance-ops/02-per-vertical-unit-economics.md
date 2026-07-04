# Per-vertical unit economics — RE / CPA / Law / PM at 1, 10, 100 customers

**Date:** 2026-07-03 · **Owner:** Head of Finance & Ops
**Basis:** `docs/business-plan/unit-economics.md` (2026-06-14, code-verified call profiles — still forward-modeled, key paused), `lib/pricing/tiers.ts` (price ladder), `lib/billing/facts.ts` (trial/guarantee mechanics — read, not changed), `lib/verticals/index.ts` (vertical registry).
**Honesty rule:** the prod Anthropic key is paused; **no customer has ever exercised the runtime.** Every dollar below is MODELED unless marked measured. "TODO: measured after telemetry live" marks each cell that `01-spend-telemetry-wiring.md` + un-pause will replace with an actual.

---

## 1. What `facts.ts` contributes to unit economics (read-only)

These billing-policy facts are cost inputs, and they differ by vertical:

| Fact (from `lib/billing/facts.ts`) | Value | Unit-economics consequence |
|---|---|---|
| `TRIAL_PERIOD_DAYS` | 7 | ~7 days of COGS served before revenue, most verticals |
| `TRIAL_PERIOD_DAYS_EXTENDED` + `EXTENDED_TRIAL_VERTICAL_SLUGS` | 14 for `cpa`, `law` | CPA/Law carry **double the unpaid-COGS window** (~$0.50–1.00 modeled per trial — negligible, but it's a real asymmetry) |
| `CARD_REQUIRED_AT_SIGNUP` | true | Trial-to-paid friction is front-loaded; no card-chase cost at conversion |
| `MONEY_BACK_GUARANTEE_DAYS` | 14 | A refund returns revenue but not Stripe's ~2.9% + $0.30 or the COGS served — each refund costs ~$6–9 hard |
| `CONNER_TIME_TIERS` = {max} | Max only | Regular/Partner unit economics contain **zero reserved founder hours** by policy — the human-service COGS line is $0 unless the tier is Max |

The guarantee interacts with a known defect: 4 of 7 calibrated actions have no saved-time writer (audit 9/10, PR #328), so walk-away refunds can fire wrongly. That is the only **recurring negative unit-economics event** identified anywhere in the product. It is Engineering's row 11 in the master fix table; Finance & Ops treats it as margin defense (see `07`).

## 2. Price and contribution by vertical (modeled)

Tier ladder from `lib/pricing/tiers.ts`: Regular $199 → $99 at 50–99 seats; Partner $299 → $199; Max quote-based. Default tier per vertical follows the sales deep-dive beachhead mapping; COGS profiles from unit-economics §3.

| Vertical | Typical entry config | Price/mo | Modeled COGS/mo | Contribution/mo | GM |
|---|---|---|---|---|---|
| **Real estate** (`real-estate`) | Regular, 1 seat | $199 | $9.61 (Profile A) | **$189.39** | 95.2% |
| **CPA** (`cpa`) | Partner, 1 seat | $299 | $14.80 (Profile B) | **$284.20** | 95.1% |
| **Law** (`law`) | Partner, 1 seat, 14d trial | $299 | ~$13–15 (Profile-B-shaped; see §3 Law note) | **~$284–286** | ~95% |
| **Property management** (`property-management`) | Partner, 1–3 seats (50–500 doors) | $299–$837 | $14.80–$36.21 (Profile B→C shaped) | **$284–$801** | ~95% |

COGS composition is the same everywhere and Stripe is the largest line in all four — bigger than LLM + infra combined (unit-economics §3, §6). Token spend is nearly volume-insensitive because the killer workflows are deterministic templates with 0 LLM calls/run.

## 3. Per-vertical notes — where the models differ and what's unverified

**Real estate — the ratified beachhead, and the only fully walkable path.**
- Live workflows: lead-triage-realestate (0–1 batched Opus call, only with FEEDBACK rules set), follow-up chaser, inbox triage, pulses. LLM line ~$1.50/mo.
- Compliance corpus exists and only RE fires live (`lib/agents/sentinel`) — RE is the vertical where the compliance-watch cost line (~$0.28–0.70/mo) is real rather than hypothetical.
- This is where the CEO lever (5 GA sends Monday) points; the first measured actuals will be RE actuals. TODO: measured after telemetry live.

**CPA — best contribution, blocked funnel.**
- Month-end-close is 0 LLM calls by default (`MONTH_END_CLOSE_LLM_POLISH=off`). The latent multiplier — polish at up to 2 Sonnet calls × engagements — is flag-gated off; turning it on is a deliberate margin decision that goes through the budget governor (`04`).
- The funnel is dead ahead of unit economics: TaxDome/Karbon are advertised but unconnectable through any UI (audit 5/10; api-key connect fixed in #355, TaxDome/Karbon now honest coming-soon). **Cost-per-customer is moot at zero connectable customers.** 14-day trial doubles the unpaid window.
- TODO: measured after telemetry live AND connectors land.

**Law — modeled by analogy, thinnest evidence base.**
- law-intake-conflict-screen is deterministic (0 LLM). Chat/support/pulse profile assumed Profile-B-like, but law has no measured or even audit-level usage profile of its own, and the law sentinel corpus has no live fires. 14-day trial applies.
- Label: **modeled-by-analogy.** TODO: measured after telemetry live and first law pilot; until then this column should not be quoted externally.

**PM — real vertical, real skill, no profile of its own.**
- `lib/verticals/property-management` targets 50–500-door SFR managers; rent-collection-chase is live and template-based (0 LLM), same shape as invoice-chase. Volume (doors, tenants, tickets) drives template renders, not tokens — the Profile C lesson applies: a heavy PM shop's high volume costs ~$0 extra in LLM.
- Multi-seat is likelier here (office staff), so Stripe-fee and infra lines scale with seats while the LLM line barely moves — PM at 3 seats is the Profile C economics ($36.21 COGS on $837, 95.7% GM).
- Label: **modeled-by-analogy to Profile B/C.** TODO: measured after telemetry live.

## 4. Cost-per-customer at 1 / 10 / 100 customers (modeled)

Infra is fleet-shared (one Neon, one Vercel project, one Resend), so the allocated-infra line per customer falls with count while LLM + Stripe stay linear. Fixed-cost bands from the CEO pass (lean ~$500 / operating ~$1,500 — planning bands, Z not yet measured). Per-customer **COGS** below excludes fixed costs; the "fully loaded" line divides the operating-band Z across the customer count to show when overhead stops dominating.

| Scale | Infra allocation/customer | RE (Regular $199) | CPA (Partner $299) | Law (Partner $299) | PM (Partner, 1 seat $299) |
|---|---|---|---|---|---|
| **1 customer** | full shared stack rides on one customer: ~$25–50 | COGS ~$33–58 · GM ~71–83% | ~$37–62 · ~79–88% | ~$36–61 · ~80–88% | ~$37–62 · ~79–88% |
| **10 customers** | ~$3–5 | COGS ~$11–13 · GM ~94% | ~$15–17 · ~94% | ~$14–16 · ~95% | ~$15–17 · ~94% |
| **100 customers** | ~$1.50–2.50 | COGS ~$9–10 · GM ~95% | ~$13–15 · ~95% | ~$13–15 · ~95% | ~$13–15 · ~95% |
| Fully loaded @ operating Z ($1,500/mo) | — | 1 cust: deeply negative · 10: Z adds $150/cust · 100: $15/cust | same pattern | same pattern | same pattern |

Readings:
- **The 1-customer column is the honest anomaly:** one customer carries the whole shared stack, so GM dips to ~70–85% — still healthy, and it recovers to ~94% by customer 10. There is no scale threshold below which a customer loses money on COGS.
- **Fixed costs, not COGS, decide profitability at this stage.** At operating-band Z, 9 blended seats reach cash-breakeven (CEO pass §2). The per-customer question is settled; the how-many-customers question is the whole game.
- **Every cell above: TODO: measured after telemetry live.** The replacement source is `LlmUsageRecord` via `getWorkspaceUsageReport` (per-workspace, per-window) once the key un-pauses, plus the fixed-cost ledger from `03`.

## 5. Re-baseline commitment (so this doc doesn't rot like its parent)

`docs/business-plan/unit-economics.md` §7's own action items sat unactioned for three weeks (kaizen friction #4). This doc therefore carries an expiry: **within 14 days of prod-key un-pause, Finance & Ops re-issues §2–§4 with measured actuals** from the first pilot workspaces, and the modeled labels come off cell by cell — or the cells get deleted. A forward-estimate model that never meets actuals decays into fiction; this one has a meeting scheduled.
