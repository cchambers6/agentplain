# Kaizen retro 7/10 — Finance / Ops (2026-07-02)

Scope: pricing sanity (`lib/billing/facts.ts` SSOT post-#313), per-workspace token
budgets (#302), cost-architecture rules, prod-key-paused policy, week-to-date
spend tracking, burst-week discipline, no-ceiling rule, Vercel/Neon operational
state, re-tier audit cadence.

Every claim below cites the artifact it was verified against on 2026-07-02.
Nothing is estimated; where data does not exist, that absence IS the finding.

---

## Actual spend (verified 2026-07-02)

Asked to report actual spend. Here is the honest answer:

- **Metered production LLM spend: $0 by policy.** The prod `ANTHROPIC_API_KEY`
  remains paused (sentinel `PAUSED` short-circuit, `lib/llm/paused.ts`); the
  paused path makes zero network calls (fetch-tripwire tested). No prod key
  restore was performed in this session, per standing instruction.
- **Fleet/dev spend (the real burn): unmeasurable with current instrumentation.**
  `memory/data/session-costs.yaml` contains **zero entries ever** — only the
  schema comment block. `memory/data/budget-state.yaml` is frozen on the week
  of **2026-06-15 → 2026-06-22 with all tiers at $0 spent** (total cap $8,670).
  The copies in the main working tree at `C:\agentplain\memory\data\` are
  **0-byte empty files**. There is no Anthropic Console access from the fleet.
- Root cause of the null: `stampSessionCost` / `stampCvBarScore`
  (`lib/kaizen/session-stamp.ts`) have **zero call sites** outside their own
  test (verified by grep across the repo). The populate mechanism shipped in
  PR #273 and was never wired into the dispatch completion path.

Week-to-date spend is therefore **null — not zero**. The distinction matters:
under the no-ceiling rule, measurement is the only discipline we have, and it
is not happening.

## Operational state (verified 2026-07-02)

- **Vercel production has been red for 12+ days.** `vercel ls --prod`: every
  production deployment is `● Error` (~14s), including three attempts 9 hours
  ago. agentplain.com serves 200 only because Vercel pins the last green build.
- **The root cause has silently changed and nobody noticed.** The 2026-06-19
  diagnosis was Neon P1001 (compute suspended). Today's build log
  (`vercel inspect --logs` on deployment `aypbfzx7r`) shows the datasource
  **connecting successfully** to `ep-aged-snow-aq0e4b6k` and then failing with
  **`P3009: migrate found failed migrations in the target database`**. Neon is
  back; a failed migration row in `_prisma_migrations` (most likely
  `20260617000000_memory_scale_rls_tiering_byo`, which was pending when the
  outage hit) now blocks every deploy. The fix is `prisma migrate resolve`,
  **not** "resume Neon" — that part of the brief is stale.
- Local verification gap: `prisma migrate status` cannot run from the dev
  machine (`DATABASE_URL_DIRECT` not present in local env), so prod migration
  state is only observable through Vercel build logs.
- Previews are healthy: 8 `● Ready` preview builds in the last 8h — PR #307's
  migrate-gate (`VERCEL_ENV==='production'` only) is doing exactly its job.

---

## 10 wins

1. **`lib/billing/facts.ts` is a real SSOT (PR #313).** A leaf module (imports
   nothing) holding trial length (7d / 14d CPA+Law), 14-day money-back,
   card-at-signup, cancel-anytime, and the Conner-time policy (Max only;
   `PARTNER_SUPPORT` explicitly encodes "no reserved hours"). Surfaces read
   constants, so the tiers.ts drift class #313 fixed cannot silently recur.
2. **Per-workspace token budgets + routing + caching merged (#302,
   `f2bc2ae`).** Three of the four cost mechanisms the unit-economics gate
   requires are now on main, not in a plan doc.
3. **The budget seam survived a collision without forking the math.** PR #145
   originally replaced `lib/billing/budget.ts`; it was refactored to extend
   #146's seam, so the operator-visible spend number and the customer-throttle
   number are computed by the same functions.
4. **Cost-architecture compose order is ratified and enforced:**
   `Logging(Budget(Sentinel(Caching(Anthropic))))`, every kill-switch a wrapper
   (`LLM_PROMPT_CACHE`, `LLM_BUDGET_ENFORCEMENT`, `LLM_SENTINEL_BYPASS`), budget
   gate fails OPEN, untagged calls pass with no DB I/O.
5. **Prod-key-paused policy works as designed.** The paused short-circuit makes
   zero network calls; a red production cannot leak token spend. $0 metered
   prod spend through a 12-day outage is the policy doing its job.
6. **Budget alerts are a warning light, not just a wall.** 50/75/90% owner
   emails on two independent dimensions (daily spike vs monthly climb), fired
   at most once per threshold per period via a settings-JSON watermark — no
   migration needed (`lib/billing/budget-alerts.ts`).
7. **NO_CAP is a deliberate non-decision, correctly placed.** `budget.ts` never
   invents a cap; the MRR×0.30 figure lives in `lib/billing/recommendations.ts`
   as advisory-only with an operator Apply button. Recommendation and
   enforcement never blur.
8. **The cost substrate is complete at the call level.** Every `complete()`
   writes an `LlmUsageRecord` with `costMicroCents` + `sourceSurface`
   (`lib/billing/usage/recorder.ts`); rates live in
   `lib/billing/usage/pricing.ts`. When telemetry lands, the data source
   already exists.
9. **PR #307 decoupled previews from the database.** Through the entire prod
   outage, preview builds stayed green and stopped mutating prod schema — a
   latent hazard closed as a side effect of an incident fix.
10. **The kaizen tier-3 loop is deterministic code, not vibes.**
    `lib/kaizen/pattern-detectors.ts` is pure functions, the CLI is offline,
    38 node:test cases — this retro's floor is recomputable by anyone.

## 10 friction patterns

1. **Cost-stamp hook never wired → week-to-date spend is null.** The single
   highest-leverage gap in the whole finance/ops surface. `session-stamp.ts`
   has no callers; `session-costs.yaml` has never held a row. Every downstream
   discipline (budget state, re-tier, burst, kaizen cost retro) starves on
   this one missing wire.
2. **`budget-state.yaml` is frozen and forked.** The tracked copy shows the
   week of June 15 with all zeros; the main-tree copies are 0-byte files. Two
   divergent copies of the ledger, neither true.
3. **Production red for 12+ days with a silent root-cause transition**
   (P1001 → P3009). No alarm, no digest, no owner. The site staying up on a
   stale build masked the failure — "green site" and "green pipeline" are
   different facts and we only watch the first.
4. **The retro brief itself carried stale ops state** ("resume Neon") because
   there is no live operational source of truth — plans inherit the last
   incident's diagnosis rather than the current one.
5. **No unit-economics measurement.** The $162–279/mo heavy-workspace figure
   is a June 5 estimate from before #302's ~66% routing cut. The post-#302
   real number has never been measured, so the ratified HARD GATE ("verify the
   cost governor live before un-pausing prod key") is currently unverifiable.
6. **No LTV/CAC and no customer-economics tracking.** The 84–88% blended-GM
   claim in the money plan rests on unverified COGS; there is no artifact that
   would falsify it.
7. **Finance memory is fragmenting.** Six memory slugs cited by this retro's
   own brief (`feedback_no_ceiling_budget_2026_06_20`,
   `feedback_ai_cost_architecture_rules`, `project_billing_facts_ssot_2026_06_20`,
   `project_api_cost_control_2026_05_31`,
   `project_agentplain_operating_system_greenlight_2026_06_15`,
   `reference_vercel_prisma_migrate_deploy_fragility`) **do not exist** in the
   memory directory. Ratified rules (no-ceiling, burst-week) live in prompts
   and heads, not durable files.
8. **Re-tier audit cadence deferred for missing data.** The tiering machinery
   exists (`lib/memory/tiering.ts`) but no cron or cadence runs it — and it
   cannot meaningfully run until friction 1 is fixed. Deferral is correct;
   the dependency should be written down so it un-defers automatically.
9. **Burst-week discipline is untestable.** `tier_5_burst` exists in the YAML
   schema (`active/activated_by/cap_usd_lift`) but has never been activated or
   recorded; there is no written definition of what triggers a burst week or
   who closes it.
10. **The deterministic kaizen floor doesn't run on the machine that needs
    it.** `run-kaizen-retro.ts` fails here on a broken esbuild install
    (`@esbuild/win32-x64` missing from the shared node_modules), compounding
    the known js-yaml `.mjs` resolution quirk. A retro loop that can't execute
    locally decays into prose — exactly what it was built to prevent.

## Top 5 process improvements

1. **Wire the cost-stamp hook** into the dispatch completion path (the
   one-line-per-call-site follow-up named in PR #273 and never done). This
   single change un-nulls week-to-date spend, unfreezes `budget-state.yaml`,
   unblocks re-tier cadence, and makes burst-week discipline observable.
   Everything else in this list consumes its output.
2. **Fix the production pipeline with `prisma migrate resolve`.** Diagnose the
   failed row in `_prisma_migrations` (expected:
   `20260617000000_memory_scale_rls_tiering_byo`), resolve it
   (`--rolled-back` then redeploy, or `--applied` if it actually completed),
   and verify a green production deploy. This is a prod-DB mutation —
   Conner-approved runbook step, not an unattended fleet action.
3. **Weekly ops digest with real numbers, owned by a scheduled task:** prod
   deploy status, migration state, week-to-date spend by tier, YAML freshness
   (staleness itself is an alert), Vercel/Neon reachability. The 12-day silent
   red is the proof this must be push, not pull.
4. **Unit-economics model as a living artifact:** recompute per-workspace COGS
   from `LlmUsageRecord` under the post-#302 mix, publish tokens-per-MRR-dollar
   by tier, and make the prod-key un-pause gate read the measured number
   instead of the June 5 estimate.
5. **Close the budget-enforcement loop end-to-end:** one seeded workspace
   driven across 50/75/90/100% — assert alerts fire once per threshold, the
   gate blocks at OVER, and the operator inspector shows the same number the
   customer was throttled on. Each layer is unit-tested today; the loop as a
   loop has never been exercised.

## Top 3 investments

1. **Token-cost telemetry (Axiom recommended over Datadog at this spend
   level), fed from the Logging wrapper.** Real-time spend per workspace /
   surface / model with alerting. The Librarian-merged YAMLs become derived
   weekly views instead of the primary ledger — removing the single point of
   failure that produced this retro's null.
2. **Operator unit-economics dashboard:** COGS vs MRR per workspace, gross
   margin by tier, trailing-30d trend, and LTV/CAC panels that light up once
   paying customers exist. This is the artifact the "verify before un-pausing
   prod key" gate reads.
3. **Finance/ops runbook** covering: prod-red triage (P1001 vs P3009
   signatures, both now documented from live incidents), migrate-resolve
   procedure, key pause/un-pause gate checklist, Neon suspend/resume, and the
   never-drilled key-rotation + restore drills flagged in the June 5 plan —
   plus re-creating the six missing finance memory files so ratified rules
   survive session boundaries.
