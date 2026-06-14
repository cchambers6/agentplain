# agentplain — Unit Economics

**Prepared:** 2026-06-14 · **Author:** fleet (Opus 4.8) · **Status:** decision input, not ratified

This is the cost-and-margin model for agentplain's self-serve subscription business.
Every number traces to a file path, a vendor pricing page (read date inline), or a
stated assumption. Per `feedback_no_guesses_no_estimates.md`, assumptions are labeled
as such and surfaced, never buried.

---

## 0. The headline (read this first)

The production-growth plan (`project_production_growth_plan_2026_06_05.md`, PR #139)
flagged the margin risk that **"at post-wave-8 model mix a heavy workspace's Anthropic
tokens ($162–279/mo) are at or below the $99–199 subscription."** That fear assumed
every customer-facing draft is an Opus generation.

**The shipped architecture does not work that way.** The five live killer workflows are
**deterministic templates with operator merge-fields — zero LLM calls per execution:**

| Killer workflow | LLM calls / run | Source |
|---|---|---|
| invoice-chase-general | **0** (templates) | `lib/skills/invoice-chase-general/skill.ts` |
| law-intake-conflict-screen | **0** (deterministic match + templates) | `lib/skills/law-intake-conflict-screen/skill.ts:59-120` |
| home-services-estimate-followup | **0** (stage-routed templates) | `lib/skills/home-services-estimate-followup/skill.ts:39-80` |
| month-end-close-cpa | **0** by default (`MONTH_END_CLOSE_LLM_POLISH=off`) | `lib/skills/month-end-close-cpa/polish.ts:40` |
| lead-triage-realestate | **0–1** (one batched Opus call, only if FEEDBACK rules set) | `lib/skills/lead-triage-realestate/llm-refine.ts:74-97` |

Real LLM spend is confined to three surfaces, all on cheap or cached models:

1. **Plaino chat** — 1 Haiku call/message, system prompt cached (`lib/plaino/dispatcher.ts:149-156`)
2. **Weekly synthesis pulses** (analytics / finance / content-calendar) — 1 Opus call/week each, cached
3. **Support-handler** — 1 Opus call/request (`lib/skills/support-handler/skill.ts:158-176`)

**Consequence:** typical per-customer LLM COGS is **$1.50–$10/mo**, not $162–279.
At a 1-seat subscription the **largest single COGS line is the Stripe processing fee
($6–9/mo), not Anthropic.** Blended gross margin is **~95%**. The full model is below.

The margin risk has not disappeared — it has **moved into the future**: the day we
upgrade killer-workflow drafts from templates to per-item Opus generation (a quality
play), COGS jumps by 1–2 orders of magnitude on the highest-volume verticals. The
per-customer token-budget enforcer (Deliverable 3) is the guardrail that lets us make
that upgrade without margin blowout. **Build the meter before we need it, not after.**

---

## 1. Cost basis

### 1.1 Anthropic token rates

Forward-looking list pricing (per the brief, 2026-06-14), USD per million tokens:

| Model (code id) | Input | Output | Cache write (1.25×) | Cache read (0.1×) |
|---|---|---|---|---|
| Haiku 4.5 (`claude-haiku-4-5-20251001`) | $0.80 | $4.00 | $1.00 | $0.08 |
| Sonnet 4.6 (`claude-sonnet-4-6`) | $3.00 | $15.00 | $3.75 | $0.30 |
| Opus 4.8 (`claude-opus-4-7` pinned today) | $15.00 | $75.00 | $18.75 | $1.50 |

> **Note on drift:** the in-repo cost table (`lib/billing/usage/pricing.ts:65-85`)
> uses Haiku **$1/$5** (vs the $0.80/$4 above) — it was cached 2026-05-28 and is the
> conservative side (slight over-bill, never under-bill). Pricing is matched by family
> substring, so the `4-7 → 4-8` Opus rename does not change the rate. **Action:** refresh
> `pricing.ts` Haiku rates to $0.80/$4 to keep the customer-facing usage meter exact.

Model tiers are pinned per-skill in `lib/llm/model-tiers.ts`; the provider chain is
`Logging( Budget( Routing( Sentinel( Caching( KeyRotation( Anthropic ))))))`
(`lib/llm/index.ts:26`). Prompt caching is on by default (`CachingLlmProvider`,
`LLM_PROMPT_CACHE=off` to disable); cost-aware downgrade routing exists but is **off by
default** (`LLM_MODEL_ROUTING=on`).

### 1.2 Per-call cost (steady-state, cache warm)

Derived from the token profiles in §2, rates from §1.1:

| Surface | Model | In / cache-read / out (tok) | Cost / call |
|---|---|---|---|
| Plaino chat message | Haiku | 550 / 450 / 400 | **$0.0021** |
| Inbox-triage (batched) | Haiku | 550 / 450 / 900 | **$0.0041** |
| Analytics / finance pulse | Opus | 300 / 110 / 700 | **$0.057** |
| Content-calendar | Opus | 300 / 110 / 900 | **$0.072** |
| Compliance digest | Opus | 300 / 110 / 400 | **$0.035** |
| Support-handler reply | Opus | 900 / 0 / 800 | **$0.074** |
| Research brief | Opus | 700 / 110 / 1000 | **$0.087** |
| Lead-triage refine (conditional) | Opus | 790 / 110 / 600 | **$0.057** |

*Assumption:* output tokens are typical, not the `max_tokens` ceiling (e.g. dispatcher
caps at 700 but a chat reply averages ~400). Cache-read assumes the system prompt was
written once earlier in the cycle; first-of-cycle calls cost ~$0.002 more on Opus.

### 1.3 Infrastructure rates (fleet-shared, not per-customer)

| Vendor | Plan / rate | Read date | Source |
|---|---|---|---|
| Vercel | Pro $20/seat/mo, includes $20 usage credit; functions $0.60/M invocations | 2026-06-14 | [makerkit](https://makerkit.dev/blog/saas/vercel-cost), [costbench](https://costbench.com/software/developer-tools/vercel/) |
| Neon (Postgres) | Launch $5/mo min, compute ~$0.14/CU-hr, storage $0.35/GB-mo; Scale $69/mo | 2026-06-14 | [simplyblock](https://vela.simplyblock.io/articles/neon-serverless-postgres-pricing-2026/) |
| Resend (email) | Free 3k/mo; Pro $20/mo for 50k; overage $0.90/1k | 2026-06-14 | [Resend](https://resend.com/changelog/pay-as-you-go-pricing), [stackscored](https://www.stackscored.com/pricing/transactional-email/resend/) |
| Stripe | 2.9% + $0.30 per successful charge | 2026-06-14 | stripe.com/pricing (standard US card) |

Infra is **shared** (single multi-tenant Postgres with RLS, one Vercel project, one
Resend account). Per-customer marginal infra is therefore small; the model allocates it
conservatively in §3.

---

## 2. Per-workflow LLM cost breakdown

Each row: trigger + cadence, the LLM-call profile (verified in code by the exploration
pass), and the expected monthly fires per active workspace. **"Fires"** is the number of
times the workflow produces an LLM call — template-only rows never call the model.

| Workflow | Trigger / cadence | LLM calls per fire (model) | Caching | Cost / fire | Typical fires/mo | Monthly $ |
|---|---|---|---|---|---|---|
| invoice-chase-general | cron daily 06:00 | 0 | — | $0 | 30 | **$0.00** |
| law-intake-conflict-screen | cron daily 07:00 | 0 | — | $0 | 30 | **$0.00** |
| home-services-estimate-followup | cron daily 09:00 | 0 | — | $0 | 30 | **$0.00** |
| follow-up-chaser-general | cron hourly | 0 | — | $0 | 730 | **$0.00** |
| month-end-close-cpa | cron monthly | 0 (polish off) | n/a | $0 | 1 | **$0.00** |
| lead-triage-realestate | per inbound lead | 0–1 Opus (batched, only w/ FEEDBACK rules) | yes | $0.057 | 0–10 | **$0.00–0.57** |
| Plaino chat | per message | 1 Haiku | yes | $0.0021 | 25–300 | **$0.05–0.63** |
| inbox-triage-general | per inbox sweep | 0–1 Haiku (batched) | yes | $0.0041 | 22 | **$0.09** |
| analytics-weekly-pulse | cron Mon, if activity | 0–1 Opus | yes | $0.057 | 4.3 | **$0.25** |
| finance-pulse | cron Mon, if activity | 0–1 Opus | yes | $0.057–0.072 | 4.3 | **$0.25–0.31** |
| content-calendar-drafter | cron Mon | 1 Opus | yes | $0.072 | 4.3 | **$0.31** |
| compliance-watch | cron daily, if matches | 0–1 Opus | yes | $0.035 | 8–20 | **$0.28–0.70** |
| support-handler | per support request | 1 Opus (if substrate hit) | no | $0.074 | 4–40 | **$0.30–2.96** |
| research-on-demand | per /talk INSTRUCT | 0–1 Opus | no | $0.087 | 0–5 | **$0.00–0.44** |
| chief-of-staff / process-doc refine | conditional on rules | 0–1 Sonnet/Opus | yes | $0.05 | 0–4 | **$0.00–0.20** |

**Cost multipliers to watch:** there are currently **no per-item LLM loops** — every
skill batches all items (all leads, all messages, all matches) into one prompt. The only
latent multiplier is `month-end-close-cpa` polish (up to 2 Sonnet calls × engagements),
which is flag-gated off. This is why COGS is flat regardless of a workspace's invoice /
lead / estimate volume: **volume drives template renders, not token spend.**

---

## 3. Three customer profiles — raw vs optimized COGS

Each profile sums the §2 monthly LLM cost, plus allocated infra, plus the Stripe fee on
the subscription charge. "Optimized" = caching warm + `LLM_MODEL_ROUTING=on` (analytics
pulse → Sonnet, classifiers already Haiku).

### Profile A — Light realtor (Regular, 1 seat, $199/mo)

| Line | Raw | Optimized |
|---|---|---|
| Plaino chat (25 msg) | $0.05 | $0.05 |
| Pulses (analytics+finance+content) | $0.73 | $0.40 |
| Compliance-watch (~8 fires) | $0.28 | $0.28 |
| Support-handler (4) | $0.29 | $0.29 |
| Inbox-triage + misc | $0.19 | $0.15 |
| **LLM subtotal** | **$1.54** | **$1.17** |
| Infra (Neon+Vercel+Resend allocated) | $2.00 | $2.00 |
| Stripe fee (2.9% + $0.30 on $199) | $6.07 | $6.07 |
| **Total COGS** | **$9.61** | **$9.24** |
| **Gross margin on $199** | **95.2%** | **95.4%** |

### Profile B — Medium CPA (Partner, 1 seat, $299/mo)

| Line | Raw | Optimized |
|---|---|---|
| Plaino chat (60 msg) | $0.13 | $0.13 |
| Pulses (active, QB-connected finance) | $0.87 | $0.55 |
| Compliance-watch (~15) | $0.52 | $0.52 |
| Support-handler (12) | $0.88 | $0.88 |
| Research briefs (3) + month-end-close | $0.24 | $0.24 |
| Inbox-triage + misc | $0.19 | $0.15 |
| **LLM subtotal** | **$2.83** | **$2.47** |
| Infra allocated | $3.00 | $3.00 |
| Stripe fee (on $299) | $8.97 | $8.97 |
| **Total COGS** | **$14.80** | **$14.44** |
| **Gross margin on $299** | **95.1%** | **95.2%** |

### Profile C — Heavy home services (Partner, 3 seats, $279×3 = $837/mo)

| Line | Raw | Optimized |
|---|---|---|
| Plaino chat (300 msg, 3 seats) | $0.63 | $0.63 |
| Pulses | $0.85 | $0.55 |
| Compliance-watch (~20) | $0.70 | $0.70 |
| Support-handler (40) | $2.96 | $2.96 |
| Estimate-followup (template, high volume) | $0.00 | $0.00 |
| Lead-triage + inbox + misc | $0.50 | $0.40 |
| **LLM subtotal** | **$5.64** | **$5.24** |
| Infra allocated (3 seats activity) | $6.00 | $6.00 |
| Stripe fee (on $837) | $24.57 | $24.57 |
| **Total COGS** | **$36.21** | **$35.81** |
| **Gross margin on $837** | **95.7%** | **95.7%** |

**Reading these:** (1) LLM is the *smallest* of the three COGS lines in every profile —
Stripe is the largest. (2) Optimization (routing) saves ~$0.30–0.40/customer/mo —
real at 1,000 customers ($300–400/mo) but not the lever that matters at pilot scale.
(3) The heavy profile's high volume (estimates, leads, invoices) costs **nothing** extra
because those workflows are templates. Margin is volume-insensitive **today**.

---

## 4. Pricing recommendation by tier

COGS is ~5% of revenue at every tier, so **price on value, not cost** (consistent with
the wrapper positioning: the product is the done-for-you service, not metered compute).
The recommendation is to **keep the current ladder** (`lib/pricing/tiers.ts`) and add a
per-tier **internal token budget** as the margin guardrail.

| Tier (display / enum) | 1-seat price | Token budget (internal $/mo) | Typical LLM spend | Headroom | Gross margin |
|---|---|---|---|---|---|
| **Solo** (Regular / `regular`) | **$199** | **$40** | $1.50–3 | 13–27× | ~95% |
| **Partner** (Plus / `plus`) | **$299** | **$80** | $3–6 | 13–27× | ~95% |
| **Max** (`max`) | **$499+ / quote** | **custom (≥$250)** | $6–25 | tuned per deal | ~92%+ |

- **Token budget ≠ price.** It is the `tokenBudgetUsdMonthly` cap (`lib/billing/budget.ts`)
  that prevents a runaway or abusive workspace from inverting margin. It sits at **13–27×
  typical usage** so a normal customer never sees it; it only catches the pathological
  tail (scripted chat abuse, or a future full-LLM workflow upgrade gone wide).
- **Volume bands** (`PER_SEAT_MONTHLY_USD_CENTS`) stay as-is: Solo $199→$99, Partner
  $299→$199 across 1→50-99 seats. Budgets scale per-seat (e.g. Partner budget =
  $80 × seats).
- **Max** is quote-based (`isSelfServeTier` false) → `/custom?type=max`; price reflects
  white-label / multi-state / dedicated-team intensity, with the budget set in the deal.

### Break-even customer count

Contribution per customer ≈ price − COGS:
- Solo $199 − $9.61 = **$189.39**
- Partner $299 − $14.80 = **$284.20**

Against fixed costs:

| Fixed-cost scenario | Monthly fixed | Break-even (Solo $189) | Break-even (Partner $284) |
|---|---|---|---|
| **Infra only** (Conner's time sunk) — Vercel+Neon+Resend+monitoring ~$300 | $300 | **2 customers** | **2 customers** |
| **+ one service/ops hire** (~$7,000 loaded) | $7,300 | **~39 customers** | **~26 customers** |
| **+ small team** (2 service + tooling ~$16,000) | $16,300 | **~86 customers** | **~58 customers** |

**The decisive number: ~2 customers covers infrastructure; ~25–40 covers the first
full-time service hire.** What you scale against is the **human service layer**, not
compute — exactly the moat the wrapper positioning is built on
(`project_sbm_wrapper_positioning_2026_06_06.md`). Compute will never be the constraint;
staffing the "we run it for you" promise will be.

---

## 5. Pass-through line items vs included buckets (usage-meter UX)

**Decision: self-serve tiers are all-inclusive. No per-token pass-through. No surprise
bills.** This matches the trust posture the sales audit (INBOX 2026-06-11) flagged as the
#1 conversion lever and the "we run it for you" promise.

| Item | Self-serve (Solo / Partner) | Max / Custom |
|---|---|---|
| LLM tokens | **Included** in subscription, capped by internal budget | Pass-through allowed in SOW, or fixed retainer |
| Email / infra | **Included** | Included |
| Overage behavior | **Hard gate + upgrade CTA** (never an auto-charged overage) | Negotiated |

**Usage-meter UX (the customer-facing pane):**
- Shows **tokens + $ this cycle vs budget** as a calm progress bar
  (`getWorkspaceBudget` / `getWorkspaceUsageReport` already exist).
- Purpose is **transparency + upgrade trigger**, not billing. At 80% the customer gets
  one heads-up (Deliverable 3 §4); at 100% the fleet pauses *new expensive work* and
  shows an upgrade page — it does **not** silently bill more.
- The Stripe metered-billing rails exist (`lib/billing/usage/stripe-meter.ts`) but are
  **kept internal** for self-serve — reserved for Max/Custom retainers where a customer
  has explicitly opted into pass-through.

This makes the meter a **retention + expansion surface**, not a bill-shock surface.

---

## 6. Scale economics

Blended ARPU assumption: **$235/mo** (mix of Solo $199 and Partner $299, mostly 1-seat).
COGS scales: LLM and Stripe linearly per customer; infra sub-linearly (shared Postgres /
Vercel until a tier step).

| Customers | MRR | LLM COGS | Infra COGS | Stripe COGS | Total COGS | Gross margin | Gross profit/mo |
|---|---|---|---|---|---|---|---|
| **50** | $11,750 | ~$150 | ~$300 (Neon Launch, Vercel Pro 2-seat, Resend Pro) | ~$415 | ~$865 | **92.6%** | ~$10,885 |
| **200** | $47,000 | ~$600 | ~$700 (Neon Scale, read replica) | ~$1,660 | ~$2,960 | **93.7%** | ~$44,040 |
| **1,000** | $235,000 | ~$3,000 | ~$2,500 (Neon Scale + replicas, Vercel Enterprise-ish) | ~$8,300 | ~$13,800 | **94.1%** | ~$221,200 |

**Observations:**
- Gross margin holds at **92–94%** across two orders of magnitude. Compute is never the
  binding constraint.
- **Stripe is the single largest COGS line at every scale** (~3.5% of revenue), larger
  than LLM + infra combined. Lever: negotiated Stripe rates / ACH for annual plans
  trims ~$2–4K/mo at 1,000 customers.
- The cost that *does* grow with the customer base is **human service** (the moat) — it
  belongs in OpEx, not COGS, and is the real subject of the staffing plan. At 1,000
  customers the gross profit ($221K/mo) funds a service org of ~20–30 people at the
  ~25-40-customers-per-service-FTE ratio implied by §4.
- **The forward risk reprised:** if killer-workflow drafts move to per-item Opus
  generation, the heavy-profile LLM line could go from ~$6 to ~$60–120/mo (a
  home-services workspace generating 200 estimate drafts × ~$0.08 + 300 invoice chases).
  At 1,000 such customers that is +$60–120K/mo of COGS — margin drops from 94% to
  ~70–75%. **This is survivable and still a great business, but it must be a deliberate,
  metered decision** — which is exactly what Deliverable 3 enforces.

---

## 7. What to do with this

1. **Ship the token-budget enforcer (Deliverable 3)** before any move to LLM-generated
   drafts. It is cheap insurance on a currently-uncapped tail.
2. **Refresh `lib/billing/usage/pricing.ts`** Haiku rates to $0.80/$4.
3. **Keep the ladder; add per-tier budgets** ($40 Solo / $80 Partner / custom Max).
4. **Turn on `LLM_MODEL_ROUTING`** once verified — ~$0.30–0.40/customer/mo, free margin.
5. **Negotiate Stripe** (the real COGS line) and push annual/ACH for larger seats.
6. Per-vertical pricing nuance: see `docs/business-plan/per-vertical-pricing.md`.

*All COGS figures are modeled from code-verified call profiles and cited vendor rates;
the live Anthropic key is paused (`project_production_growth_plan`), so these are
forward estimates, not billed actuals. Re-baseline against `LlmUsageRecord` once the key
is restored and real traffic accrues.*
