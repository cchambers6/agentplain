# Product's contribution to the profit equation

The equation (CEO 01, prices from `lib/pricing/tiers.ts`, contribution modeled):

```
Σ (seats × price × (1 − v)) ≥ Z + (H × R)
```

RE contribution ≈ **$185/seat/mo** at Regular $199 (~93%); cash-breakeven is **3–9 seats** depending on the Z band; truly-profitable ≈ **$10K MRR** (~33 blended accounts). Product cannot send emails or sign partners — but it owns four of the equation's coefficients. This document names them and binds each 14-day item to one.

## 1. Conversion (seats ↑): the five-minute path is the multiplier on Conner's hours

The funnel's scarcest input is founder sends (~5/week). Product determines how much revenue each send can possibly become: a prospect who reaches a demo that autoplays, a Connect that works, and a first draft in the queue converts at some real rate; a prospect who hits the audited dead-end converts at zero, and burns the most expensive prospects we will ever contact (the first five). Every activation item in 00 (E1–E3, D1, M1–M2) is a direct multiplier on the only growth motion the company has.
**Measured by:** TTFDV + the demo→connect→live funnel (DA1). Pre-instrumentation, the coefficient is unknown — which is why DA1 rides the same window.

## 2. COGS discipline (v ↓, held at ~0): the killer workflow is profitable by construction

Lead-triage runs deterministic, ~0 LLM calls (02 §3) — marginal runtime ≈ $0, so contribution holds ~93% at any scale, and the workflow demos and runs under the paused key. The freeze list (05) is the same lever from the other side: every LLM-dependent or new-surface feature not built is COGS and truth-maintenance burden not incurred. Post-un-pause, the compose-order stack (Logging(Budget(Sentinel(Caching(Anthropic))))) plus per-workspace budgets keep v bounded per seat — product's rule stands that no feature ships without a cost architecture that stays accretive at the 100/1k/10k bands (the profitability lens rule-check).
**Measured by:** modeled v vs the spend pipeline once Finance wires it (Z and v become numbers together).

## 3. Margin defense (leakage → 0): the guarantee must count what the fleet earned

Audit 09 P0-1 is the only finding that recurringly moves real dollars the wrong way: 4 of 7 calibrated actions write zero saved-time, so the Day-7 walk-away evaluates against an undercounting ledger and refunds customers the fleet actually served — while telling them "we failed you." E4 (writers on every path + bounded window + human-review mode until landed) converts the guarantee from a leak into the trust asset it was designed to be. At single-digit customer counts, **one wrongful refund is a material percentage of total revenue** — this is the highest ratio of margin protected to effort anywhere in the plan (profitability lens, `renewal.worth-it.1`).
**Measured by:** DA3's weekly writer assert; refunds issued only against real shortfalls.

## 4. Retention (churn ↓): the proof loop is the renewal case

CEO 01's sensitivity: above ~7–8%/mo churn, founder-led acquisition cannot hold $10K MRR — so retention is not a later problem, it is a structural precondition of the profitability math. Product's retention machinery, all in this plan: the saved-time counter accruing calibrated minutes from real runs (the "is this worth $199" answer, journey `renewal.worth-it.1`); the approval loop that notifies, paginates, and learns from reject-reasons (E6) so the daily rhythm sticks; and the honest-state model (03) so the product never manufactures the distrust that churns a customer faster than any missing feature. The same ledger feeds the first case study — retention evidence and sales proof are one artifact.
**Measured by:** approval latency (DA2), saved-time accrual per workspace, and — once customers exist — logo churn.

## 5. What Product does NOT claim

- No revenue this cycle: design partners run 3 months free; first conversion is a day-90–120 event by construction (sales plan §2). Product's 14-day contribution is coefficient-setting, not MRR.
- No invented dollars: every number above traces to `tiers.ts`, the CEO bands, or the calibrated `ACTION_MINUTES` table. Z remains unmeasured until the spend pipeline lands (Finance) — that gap is named, not papered over.

## 6. The one-line scoreboard for the next CEO pass

**Did the coefficients move:** TTFDV measured and ≤ 5 min on a fresh RE workspace · activation funnel instrumented end-to-end · saved-time writers at 7/7 actions with the guarantee in honest mode · honest-state chips live on Today/Connections · freeze list enforced (zero out-of-scope product PRs merged). Five checks, all verifiable by read-back on main — no narrative required.
