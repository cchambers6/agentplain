# Per-workspace budget cap — the cost governor for prod-key un-pause

**Date:** 2026-07-03 · **Owner:** Head of Finance & Ops · **Implements:** Engineering (sized in `05`)
**Status of the underlying machinery: mostly built.** This spec is deliberately additive — it certifies what exists, closes three gaps, and defines the un-pause preflight. It does not redesign a budget system that already works.

---

## 1. What already exists (certified, do not rebuild)

Verified on `origin/main @ d95d279`:

| Capability | Where | Behavior |
|---|---|---|
| Monthly cap | `Workspace.settings[BUDGET_SETTINGS_KEY]` = `tokenBudgetUsdMonthly` (`lib/billing/budget.ts:142`) | Operator-set explicit $/mo; the slow ceiling |
| **Daily cap** (the spike guard this spec's title asks for) | `DAILY_BUDGET_SETTINGS_KEY` = `tokenBudgetUsdDaily` (`budget.ts:191`) | Independent fast circuit-breaker; catches a runaway loop before it burns a month of margin in an afternoon |
| Single derivation | `deriveBudgetStatus` (`budget.ts:108`) | The number the customer is throttled on is byte-identical to what the operator inspector shows |
| Gate | `budgetGateOutcome` / `persistBudgetGate` → `controllingBudgetStatus` (`budget.ts:511-543`) | Blocks on whichever dimension (daily/monthly) is stricter |
| Fail-open | `budget.ts:544-550` | Any gate error → `ALLOW_SKIP`; budget accounting can never take down a customer call |
| No-ceiling rule | `budget.ts:28-42` | Unconfigured workspace → `NO_CAP`, never throttled regardless of MRR (ratified, PR #145→#146 history) |
| Alerts | `evaluateWorkspaceAlerts` (`lib/billing/budget-alerts.ts`) on the `agentplain-budget-alerts` Inngest cron, every 6h | 50/75/90% thresholds, dedup watermark so each fires once |
| Cap recommendation | `recommendBudgetCapUsd` = MRR × 0.30 (`lib/billing/recommendations.ts:46-62`) | Advisory, wired to unit-economics §2 math |
| Kill switch | `SentinelLlmProvider` + `sk-ant-PAUSED` sentinel (`lib/llm/paused.ts`, `lib/llm/index.ts:38-45`) | Layered, no-throw, zero tokens while paused; `KeyRotationLlmProvider` fails over to secondary and pages a human when both keys die |
| Customer-facing behavior at 100% | unit-economics §5 (ratified posture) | Hard gate + calm upgrade CTA — never an auto-charged overage, never an error page |

## 2. The three gaps to close (the actual spec)

### Gap A — breach alerting stops at 90%; the 100% event is silent to Conner

**Spec:** extend `budget-alerts.ts` thresholds with a `BREACH` severity at 100% on **either** dimension:
- **Alert to Conner:** immediate email (same transport the 50/75/90 alerts use), subject `[BUDGET BREACH] <workspace> hit its <daily|monthly> cap`, body: workspace, dimension, cap, spend, `deriveBudgetStatus` snapshot, and the one-line remediation (raise cap / leave gated). Dedup watermark per dimension per period, same pattern as existing thresholds — one breach, one email, not one per 6h sweep.
- **Latency note:** the gate itself blocks in-line at breach (already true); the *alert* rides the existing 6h cron. Acceptable at pilot scale — a breached workspace is safely gated while the email is at most 6h behind. Tightening the cron is a scale decision, not a launch blocker.
- **Customer surface:** unchanged from the ratified posture — new expensive work pauses, calm upgrade surface, nothing auto-billed.

### Gap B — caps are per-workspace only; no fleet-wide stop-loss

A runaway that spans workspaces (bug in a sweep, abuse across trial signups) is invisible to per-workspace caps. **Spec:** a fleet-wide daily circuit breaker in the existing 6h sweep:
- Sum today's spend across workspaces via `getFleetBudgetSnapshots` (`budget.ts:411`).
- If the sum exceeds `FLEET_DAILY_BUDGET_USD` (env; **initial value $25/day** — ≈ 10× the modeled all-in daily LLM spend of ten active pilot customers, so it cannot fire on honest growth): email Conner at `BREACH` severity with the top-5 spending workspaces, and set a `fleet-budget-breach` flag that the operator dashboard surfaces.
- **It does not auto-rotate the key to PAUSED.** Rationale: fail-open is the system's ratified philosophy, per-workspace gates have already contained the spenders, and an auto-kill triggered by a summing job is a new outage mode aimed at paying customers. The breaker is a loud alarm plus a one-click documented manual kill (rotate to sentinel), not an automatic one. Revisit at 100+ customers.

### Gap C — `NO_CAP` default is correct policy but wrong for pilot un-pause

The no-ceiling rule stands for configured, paying, trusted workspaces. But un-pausing with any active workspace at `NO_CAP` means day-one traffic is ungoverned. **Spec — procedural, not code:** the un-pause preflight (§3) requires every workspace that will receive live traffic to have **explicit operator-set caps** before the key rotates. No code default is introduced (that would silently invent a business rule, the exact thing PR #146 removed); the governor is the checklist plus the alert that follows.

**Recommended pilot caps** (operator enters these; from unit-economics §4 token budgets at 13–27× typical usage):

| Tier | `tokenBudgetUsdMonthly` | `tokenBudgetUsdDaily` |
|---|---|---|
| Regular (RE solo pilot) | $40 | $5 |
| Partner (CPA/Law/PM pilot) | $80 | $8 |
| Max / custom | per deal, ≥ $250 | per deal |

A normal customer never sees these caps (typical spend is $1.50–10/mo); they exist to catch the pathological tail only.

## 3. Un-pause preflight checklist (execute in under an hour; do not execute early)

Preconditions — ALL must hold, per the ratified frame:
- [ ] **Market-ready:** activation path works end-to-end for the pilot vertical (Connect wired, first-value flow demonstrated on a test workspace).
- [ ] **Active prospecting:** at least one design-partner conversation in flight (the Monday sends have produced a live reply). *Both conditions, not either.*

Then, in order:
1. [ ] Every workspace receiving traffic has explicit daily + monthly caps set (§2 Gap C table). Verify via `getFleetBudgetSnapshots` — zero `NO_CAP` rows among active pilots.
2. [ ] `BREACH` alert (Gap A) and fleet breaker (Gap B) merged and their tests green.
3. [ ] `weekToDate` window live in `getWorkspaceUsageReport` (from `01` §2) — day one of traffic is day one of complete reporting.
4. [ ] `lib/billing/usage/pricing.ts` Haiku rates refreshed to $0.80/$4 so the customer meter doesn't over-bill from the first token.
5. [ ] Secondary key (`ANTHROPIC_API_KEY_SECONDARY`) present and valid — the rotation provider's failover is only real if the failover key is.
6. [ ] Rotate the real key in; confirm sentinel no longer short-circuits; run one governed smoke call; watch the first 6h alert sweep complete.
7. [ ] Stamp the un-pause in the ops digest: date, workspaces live, caps in force, who approved.

Re-pause (the one-click kill referenced in Gap B): rotate back to the `sk-ant-PAUSED` sentinel — the documented, already-proven mechanism. Nothing new to build for the kill path.

## 4. What this spec deliberately does not do

- No auto-scaling caps by MRR (ratified out in PR #146 — recommendation only).
- No per-customer pass-through billing for self-serve (unit-economics §5: all-inclusive, hard gate + upgrade, no surprise bills).
- No new telemetry vendor. The governor runs entirely on `LlmUsageRecord` + existing crons.
- No change to fail-open. A budget bug must never become a customer outage.
