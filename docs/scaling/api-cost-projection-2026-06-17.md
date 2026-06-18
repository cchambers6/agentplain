# API cost projection at scale — 100 / 1K / 10K customers

**Date:** 2026-06-17
**Author:** fleet (overnight scaling build, item A)
**Status:** decision input — recommended budget caps need Conner sign-off (see `docs/strategic-build-2026-06-17/TODOS-FOR-CONNER.md`)

> **Why this exists.** When the prod `ANTHROPIC_API_KEY` is unpaused, every
> active workspace starts spending real Anthropic tokens. At 100 customers a
> bad cost model is a rounding error; at 10,000 it is the company. This is the
> math that says whether the cost-control infrastructure (per-workspace budget
> caps, tiered model routing, prompt caching) is enough — and where the
> remaining margin risk is.

---

## 1. Cited inputs (no estimates on the rates)

Anthropic list pricing, per **million tokens**, from
`lib/billing/usage/pricing.ts` (source cached 2026-05-28,
<https://www.anthropic.com/pricing>):

| Family | Input | Output | Cache write (5m) | Cache read |
|--------|------:|-------:|-----------------:|-----------:|
| Haiku 4.5 | $1 | $5 | $1.25 | $0.10 |
| Sonnet 4.5/4.6 | $3 | $15 | $3.75 | $0.30 |
| Opus 4.x | $15 | $75 | $18.75 | $1.50 |

Key structural facts that drive everything below:
- **Output is 5× input** on every model. Caching helps **input only** —
  output is the floor you cannot cache away.
- **Cache read is 0.10× input; cache write is 1.25× input.** A prefix that is
  reused even a handful of times pays for its write many times over.
- **Opus is 15× Haiku on input, 15× on output.** Tier routing is the single
  largest lever; caching is the second.

Revenue context (from `lib/pricing/tiers.ts`, per seat / month):
Regular **$199** (1 seat) → $99 (50+ seats); Partner **$299** → $199; Max
**$499** → $299.

---

## 2. Per-workspace monthly workload model (the one assumption to calibrate)

There is **no measured per-workspace token data yet** — the prod key has been
paused, so `LlmUsageRecord` is sparse. The numbers below are a **bottom-up
model** of one active "typical" workspace's monthly LLM workload, built from
the skills that actually fire (`lib/skills/registry.ts`, `runtime: 'live'`).
**This is the number to replace with real `LlmUsageRecord` aggregates the
moment the key is live** (see §7).

Modeled monthly volume for one active workspace, by tier:

| Tier | Calls/mo | Input tokens | Output tokens |
|------|---------:|-------------:|--------------:|
| Haiku (triage / categorize / office-admin) | 1,500 | 3.0M | 0.45M |
| Sonnet (coordinate / schedule / chase) | 600 | 2.4M | 0.48M |
| Opus (drafts / chat / reports / compliance) | 700 | 4.2M | 0.84M |
| **Total** | **2,800** | **9.6M** | **1.77M** |

This is a **moderately heavy** workspace (an owner whose fleet is actually
working the inbox daily). A light workspace runs ~30% of this; the fleet
blend is modeled at ~50% (§5).

---

## 3. Three scenarios — what each layer of the infra is worth

All figures are **$ per workspace per month** on the §2 workload.

### Scenario A — naïve: everything on Opus, no caching
The pre-infrastructure failure mode (one global model, no cache):
- Input: 9.6M × $15 = **$144.00**
- Output: 1.77M × $75 = **$132.75**
- **Total: $276.75 / workspace / mo**

### Scenario B — tiered model routing, no caching
`lib/llm/routing-provider.ts` + per-skill assignment
(`lib/skills/model-assignment.ts`) put each call on the right tier:
- Haiku: 3.0M×$1 + 0.45M×$5 = $5.25
- Sonnet: 2.4M×$3 + 0.48M×$15 = $14.40
- Opus: 4.2M×$15 + 0.84M×$75 = $126.00
- **Total: $145.65 / workspace / mo**  → **routing alone saves 47%**

### Scenario C — tiered routing + prompt caching
`lib/llm/cache-wrapper.ts` auto-caches the stable system prefix. Modeling
assumption: **70% of input is the cacheable prefix** (system prompt + skill
definition + vertical knowledge), of which **90% is served as cache reads**
(the mission's "90% reuse"); the remaining 30% of input is volatile per-call
content at full rate; ~2% of input is amortized cache writes at 1.25×.
Effective input multiplier ≈ **0.46×** full-rate. Output is unchanged.

- Haiku: 3.0M×$1×0.46 + $2.25 = $3.63
- Sonnet: 2.4M×$3×0.46 + $7.20 = $10.51
- Opus: 4.2M×$15×0.46 + $63.00 = $91.98
- **Total: ~$106.12 / workspace / mo**  → **routing + caching saves 62% vs naïve**

**The unavoidable floor is Opus output ($63/workspace/mo here).** Caching
cannot touch it; only moving customer-read drafts off Opus could — and
Conner's calibration deliberately keeps them on Opus. So **~$106/mo is the
optimized COGS of a heavy single-seat workspace**, against $199 of Regular
revenue = **~53% COGS.** That is the central tension this report surfaces.

---

## 4. The infrastructure's dollar value (why this PR matters)

| | Naïve (A) | Optimized (C) | Saved |
|---|---:|---:|---:|
| per workspace / mo | $276.75 | $106.12 | $170.63 (62%) |
| **at 10,000 workspaces / mo** | **$2.77M** | **$1.06M** | **~$1.71M / mo** |

The routing + caching layer is worth **~$1.7M / month at 10K customers** on
the heavy-workspace model. Budget caps (§6) bound the *tail* — the handful of
runaway workspaces that would otherwise blow past even this.

---

## 5. Scaling table (blended fleet)

Blended at ~50% of the §2 heavy workload (mix of heavy + light workspaces),
optimized (Scenario C basis) ≈ **$55 / workspace / mo blended**:

| Customers | Optimized blended / mo | Heavy-case ceiling / mo | Naïve (no infra) / mo |
|----------:|-----------------------:|------------------------:|----------------------:|
| 100 | ~$5.5K | ~$10.6K | ~$27.7K |
| 1,000 | ~$55K | ~$106K | ~$277K |
| 10,000 | ~$550K | ~$1.06M | ~$2.77M |

At 10K, the difference between "infra on" and "infra off" is roughly
**$2.2M/mo of margin** (blended optimized vs naïve). The annualized swing is
~$27M — this is not a micro-optimization.

---

## 6. Recommended per-tier budget caps (NEEDS SIGN-OFF)

Caps enforce a COGS ceiling so no single workspace can run the fleet into the
red. Target: **COGS ≤ ~30% of revenue** (matches the existing advisory
`recommendBudgetCapUsd` = MRR × 0.30). Two dimensions now exist
(`lib/billing/budget.ts`): a **monthly** ceiling and a **daily** circuit
breaker that catches a one-day runaway before it burns a month of margin.

| Tier (1 seat) | Revenue/mo | Monthly cap | Daily cap | COGS @ cap |
|---------------|-----------:|------------:|----------:|-----------:|
| Regular | $199 | **$60** | **$6** | 30% |
| Partner | $299 | **$90** | **$9** | 30% |
| Max | $499 | **$150** (or per-engagement) | **$15** | 30% |

**Strategic flag for Conner:** the modeled *heavy* Regular workspace ($106/mo)
**exceeds** a $60 monthly cap. Three honest options, not mutually exclusive:
1. **Throttle** — the cap pauses heavy workspaces near month-end (the gate +
   alert + auto-pause now do this gracefully). Fine if heavy users are rare.
2. **Reprice** — heavy single-seat Regular usage is underpriced; a usage-based
   add-on or a nudge to Partner closes the gap.
3. **Route harder** — accept slightly more Sonnet on lower-stakes "customer
   reads" surfaces. Trades a little quality for margin; Conner's call.

The caps above are **starting points to ratify**, not law. They are stored
per-workspace (`Workspace.settings.tokenBudgetUsd{Monthly,Daily}`) so any
single account can be raised without a deploy.

---

## 7. Calibrate against real data first (do not trust §2 blindly)

The moment the prod key is live and ~2 weeks of `LlmUsageRecord` exist, run a
real per-workspace aggregate (the queries already exist:
`getWorkspaceUsageReport`, `getFleetBudgetSnapshots`) and replace §2's modeled
volumes. The **shape** of the conclusion (routing >> caching >> caps; Opus
output is the floor) is robust to the assumptions; the **absolute dollars**
are only as good as the workload model.

---

## 8. Webhook-vs-polling: the hidden cost multiplier

Audit of `lib/inngest/functions/` (full table in the PR description). The
cost-relevant finding: several **sync sweeps poll external systems on a
schedule** and can fire the (Opus) draft chain on each pass —

| Sweep | Cadence | Polls | Webhook alt |
|-------|---------|-------|-------------|
| `hubspot-sync-sweep` | hourly | HubSpot leads | `HUBSPOT_SYNC_TRIGGER_EVENT` (defined, unwired) |
| `salesforce-sync-sweep` | hourly | Salesforce leads | `SALESFORCE_SYNC_TRIGGER_EVENT` (defined, unwired) |
| `follow-up-boss-sync-sweep` | hourly | FUB leads | webhook supported, no event wired |
| `customer-files-ingestion-sweep` | 6-hourly | Google Drive | no push wired |
| `notion-ingest-sweep` | 6-hourly | Notion | event on OAuth-connect (partial) |

**Cost mechanism:** hourly polling = 720 fetch passes/workspace/mo. Each pass
that re-reads unchanged data and re-runs a classify/draft burns tokens for
zero new value. At 10K workspaces this is a structural multiplier on the §2
Haiku/Sonnet volumes.

**Two-part fix (scoped, not done in this PR):**
1. **Verify every sweep no-ops before any LLM call** when there is no new
   work (delta check before dispatch). This is the cheap, high-leverage win —
   a TODO, because confirming it across ~15 sweeps is its own audit.
2. **Wire the already-defined `*_TRIGGER_EVENT` webhooks** so the hourly cron
   drops to a daily reconciliation backstop and skills fire only on real new
   data. This is per-vendor OAuth-callback work — a follow-up wave, not a
   one-PR change.

Replacing all polling with webhooks in this PR would be a large, risky
multi-vendor change; the honest scope here is the audit + the two TODOs above.

---

## 9. Summary

- The cost-control **substrate already existed and is excellent** (budget
  gate, routing, caching providers). This build filled the gaps: **daily
  caps**, **50/75/90% alerts + auto-pause surfacing**, a **per-customer usage
  dashboard**, and the **per-skill model registry** that makes the tier mix in
  §3 ground truth instead of a guess.
- **Routing + caching is worth ~$1.7M/mo at 10K** customers vs naïve.
- **Opus output is the margin floor** (~$63/mo on a heavy workspace) — caps,
  not caching, bound it.
- **The one real decision** (§6): heavy Regular usage can exceed a healthy cap.
  Throttle, reprice, or route harder — Conner's call.
