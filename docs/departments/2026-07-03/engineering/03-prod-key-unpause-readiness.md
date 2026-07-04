# Prod-key un-pause readiness — what must be true before Conner flips it

**Policy (standing):** the key un-pauses when the product is market-ready AND Conner is actively prospecting. The second condition is satisfied by Monday's five sends. This document is engineering's half: the checklist that makes the flip safe at $199–$299/mo price points, where token spend is the margin. Un-pausing without a working governor converts every prospect demo into uncapped variable cost against zero revenue.

**What already exists (verified on origin/main — do not rebuild):**
- Provider chain: `lib/llm/` has `budget-enforcing-provider.ts`, `logging-provider.ts`, `cache-wrapper.ts`, `key-rotation-provider.ts`, `paused.ts`, `routing-provider.ts`, and — usefully — `restore-checklist.ts`, an un-pause checklist seam already in the codebase. Ratified compose order: `Logging(Budget(Sentinel(Caching(Anthropic))))`.
- Budget seam: `lib/billing/budget.ts` — `resolveBudgetCapUsd`, `resolveDailyBudgetCapUsd` (settings keys `tokenBudgetUsdMonthly` / `tokenBudgetUsdDaily`), `deriveBudgetStatus`, `isOverBudget`, `BUDGET_WARN_THRESHOLD = 0.8`.
- Alerting: `lib/billing/budget-alerts.ts` + `lib/inngest/functions/budget-alert-sweep.ts`.
- Fire gate: `gateSkillFire` wired into every skill caller (PR #147 rule); `canSpend()` at `lib/memory/data-readers.ts:263` reading the YAML budget state.
- Session stamping: `stampSessionCost` at `lib/kaizen/session-stamp.ts:132` — **built, tested, zero production call sites.**
- Degraded mode: `LLM_DEGRADED_MODE` universal banner (PR #276) — the safe failure state is proven; it's been the operating state for weeks.

The gap is not missing components. It is (a) one dangerous default, (b) an unwired telemetry seam, and (c) no rollup executor. Three work items:

---

## 1. Kill the `NO_CAP` default (the one-line policy change that matters most)

`resolveBudgetCapUsd` returns NO_CAP when a workspace has no `tokenBudgetUsdMonthly` setting — correct for the build era, disqualifying for un-pause. Spec:

- Introduce `DEFAULT_WORKSPACE_BUDGET_USD_MONTHLY` (proposed **$40/mo** ≈ 20% of the Regular tier's $199 — Finance-Ops ratifies the number, see `04-…`) and `DEFAULT_WORKSPACE_BUDGET_USD_DAILY` (proposed $4) applied when the setting is absent. Explicit per-workspace overrides still win.
- `isOverBudget` ⇒ the budget-enforcing provider refuses the call and the surface degrades to the existing `LLM_DEGRADED_MODE` presentation scoped to that workspace ("Plaino is catching up — back within your plan limits tomorrow" — Product owns the copy; vendor-invisible, no "model spend" leak on customer surfaces).
- Unit tests: cap applied when unset; override wins; over-cap call refused; 80% warn fires once.

## 2. Wire spend telemetry (`stampSessionCost` call sites + rollup executor)

The kaizen retros' recurring "DATA MISSING": there is no per-wave cost ledger because the writer has zero call sites and the Librarian charter has no executor. Spec:

**Call sites (three, in priority order):**
1. **Fleet wave template / dispatch parent** — every code-task session ends by stamping `{sessionId, wave, model, wallClock, tokens?}` into the `agent-state/` inbox. Where the harness doesn't expose token counts, stamp wall-clock + model and mark tokens `null` — never fabricate (no-guesses rule).
2. **`logging-provider.ts`** — per-call token usage from the Anthropic response rolls up into the same stamp shape per workspace per day. This is the customer-margin ledger (vs. #1, the fleet-cost ledger).
3. **Inngest sweeps** — each vertical sweep stamps its run cost, which is what makes per-workspace margin real once customers exist.

**Rollup executor:** a scheduled task (the Librarian roll-up cadence already exists — every 15 min for WORKING_STATE; this one is daily) aggregating `agent-state/` stamps into `memory/data/budget-state.yaml`, which `canSpend()` already reads. That closes the loop: stamp → rollup → `canSpend` → `gateSkillFire`. Today `canSpend` reads a file nothing refreshes.

**Acceptance is functional (standing rule):** the PR that lands this must show its own session stamped and one rollup pass producing a non-empty YAML — not just the code merged.

## 3. Un-pause gate — the go/no-go checklist itself

Extend `lib/llm/restore-checklist.ts` to be the machine-readable version of this list, and give Conner a one-pager. **All must be true:**

| # | Condition | Verification |
|---|---|---|
| 1 | Default monthly + daily caps live (no `NO_CAP` path in prod) | unit tests + one staging workspace hitting the cap and degrading gracefully |
| 2 | Provider compose order verified as `Logging(Budget(Sentinel(Caching(Anthropic))))` | assertion test on the composed chain in `lib/llm/index.ts` |
| 3 | Per-call usage logging flowing to the workspace ledger | one real call's tokens visible in the rollup YAML |
| 4 | Budget-alert sweep fires at 80% | staged workspace test through `budget-alert-sweep.ts` |
| 5 | Degraded-at-cap UX approved by Product (customer vocab, vendor-invisible) | Product sign-off in `04-…` ask #1 |
| 6 | Sentinel compliance corpus loaded for RE (the only live vertical) | existing `lib/agents/sentinel` fixtures green |
| 7 | Kill switch documented: re-pause = flip one env var, banner returns | runbook paragraph + tested once |
| 8 | Conner is prospecting (the policy's second half) | the Monday sends — outside engineering |

**Explicitly NOT required for un-pause:** new features of any kind (kill #5 stays in force after the flip — the key coming back does not reopen LLM-feature building), rate limiting on marketing surfaces (required before *paid traffic*, not before the key), and the full spend dashboard (the YAML + weekly kaizen read is the v1 dashboard).

**Timeline:** items 1–2 land days 3–9 per the executive plan; the checklist review is a 30-minute pass after that. Engineering's position: **the key can be safely un-pausable by Jul 11** — ahead of any realistic first-demo date from Monday's sends.
