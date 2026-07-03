# What Finance & Ops needs from other heads

**Date:** 2026-07-03 · **Owner:** Head of Finance & Ops
Everything here is sized S (≤1 day) or M (≤3 days) in fleet-agent effort and sequenced against the 14-day plan in `00`. Nothing on this list is new scope — every item traces to the kaizen retro, the master fix table, or the un-pause preflight.

---

## 1. Engineering (the wiring — days 1–7)

| # | Ask | Spec | Size | Needed by |
|---|---|---|---|---|
| E1 | Fleet session-stamp protocol + PR-merge backstop GHA | `01` §2 call sites A + C | S | day 3 |
| E2 | `scripts/librarian-merge-inbox.ts` deterministic executor + daily GHA cron | `01` §3 — append-only, idempotent, unknown payloads left for the Librarian agent | S–M | day 3 |
| E3 | `weekToDate` window in `getWorkspaceUsageReport` (`lib/billing/usage/aggregate.ts`) + unit test | `01` §2 product lane | S | day 7 (must precede un-pause) |
| E4 | `BREACH` (100%) alert severity in `lib/billing/budget-alerts.ts`, both cap dimensions, dedup per period | `04` §2 Gap A | S | day 14 |
| E5 | Fleet-wide daily circuit breaker in the 6h sweep (`FLEET_DAILY_BUDGET_USD`, initial $25/day; alarm + flag, **no auto-kill**) | `04` §2 Gap B | S–M | day 14 |
| E6 | Refresh `lib/billing/usage/pricing.ts` Haiku rates $1/$5 → $0.80/$4 | unit-economics §7 item, three weeks stale; customer meter currently over-bills | S | day 14 |
| E7 | Verify then enable `LLM_MODEL_ROUTING` (default-off at `lib/llm/index.ts:47-49`) | ~$0.30–0.40/customer/mo free margin; needs a verification pass first, not a blind flag flip | M | pre-un-pause, not day-gated |

Also flagged to Engineering (owned by their fix table, not this plan — margin defense context in `07`): master-synthesis row 11, `recordSavedTime` wired into every sweep's persist path. It is the only recurring wrongful-refund mechanism in the product.

## 2. Data / Analytics (the dashboards — days 4–14)

| # | Ask | Spec | Size | Needed by |
|---|---|---|---|---|
| D1 | Finance panel at the top of the weekly retro output (`scripts/run-kaizen-retro.ts`): WTD/MTD fleet spend by tier + model, self-stamp compliance rate, `cost_unpriced` share, key state, WARN/OVER workspaces | `01` §4 phase 1 | S–M | day 7 |
| D2 | Fixed-cost ledger home: a `memory/data/` YAML (or extension of `budget-state.yaml`) holding the §1 line items from `03`, updated monthly via the same inbox contract | `03` §1 | S | day 7 |
| D3 | Spec (not build) for `/operator/finance`: per-workspace budget bars from `deriveBudgetStatus`, fleet snapshot table, spend-by-vertical | `01` §4 phase 2 — build gates on first signed partner | S (spec only) | day 14 |
| D4 | Activation-funnel + approval-latency minimal metrics | CEO pass §5 item 5 — "day one of real customers must not be day one of debugging"; Data owns the design | M | pre-un-pause |

## 3. Chief of Staff / Conner queue (three one-line inputs)

The runway model (`03` §4) is blocked on three numbers only Conner has. Queue them as one item with a 3-line reply template:

1. Cash allocated to agentplain (a number, or "cash-flow funded up to $X/mo").
2. His rate R for Conner-time (sets the truly-profitable bar).
3. Actual monthly cost of the Claude plan(s) the fleet runs on (the largest unknown in current burn).

## 4. Sales (nothing built — one data contract)

When the Monday sends produce a reply, Finance & Ops needs the pilot workspace flagged **before** the key un-pauses, so caps go on first (preflight step 1). One Slack-message-equivalent of lead time; the un-pause checklist (`04` §3) is already written to receive it.

## 5. What other heads should NOT wait on from Finance & Ops

- No approval loop for $0-cash decisions — the zero-new-spend rule governs cash commitments, not engineering time.
- No budget sign-off for work already on the master fix table.
- The un-pause decision itself is not Finance & Ops' to grant — it's the ratified two-condition test plus the preflight. This department certifies the governor; it doesn't hold the key hostage.
