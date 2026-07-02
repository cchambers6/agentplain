# Kaizen Retro — Finance / Ops

**Date:** 2026-07-02 · **Discipline:** Finance / Ops · **Author:** fleet (Opus 4.8)
**Base:** `origin/main` @ `f928400` (PR #316) · **Method:** every claim traced to a
file:line or named-absence. Per `feedback_no_guesses_no_estimates.md`, nothing here is
estimated — modeled figures are labeled as modeled, and gaps are labeled as gaps.

> **Scope:** pricing SSOT, per-workspace token budgets, cost architecture, prod-key-paused
> policy, week-to-date spend, burst-week discipline, the no-ceiling rule, Vercel/Neon
> operational state, and re-tier cadence.

---

## Spend snapshot (read this first)

There are **no billed actuals**. The production Anthropic key is paused by policy — it is
rotated to the `sk-ant-PAUSED-…` sentinel that `SentinelLlmProvider` short-circuits before
any model round-trip (`lib/llm/paused.ts:55`, `lib/llm/index.ts:38-45`). The unit-economics
doc footer confirms it: *"the live Anthropic key is paused … these are forward estimates,
not billed actuals"* (`docs/business-plan/unit-economics.md:311-314`).

- **Week-to-date / session spend: NULL.** The ops-facing stamp exists (`stampSessionCost()`,
  `lib/kaizen/session-stamp.ts`) but is **not called from dispatch or any runtime path** — it
  appears only in its own module and tests. So `memory/inbox/session-costs.yaml` stays empty
  and the weekly kaizen retro reads zero spend (`scripts/run-kaizen-retro.ts`,
  `lib/kaizen/data-readers.ts`). This is the single biggest ops-visibility gap.
- **Modeled COGS:** ~**$1.50–$10 / customer / mo**, blended **~95% gross margin**, because
  the five live killer workflows are deterministic templates with **0 LLM calls/run**
  (`docs/business-plan/unit-economics.md:20-38`, §2 table). At every profile the **Stripe
  fee is the largest COGS line, not Anthropic** (§3).
- **Per-workspace billing meter works** the moment traffic flows: `LlmUsageRecord` →
  `getWorkspaceUsageReport` computes `today` / `period` / `last30Days` windows exactly
  (`lib/billing/usage/aggregate.ts`). The gap is the *ops-retro* stamp, not the *billing*
  meter — keep them distinct.

---

## 10 things Finance / Ops is doing well

1. **Billing-policy SSOT is real and leaf-clean.** `lib/billing/facts.ts` is the single
   source for trial (7d, 14d CPA/Law), 14-day money-back, card-at-signup, cancel-anytime,
   and Conner-time tier eligibility. It imports nothing from the billing/pricing layer
   (`facts.ts:19-22`) so `env.ts` and `pricing/tiers.ts` can consume it without a cycle,
   and `tiers.ts` re-exports the trial constants so old importers keep working.

2. **Pricing SSOT is one table.** `PER_SEAT_MONTHLY_USD_CENTS` in `lib/pricing/tiers.ts`
   holds the whole ladder — Regular $199→$99, Partner (enum `plus`) $299→$199, Max
   $499→$299 across the 1→50-99 seat bands — with the display-name split (`plus` →
   "Partner") in one place. No surface hardcodes a price.

3. **One budget derivation feeds both the meter and the gate.** `deriveBudgetStatus`
   (`lib/billing/budget.ts:108`) is the *only* place spend-vs-cap is computed, so the number
   a customer is throttled on is byte-identical to what the operator inspector renders
   (`budget.ts:9-16`). No parallel cost math anywhere.

4. **The no-ceiling rule is enforced by construction.** An unconfigured workspace resolves
   to `NO_CAP` and is **never throttled regardless of MRR** (`budget.ts:28-42`,
   `budgetGateOutcome` at `:311`). The only enforced cap is an operator-set explicit `$/mo`
   value — the MRR-proportional ceiling was demoted from enforcement (PR #145) to advice
   (PR #146). No silent business default was invented.

5. **Two-dimension spike guard.** Beyond the slow monthly ceiling there's an independent
   **daily** cap (`tokenBudgetUsdDaily`, `budget.ts:176-224`); the production gate blocks on
   whichever dimension is stricter (`persistBudgetGate` → `controllingBudgetStatus`,
   `budget.ts:511-543`). This is the fast circuit-breaker for a runaway loop / abuse spike
   *before* it burns a month of margin in an afternoon — exactly the burst-week discipline.

6. **The budget gate fails open.** Budget accounting can never take down a customer LLM
   call: any error in the gate returns `ALLOW_SKIP` (`budget.ts:544-550`), and calls with no
   workspace tag are never budgeted. Correctness reads durable state (`LlmUsageRecord` +
   `Workspace.settings`) on every decision; the 60s status cache is performance-only and
   rebuilds on cold start (`budget.ts:44-50`, cold-start-safe).

7. **Budget alerts are actually wired to a schedule.** `evaluateWorkspaceAlerts`
   (`lib/billing/budget-alerts.ts`) fires at 50/75/90% and is driven by a real Inngest cron
   — `agentplain-budget-alerts`, every 6h (`lib/inngest/functions/budget-alert-sweep.ts:41-42`)
   — with a dedup watermark in `Workspace.settings` so a threshold emails once, not every
   sweep. This is a live safety net, not a spec.

8. **Prod-key-paused is a clean, layered kill switch.** `SentinelLlmProvider` returns a
   no-throw `llmError('PAUSED', …)` before cache or model (`lib/llm/paused.ts`,
   `lib/llm/index.ts:38-45`), so ~a dozen callers degrade gracefully and zero tokens burn
   while paused. Bypass is one env flag (`LLM_SENTINEL_BYPASS=on`) for a dev with a real key.

9. **Self-healing key rotation with a human deadline.** `KeyRotationLlmProvider` (innermost)
   transparently fails over to `ANTHROPIC_API_KEY_SECONDARY` on 401/403/429/quota, sticky so
   the customer never sees the blip; both keys dead → PAUSED **and pages a human (24h
   deadline)** (`lib/llm/index.ts:29-40`). Continuity is designed in, not bolted on.

10. **A code-verified unit-economics model exists.** `docs/business-plan/unit-economics.md`
    is not hand-waving: every call profile is traced to a skill file, every vendor rate is
    cited with a read date, and it produces per-profile COGS, break-even customer counts
    (~2 covers infra, ~25-40 covers the first service hire, §4), and scale economics to
    1,000 customers holding 92-94% GM (§6). The `recommendBudgetCapUsd` (MRR × 0.30 for a
    70% GM target, `lib/billing/recommendations.ts:46-62`) is wired straight to its §2 math.

---

## 10 friction patterns

1. **The session-cost stamp is never wired → week-to-date is null.** `stampSessionCost()`
   (`lib/kaizen/session-stamp.ts`) has no caller in dispatch or the agent runtime, so
   `session-costs.yaml` is empty and every weekly ops retro reports zero spend. The
   infrastructure was built and then left disconnected — the classic "meter with no wire."
   This is the follow-up flagged back in the kaizen-loop PR (#273) and still open.

2. **No week-to-date window even in the billing aggregate.** `aggregate.ts` computes
   `today` / `period` / `last30Days` but no explicit week window; the kaizen reader's 7-day
   window reads a file that nothing writes. So "week-to-date spend" has no home on either the
   billing side (no window) or the ops side (no data).

3. **The unit-economics model is unratified and never re-baselined.** It is dated 2026-06-14,
   status *"decision input, not ratified"* (`unit-economics.md:3`), and explicitly says
   *"re-baseline against `LlmUsageRecord` once the key is restored"* (`:314`) — which has not
   happened because the key is still paused. A forward-estimate model that never meets
   actuals slowly decays into fiction.

4. **Its own action items went unactioned.** §7 lists five follow-ups. At least two are still
   open in the code: (a) `lib/billing/usage/pricing.ts:80-85` still bills Haiku at **$1/$5**,
   not the recommended **$0.80/$4** (over-bills the customer meter); (b) `LLM_MODEL_ROUTING`
   is still **default-off** (`lib/llm/index.ts:47-49`), leaving ~$0.30-0.40/customer/mo of
   free margin on the table. A model whose own to-dos rot signals no owner is closing the loop.

5. **No LTV/CAC framework.** Contribution margin and break-even *customer counts* exist
   (`unit-economics.md` §4), but there is no churn assumption (→ no LTV) and no acquisition
   cost (→ no CAC). Fine while acquisition is founder-outreach and free, but the moment paid
   spend starts (creative pack → realty first) there's no payback-period lens to spend against.

6. **Re-tier / reconciliation cadence does not exist.** Zero references to "re-tier",
   "tier audit", or "reconcile tier" anywhere in code. A workspace's `verticalTier` and its
   actual usage/plan can drift with no scheduled check pulling them back — the audit that
   "keeps getting deferred for missing data" has no mechanism to defer *to*.

7. **No internal ops digest or runbook.** `weekly-digest.ts` / `weekly-report.ts` are
   **customer-facing** (`lib/measurement/`, `lib/reports/`). There is no ops-internal weekly
   finance/ops digest (spend, margin, budget breaches, key state, deploy health) and no ops
   runbook. Ops state lives in people's heads and scattered memory files.

8. **Residual Vercel/Neon build coupling.** The migrate-on-every-build hazard was fixed —
   `scripts/prisma-migrate-gate.mjs` runs `prisma migrate deploy` **only** when
   `VERCEL_ENV === "production"` (the PR #307 fix, present on main, `package.json:7`). But a
   production build still opens a live Neon connection at build time, so a Neon suspend /
   cold-start during a prod deploy can still red a build. The failure mode is narrowed, not
   eliminated — and it cannot be observed from the repo (see #9).

9. **Live operational state is invisible from code.** `vercel.json` is two lines
   (`framework: nextjs`); there is no telemetry, no error budget, no uptime signal in-repo.
   Whether Vercel is green and whether Neon is suspended right now are unanswerable without
   opening two dashboards — which no automation does. "Vercel red compounds" is plausible
   precisely because nothing surfaces it until a human notices.

10. **Prod-key-paused is load-bearing but silent to Finance.** Pausing the key is the right
    cost control, but while paused there is **no revenue-grade telemetry at all** — no
    actuals to validate the 95% margin, no traffic to trip the budget gate, no data for the
    re-baseline in #3. The kill switch that protects margin also blinds the margin model.

---

## Top 5 process improvements

1. **Wire the session-cost stamp into dispatch (closes #1, #2).** Call `stampSessionCost()`
   from the agent/skill dispatch completion path (the same seam `persistUsageRecorder`
   already hooks) so `session-costs.yaml` fills and the weekly retro reads real numbers.
   One call site; unblocks every downstream spend view. Highest leverage, lowest effort.

2. **Restore the key behind the daily cap, then re-baseline (closes #3, #10).** With the
   daily spike-guard (`budget.ts:176-224`) and fail-open gate already in place, the risk of
   un-pausing is bounded. Un-pause on a small workspace set, let a week of `LlmUsageRecord`
   accrue, then re-run the unit-economics model against actuals and ratify it.

3. **Ship a weekly ops digest with real numbers (closes #7).** A scheduled Inngest job
   (mirror `budget-alert-sweep.ts`) that emails/writes: WTD & MTD spend, blended margin vs
   the 95% model, workspaces in WARN/OVER, key state (live/paused/rotated), and last deploy
   result. Reuses `getFleetBudgetSnapshots` (`budget.ts:411`) — the data path already exists.

4. **Ratify a unit-economics model with an LTV/CAC layer (closes #4, #5).** Fold in a churn
   assumption (→ LTV) and a CAC line as soon as paid acquisition starts, and clear the two
   stale §7 action items (refresh `pricing.ts` Haiku rates to $0.80/$4; turn on
   `LLM_MODEL_ROUTING` after verification). Assign a single owner to keep §7 from rotting.

5. **Define a re-tier reconciliation pass (closes #6).** A monthly job comparing each
   workspace's `verticalTier` / manual price against live subscription + usage, flagging
   drift to the operator queue. Cadence + mechanism first; the "missing data" excuse
   dissolves once #1 lands and spend is actually recorded.

---

## Top 3 investments

1. **Token-cost telemetry (Vercel Analytics is too thin).** Vercel Analytics gives page
   metrics, not per-workspace token economics. Invest in a real telemetry sink for
   `LlmUsageRecord` and the budget-gate log lines (`llm.budget.blocked` / `.warning`,
   `budget.ts:537-541`) — **Axiom** (cheap, log-native, fits the existing structured logger)
   or **Datadog** (heavier, if we also want APM + Neon/Vercel infra dashboards). This is the
   substrate the ops digest (#3) and margin re-baseline (#2) both need to be trustworthy.

2. **A unit-economics dashboard.** Turn `unit-economics.md` from a static, decaying document
   into a live surface: modeled vs actual COGS by profile, blended margin trend, Stripe-fee
   share (the real largest line), and budget-breach counts. Anchored on #1's telemetry so the
   numbers are actuals, not the 2026-06-14 forward estimates.

3. **An ops runbook.** One document covering the levers that currently live in memory files
   and code comments: how to pause/un-pause the key (sentinel rotation + secondary),
   how the migrate-gate behaves on a Neon cold-start, how to read the budget gate, how to
   set/clear a workspace cap, and the re-tier + digest cadences. The moment there is a second
   operator, tribal knowledge becomes an outage.

---

## Corrections to the retro brief (evidence over assumption)

Per "don't fabricate," three brief assumptions did not survive contact with the code:

- **"No unit-economics model"** — a thorough, code-traced one exists
  (`docs/business-plan/unit-economics.md`). The real gap is that it's *unratified,
  forward-estimate, and never re-baselined* (friction #3), not that it's absent.
- **"Vercel red on main compounds / migrate-on-build"** — the migrate-on-every-build hazard
  is already fixed and gated to production (`scripts/prisma-migrate-gate.mjs`, PR #307,
  strength, not open bug). The residual is the build-time Neon connection + zero in-repo
  observability (friction #8, #9).
- **"Budget-alert loop dormant"** — budget alerts are live on a 6h Inngest cron (doing-well
  #7). What is dormant is the *session-cost stamp* (friction #1), a different seam.
