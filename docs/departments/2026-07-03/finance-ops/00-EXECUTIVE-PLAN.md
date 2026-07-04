# Head of Finance & Ops — 14-day executive plan

**Date:** 2026-07-03 · **Author:** Head of Finance & Ops (Fable 5) · **Mandate:** design FOR profitable (loop v3, PR #349)
**Inputs:** `docs/kaizen/2026-07-02/07-finance-ops.md`, `docs/ceo/2026-07-02/01-path-to-profitable.md` (PR #348), `docs/audits/full-audit-2026-07-02/MASTER-SYNTHESIS.md`, `docs/business-plan/unit-economics.md`, `lib/billing/facts.ts` / `lib/billing/budget.ts` / `lib/kaizen/session-stamp.ts` on `origin/main @ d95d279`.

> **Source note:** the brief referenced `docs/audits/full-audit-2026-07-02/agentplain/07-finance-ops.md`. That file does not exist on main or on any PR head #320–#355 — the agentplain audit series runs 01–07(weekly-bi), 09, 10. The finance/ops evidence base here is the kaizen retro (which IS on main) plus the CEO pass and the master synthesis. Recording this so nobody hunts for a ghost file.

---

## The one-paragraph position

The company's finance state is: **~95% modeled gross margin, $0 measured spend, $0 revenue, and a NULL telemetry layer.** Every safety mechanism a finance head could want already exists in code — per-workspace monthly + daily budget caps, a fail-open gate, 50/75/90% alert crons, a layered kill switch on the prod key — and the one thing that doesn't exist is **a single recorded number**. `stampSessionCost()` has zero call sites, `memory/data/session-costs.yaml` has held zero rows ever, and the weekly retro dutifully reports zero spend it cannot see. Meanwhile the CEO pass correctly ranks the week's lever as five Georgia RE sends. Finance & Ops' job for the next 14 days is therefore narrow and boring: **wire the meters, publish the first real numbers, hold the spend line at zero new commitments, and have the cost governor certified so the prod key can un-pause the day a design partner says yes** — not a day before (ratified: market-ready AND active prospecting, both).

---

## Ratified constraints this plan operates under (do not re-litigate)

| Constraint | Source |
|---|---|
| CEO lever: 5 Georgia RE design-partner emails Monday | CEO pass 1, ratified frame 2026-07-03 |
| Paid media held; **zero new spend commitments** | Kill list, ratified 2026-07-03 |
| Prod Anthropic key stays paused until market-ready **and** active prospecting (both) | Ratified frame; `lib/llm/paused.ts` sentinel is the mechanism |
| No-ceiling rule: unconfigured workspace = `NO_CAP`, never throttled by MRR | `lib/billing/budget.ts:28-42`, PR #145/#146 history |
| flatsbo stays live | KILL #3 overridden |
| Billing policy reads `lib/billing/facts.ts`; this plan does not change that file | SSOT rule |
| No guesses: modeled figures labeled modeled, gaps labeled gaps | `feedback_no_guesses_no_estimates` |

---

## 14-day plan

### Days 1–3 — end the NULL-spend state (build)

1. **Wire `stampSessionCost()`** into the fleet session-completion protocol and the dispatch parent's completion path — the full call-site plan is `01-spend-telemetry-wiring.md`. One seam, three call sites, all small.
2. **Ship the deterministic Librarian-rollup executor** (`scripts/librarian-merge-inbox.ts`) so `memory/inbox/*.yaml` actually drains into `memory/data/session-costs.yaml` on a schedule that does not depend on the dispatch MCP (down 17 days per kaizen 10/10). Deterministic merge, no LLM call, runnable from GHA cron.
3. **Add the week-to-date window** to `lib/billing/usage/aggregate.ts` (it computes `today`/`period`/`last30Days`; WTD has no home on either the billing or ops side today).

**Exit test:** `session-costs.yaml` row count > 0, produced by the pipeline (not hand-seeded).

### Days 4–7 — first real numbers (publish)

4. **First non-zero weekly ops digest.** Run `scripts/run-kaizen-retro.ts` against real rows; publish WTD/MTD fleet token spend by tier, key state, budget-gate state. This is Conner's first-ever spend number.
5. **Collect the three Conner inputs the runway model is blocked on** (see `03-runway-model.md` §4): cash allocated to agentplain, his hourly rate R, and the actual monthly cost of the Claude plan(s) the fleet runs on. Three lines in a reply; unblocks "months of runway" as a measured statement.
6. **Baseline the fixed-cost ledger:** enumerate every live subscription (Vercel, Neon, Resend, domains, GTM stack) with its actual invoice amount. Today Z is a planning band (~$500 lean / ~$1,500 operating); by day 7 it is a list of real line items.

**Exit test:** the runway table in `03-runway-model.md` has real numbers in the "measured" column, or a named blocker per missing cell.

### Days 8–14 — cost governor certified, hand hovering over the switch (prepare, don't fire)

7. **Implement the per-workspace budget-cap spec** (`04-per-workspace-budget-cap-spec.md`): breach-at-100% alert severity, the global fleet-wide daily circuit breaker, and the un-pause preflight checklist. The 50/75/90% alert cron and both cap dimensions already exist; this is the last ~15% of the governor.
8. **Fix the two stale unit-economics action items** (both S, routed to Engineering in `05`): refresh `lib/billing/usage/pricing.ts` Haiku rates from $1/$5 to $0.80/$4 (the customer meter currently over-bills), and verify-then-enable `LLM_MODEL_ROUTING` (~$0.30–0.40/customer/mo of free margin, off by default at `lib/llm/index.ts:47-49`).
9. **Un-pause readiness review, not un-pause.** Certify the checklist. The key turns on when the ratified condition is met — a design partner in active pilot — and every workspace it serves has explicit caps set first.

**Exit test:** un-pause preflight is a checklist someone can execute in under an hour, with no open engineering items.

### Standing rule for all 14 days (and until further notice)

**Zero new spend approvals until the first design partner is signed.** No telemetry vendor (Axiom/Datadog can wait — the YAML layer + digest is sufficient at current volume), no paid media (already killed), no new SaaS subscriptions, no counsel retainer expansion beyond what's already committed. The only spend this plan itself creates is fleet tokens on Conner's existing Claude plan and roughly zero marginal infra. Exceptions require a written case to Conner showing payback against the $370-CAC / 2-month-payback box the CEO pass established.

---

## Deliverables in this PR

| Doc | What it is |
|---|---|
| `01-spend-telemetry-wiring.md` | Call-site plan: where `stampSessionCost` gets called, the Librarian-rollup executor, Conner's dashboard view |
| `02-per-vertical-unit-economics.md` | RE / CPA / law / PM cost-per-customer at 1 / 10 / 100 customers, tied to `facts.ts` + `tiers.ts` |
| `03-runway-model.md` | Conner-time + infra + tokens + APIs; months of runway; where path-to-profit lands |
| `04-per-workspace-budget-cap-spec.md` | The cost governor spec for prod-key un-pause |
| `05-what-i-need-from-other-heads.md` | Engineering (wiring) + Data (dashboards) asks, sized |
| `06-what-finance-ops-must-stop.md` | The stop-doing list |
| `07-profit-contribution.md` | What Finance & Ops contributes to "profitable," quantified where honest |

Docs only. No runtime code, no `lib/billing/facts.ts` change.
