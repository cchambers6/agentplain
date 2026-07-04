# Prod-key cost guardrails for the partner workspace — exact config

**Authority:** this document *applies* the fin-ops governor spec (`docs/departments/2026-07-03/finance-ops/04-per-workspace-budget-cap-spec.md`, verified against `origin/main @ d95d279`) to design partner #1's workspace. Where a number here and that spec disagree, the spec wins. Nothing here is new machinery — the caps, gate, alerts, and kill switch all exist on main; this is the operator's fill-in-the-blanks sheet for one workspace.

**One reconciliation, settled here so it stops being two numbers:** the CS plan (`docs/departments/2026-07-03/customer-success/00-EXECUTIVE-PLAN.md`) recommended "a hard per-workspace cap of $50/month"; the fin-ops spec recommends **$40/month + $5/day** for a Regular-shaped RE pilot. This runbook adopts the fin-ops pair — it's the later, dual-dimension spec, and it sits inside the CS plan's ≤$50 intent. The daily cap is the one that actually matters: it converts the worst possible day from "a month of margin" to five dollars. Final ratification of the numbers remains Conner's call (the CS plan's "one decision"); entering the values below *is* that ratification made concrete.

---

## The exact configuration

Set on the partner workspace the moment it exists (Day 0 if they sign up early, otherwise minute 12 of the Day-1 call — before the first skill fires):

| Setting | Value | Where |
|---|---|---|
| `tokenBudgetUsdMonthly` | **$40** | `Workspace.settings` budget key, operator-set (`lib/billing/budget.ts:142`) |
| `tokenBudgetUsdDaily` | **$5** | daily budget key, operator-set (`budget.ts:191`) |

Context that makes these numbers boring, which is the point: modeled token cost for an active seat is **$1.50–$10/month** (kaizen 07 / path-to-profitable §1), and the lead-triage killer workflow's spine is deterministic — near-zero model calls per run. $40/$5 is roughly 4–27× expected usage on the monthly axis and >15× on a typical day. **The partner should never see these caps.** They exist to catch the pathological tail (a runaway loop, an integration gone feral), not to meter honest usage. If the partner *does* approach a cap on real usage, that's not a billing event — it's the single most interesting product-usage datum the pilot could produce, and the response is investigation plus a deliberate cap raise, not a shrug.

## Scope discipline (this is what "un-pause for their workspace only" means)

The key itself is workspace-agnostic once the paused sentinel is rotated out, so Option B's scoping is enforced by the cap layer plus preflight, not by the key:

1. **Zero `NO_CAP` among active workspaces** — the un-pause preflight's hard gate (fin-ops spec §2 Gap C, §3 step 1), verified via the fleet budget snapshot (`getFleetBudgetSnapshots`, `budget.ts:411`). The `NO_CAP` default for unconfigured workspaces is ratified policy for trusted paying customers, and is exactly wrong during a scoped pilot — the governor here is procedural (the checklist), deliberately not a new code default.
2. **The partner workspace gets the pilot caps above.** Any other workspace that must stay active (the seeded dry-run/demo workspace, Conner's own) gets explicit minimal caps — recommended **$5/month + $1/day** — or gets deactivated for the pilot window.
3. **New signups during the pilot window** (someone finds /real-estate organically): caps set before any skill is enabled for them, same table. A stray uncapped workspace is a preflight regression, and the 6-hour sweep's job is to catch it.

## Breach behavior (what happens at the limits)

Existing machinery, stated so the operator knows what to expect — the gate blocks on whichever dimension is stricter (`budgetGateOutcome`, `budget.ts:511-543`):

- **At the daily cap:** new model-backed work for that workspace pauses until the day rolls over. The deterministic spine of lead triage (catch, log, queue) keeps running — leads are never dropped; at worst, draft language quality degrades to the template path until the window resets.
- **At the monthly cap:** same gating, month-scale. At 4–27× headroom this should never fire on honest usage; if it fires, see "investigation first" above.
- **Customer surface at 100%:** the ratified posture — a calm pause-plus-upgrade surface, never an auto-charged overage, never an error page. **For the design partner specifically, the surface is Conner:** a breach on their workspace means Conner messages them before they notice anything (honesty-first, doc 02's trigger table), with what happened and what we're doing. During a free pilot there is nothing to upsell — the message is service, not sales, and no vendor or model names appear in it.
- **Fail-open stands:** a budget-accounting error can never take down a customer call (`budget.ts:544-550`, ratified). The governor bounds spend; it is not allowed to become an outage mode.

## Alerts to Conner

| Threshold | Mechanism | Latency |
|---|---|---|
| 50% / 75% / 90% of either cap | Existing `evaluateWorkspaceAlerts` on the 6-hour `agentplain-budget-alerts` sweep; dedup watermark, each fires once per period | ≤6h |
| **100% (BREACH), either dimension** | Gap A alert: immediate email, subject `[BUDGET BREACH] <workspace> hit its <daily|monthly> cap`, with workspace, dimension, cap vs. spend, budget snapshot, and the one-line remediation. One breach, one email | gate blocks in-line; email ≤6h behind — acceptable at pilot scale because the workspace is already safely gated while the email is in flight |
| **Fleet-wide stop-loss** | Gap B breaker: sum of today's spend across all workspaces vs. `FLEET_DAILY_BUDGET_USD` = **$25/day**; breach → BREACH-severity email with the top-5 spending workspaces + operator-dashboard flag. **No auto-rotate to paused** — the breaker is a loud alarm plus the documented one-click manual kill, by design | ≤6h |

**Merge gate:** the BREACH alert and fleet breaker are preflight items (spec §3 step 2) — merged and tested green **before** the key rotates on Day 0. If they aren't, Day 0's technical block stops there and the activation call moves.

**Pilot-week operator overlay:** during week 1, Conner's twice-daily silent check (doc 02) includes the spend glance — daily spend vs. the $5 cap — so a drift toward a cap is seen at human speed hours before the sweep emails. Anything over 50% of the daily cap on an ordinary day gets investigated the same day.

## The kill switch (unchanged, rehearsed)

Re-pause is the already-proven mechanism: rotate the key back to the paused sentinel (`lib/llm/paused.ts` path) — layered, no-throw, zero tokens while paused. Nothing new to build. **Rehearse it once on Day 0** (rotate out, smoke-confirm the pause, rotate in) so the first real use of the kill path isn't its first use ever. If the kill fires mid-pilot, the partner hears it from Conner within 4 hours in plain language: what paused, what still works (their queue, their approvals, everything deterministic), and when drafting resumes.

## The weekly reconciliation (Fridays, 5 minutes, alongside the Day-4 prep)

One line in the partner folder every Friday: **workspace spend this week ($), month-to-date vs. $40, highest single day vs. $5, alerts fired (should be zero).** Two purposes: it turns the modeled $1.50–$10/month COGS figure into a *measured* number for the first time in company history — the direct input the path-to-profitable doc says is its most embarrassing gap — and it means cap-vs-usage drift is noticed weekly, not at breach. After four weeks of real data, revisit the caps once (probably downward for accuracy or nowhere at all; never reactively mid-drama).
