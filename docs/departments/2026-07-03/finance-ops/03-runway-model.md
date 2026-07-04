# Runway model — Conner-time + infra + tokens + APIs

**Date:** 2026-07-03 · **Owner:** Head of Finance & Ops
**Honesty header:** spend telemetry is NULL (`stampSessionCost` zero call sites) and no fixed-cost ledger exists in the repo. Everything below is a **planning band traced to a cited source**, with the measurement that replaces it named per line. Per `feedback_no_guesses_no_estimates`, no number here is invented — where a number does not exist, the line says so and names whose input unblocks it.

---

## 1. Monthly burn — the four components

### 1.1 Infrastructure (cash, recurring)

| Line | Band | Source | Replace with |
|---|---|---|---|
| Vercel Pro | ~$20/mo | unit-economics §1.3 (rate read 2026-06-14) | actual invoice |
| Neon Postgres (Launch) | ~$5–20/mo at current traffic | unit-economics §1.3 | actual invoice |
| Resend | $0 (free tier, 3k/mo) at current volume | unit-economics §1.3 | actual invoice |
| Domains (agentplain.com, flatsbo.com — flatsbo stays live per ratified override) | ~$3–5/mo amortized | registrar norm — **band, not sourced** | actual invoice |
| GTM stack (booking tool if any, email tooling) | $0–100/mo | CEO pass lean band ("infra + GTM stack ~$100–160/mo") | actual invoices |
| **Infra subtotal** | **~$30–160/mo** | | day-7 fixed-cost ledger (`00` step 6) |

### 1.2 Tokens (cash, semi-fixed)

| Line | Band | Source | Replace with |
|---|---|---|---|
| Prod Anthropic API | **$0 — key paused by policy** | `lib/llm/paused.ts` sentinel; ratified un-pause condition not met | `LlmUsageRecord` after un-pause |
| Fleet tokens (the agents building the company) | **NOT MEASURED** — runs on Conner's Claude plan(s); plan cost not on record | the NULL-spend state this department exists to end | `session-costs.yaml` (fleet usage) + Conner input #3 (plan cost) |

The fleet-token line is almost certainly the largest real spend of the whole operation today, and it is the one we cannot see. That is the single most embarrassing fact in this model and the reason `01` is days 1–3 of the executive plan.

### 1.3 APIs / other vendors (cash)

| Line | Band | Source |
|---|---|---|
| Stripe | $0 fixed (2.9% + $0.30 per charge — COGS, not burn, and $0 at zero revenue) | stripe.com standard |
| Twilio / voice layer | $0 — env-gated off (`lib/voice/`, PR #304) | code state |
| Telemetry vendor (Axiom/Datadog) | $0 — **not approved**; kaizen investment #1 deliberately deferred behind the zero-new-spend rule | this plan |
| Counsel | $0/mo recurring on record; no engaged counsel exists (kaizen 8/10) | legal retro |

### 1.4 Conner-time (the real cost, not cash)

- CEO pass working figure: ~10 hrs/wk at a rate R Conner sets (illustrative $150/hr → ~$6,450/mo). **R is not on record** — it is open question #1 in `docs/ceo/2026-07-02/04-open-questions-for-conner.md` and Conner input #2 below.
- Pre-revenue, Conner-time is donated, not burned — it does not shorten cash runway. It defines the **truly-profitable** bar instead: contribution must cover Z + H×R, which is what makes $10K MRR the real milestone (CEO pass §3).

## 2. Burn summary

| Mode | Cash burn/mo | What's in it |
|---|---|---|
| **Current** (key paused, paid media killed, no counsel retainer) | **~$30–160 known + fleet tokens (unmeasured)** — call it the **lean band, ≤ ~$500/mo** with the fleet-token allowance | infra + GTM stack + fleet plan(s) |
| Operating (key live under governor, first pilots) | ~$1,500/mo band | + prod tokens (governed, modeled $1.50–10/customer), + content ops | 
| Growth (paid test un-killed — **not currently authorized**) | ~$4,500/mo band | + $1.5–3K/mo paid media behind its 4-condition gate |

Bands are the CEO pass's §2 scenarios; they are planning bands and say so.

## 3. Months of runway

Runway = cash allocated to agentplain ÷ net monthly burn. **Cash allocated is not on record anywhere** — agentplain is founder-funded from personal cash flow and no treasury figure exists in the repo or memory. So the honest statement has two parts:

**(a) The rate, which we know within a band:**

| Burn mode | Runway per $1,000 allocated |
|---|---|
| Current / lean (≤ ~$500/mo) | **≥ 2 months per $1K** |
| Operating (~$1,500/mo) | ~0.67 months per $1K |
| Growth (~$4,500/mo) | ~0.22 months per $1K |

**(b) The projection at current burn:** at the lean band, a $5K allocation is **≥ 10 months**; $10K is **≥ 20 months**. If actual current burn is nearer the known-subscription floor (~$160/mo + a typical Claude Max plan ~$100–200/mo), those stretch toward 20–40 months. **The projected months-of-runway at current burn is therefore ≥10 months on any plausible allocation ≥ $5K — runway is not the binding constraint of this business.** The binding constraints are Conner-hours and activation (planning direction check, PR #350). This is a genuinely unusual and favorable position: the company can be patient with cash and must be impatient with sends.

**What changes the math:** un-pausing the key moves burn to the operating band only if pilots exist — and pilots carry contribution (~$185–284/seat/mo) that offsets the added burn almost immediately. At 9 blended seats the operating band is cash-covered (CEO pass §2). There is no scenario in the current plan where burn outruns a single-digit-customers business — **unless** an ungoverned token event occurs, which is exactly what `04` exists to make structurally impossible.

## 4. The three Conner inputs this model is blocked on

| # | Input | Unblocks | Effort |
|---|---|---|---|
| 1 | Cash allocated to agentplain (a number or "funded from cash flow up to $X/mo") | Runway as a measured statement instead of a rate table | one line |
| 2 | His rate R for Conner-time | The truly-profitable bar (Z + H×R) as a number; confirms/replaces the $10K MRR proxy | one line |
| 3 | Actual monthly cost of the Claude plan(s) the fleet runs on | The fleet-token line in §1.2; the largest unknown in current burn | one line |

Routed via the Conner queue with a 3-line reply template; also listed in `05` §3.

## 5. Where path-to-profit lands (the answer to "design for profitable")

Sequenced, each step cash-positive or cash-neutral:

1. **Now → first partner (lean band):** burn ≤ ~$500/mo, runway ≥ 10 months, zero new spend. The only investment is founder sends (5 GA RE emails Monday) and fleet wiring already covered by the Claude plan. Finance & Ops ships telemetry + governor certification.
2. **First partner signed → key un-pauses** (both ratified conditions met) with explicit caps on every pilot workspace. Burn steps toward the operating band; each converted seat contributes ~$185–284/mo against it. **Cash-breakeven at ~9 blended seats** — a single-digit-customers problem.
3. **~33 blended accounts → ~$10K MRR ≈ truly profitable** (covers Z + founder time at the illustrative rate). Timeline on the sales plan's own funnel rates: **month 8–12 from a July start, only if sends start this week** — every week of send-delay shifts the whole curve right by a week.
4. **Only after that** does the growth band unlock on its own 4-condition gate, judged inside the $370-CAC / 2-month-payback box.

Profit is not a cost problem at 95% modeled GM. It is a **customer-count problem with a measurement problem in front of it.** Finance & Ops' contribution is to delete the measurement problem (this PR) and guarantee the cost structure cannot silently change underneath the count (`04`).
