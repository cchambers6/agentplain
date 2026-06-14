# Spec — Per-Customer Token Budget Tracker + Enforcer

**Prepared:** 2026-06-14 · **Companion to:** `docs/business-plan/unit-economics.md` ·
**Status:** implementable spec (no migration applied yet)

## Why this exists

`lib/billing/budget.ts` already derives a USD budget status by **aggregating
`LlmUsageRecord` on every gate check** (`getWorkspaceBudgetSnapshot`), with a 60-second
in-process cache. That is correct and is the source of truth for the *operator* view.
This spec adds a **materialized per-cycle counter** (`WorkspaceTokenUsage`) so the
**hot-path enforcer** reads one indexed row (O(1)) instead of aggregating millions of
usage rows, and so we have durable per-cycle `alertedAt80Pct` / `budgetExceededAt`
markers for **idempotent** alerting and gating.

Per unit-economics §0, the enforcer is **insurance against the forward risk**: today
LLM COGS is ~$1.50–10/customer/mo (templates), but the day we move killer-workflow
drafts to per-item Opus generation, a heavy workspace's spend could 10–20×. This meter
caps that tail per-customer without margin blowout, and turns the cap into an **upgrade
trigger**, not a bill-shock.

**Design rules followed:** `feedback_no_silent_vendor_lock` (Resend behind the existing
`lib/email` seam), `feedback_cold_start_safe_agents` (counter is durable DB state; cache
is performance only), `feedback_runner_portability` (gate is a callback, two impls), the
no-DB-default-id migration pattern (`project_schema_drift_baseline_for_raw_indexes`,
`project_compliance_counsel_gate_two_layer`) → **zero new drift-baseline entries**, and
the `lib/llm/index.ts` wrapper-compose order (`project_llm_provider_compose_order`).

---

## 1. Prisma schema

Add to `prisma/schema.prisma`. **No `@default(uuid())`, no `@default(now())`** — ids and
timestamps are supplied in app code so the model produces no schema drift (mirrors
`ComplianceCounselSignoff` / `WorkspaceLifecycleEvent` conventions).

```prisma
/// Materialized per-billing-cycle token counter + budget marker. One row
/// per (workspace, cycleStartDate). The hot-path enforcer reads THIS row
/// (O(1)) instead of aggregating LlmUsageRecord on every call; the nightly
/// cycle-reset cron opens the next cycle's row. costMicroCents mirrors
/// LlmUsageRecord exactly (BigInt micro-cents) — derived from pricing.ts.
model WorkspaceTokenUsage {
  id                 String    @db.Uuid
  workspaceId        String    @db.Uuid
  /// UTC midnight of the cycle anchor (subscription.currentPeriodStart, or
  /// the first-of-month fallback for unbudgeted workspaces). The (workspace,
  /// cycleStartDate) pair is unique — one counter row per cycle.
  cycleStartDate     DateTime  @db.Date
  tokensIn           BigInt    @default(0)
  tokensOut          BigInt    @default(0)
  /// Cache tokens tracked separately so the meter UX can show the savings
  /// line (see unit-economics §1.2); they DO count toward cost + budget.
  cacheCreationTokens BigInt   @default(0)
  cacheReadTokens     BigInt   @default(0)
  /// Running cost this cycle, micro-cents. Sum of costMicroCentsForUsage().
  estimatedCostUsdCents BigInt @default(0)
  /// The cycle's token ceiling, derived from the tier budget ($/mo ÷ blended
  /// rate) at cycle open. 0 / null = NO_CAP (never gated).
  budgetTokens       BigInt?
  /// Set the first time consumed >= 100% of budgetTokens. Idempotency marker
  /// so the hard-gate logs/pages exactly once per cycle. NULL = under budget.
  budgetExceededAt   DateTime?
  /// Set the first time consumed >= 80%. Idempotency marker so the warning
  /// email fires exactly once per cycle. NULL = not yet warned.
  alertedAt80Pct     DateTime?
  createdAt          DateTime
  updatedAt          DateTime

  workspace          Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@id([id])
  @@unique([workspaceId, cycleStartDate])
  /// Cron + enforcer lookup: "current cycle row for this workspace".
  @@index([workspaceId, cycleStartDate])
}
```

Add the back-relation `workspaceTokenUsage WorkspaceTokenUsage[]` to `model Workspace`,
and **RLS**: enable + force row-level security with the standard workspace policy
(mirror the `LlmUsageRecord` policy migration), plus add the model to the wave5
`WORKSPACE_SCOPED_MODELS` isolation test list.

Migration dir: `prisma/migrations/20260614000000_workspace_token_usage/` — `CREATE TABLE`
+ `ENABLE/FORCE ROW LEVEL SECURITY` + policy. Because there are no DB-side defaults, the
table is fully represented in `schema.prisma` and needs **no** `schema-drift-baseline.sql`
entry.

---

## 2. Budget derivation — tokens from tier

`budgetTokens` is derived once at cycle open from the tier's USD budget
(unit-economics §4: Solo $40, Partner $80, Max custom) using a **blended effective rate**.
Add to `lib/billing/budget.ts`:

```ts
/// Blended micro-cents per token, derived from the observed surface mix
/// (mostly Haiku chat + occasional Opus pulses). Conservative: assumes a
/// heavier Opus share than typical so budgetTokens is never too generous.
/// Tunable; surfaced in the meter's assumptions line.
export const BLENDED_MICRO_CENTS_PER_TOKEN = 500n; // ≈ $0.005 / 1k tokens

/// Tier budget in whole USD/mo → token ceiling for the cycle.
export function budgetTokensForUsd(capUsdMonthly: number | null): bigint | null {
  if (!capUsdMonthly || capUsdMonthly <= 0) return null; // NO_CAP
  const microCents = BigInt(Math.round(capUsdMonthly * 1_000_000)); // $→µ¢
  return microCents / BLENDED_MICRO_CENTS_PER_TOKEN;
}
```

The per-tier USD caps live next to the pricing ladder:

```ts
// lib/pricing/tiers.ts
export const TOKEN_BUDGET_USD_BY_TIER: Record<TierName, number | null> = {
  regular: 40,   // Solo
  plus: 80,      // Partner (× seats at cycle open)
  max: null,     // custom — set explicitly in the deal, written to settings
};
```

---

## 3. Enforcer wrapper — `lib/llm/dispatch-with-budget.ts`

A thin **incrementer + hard-gate** that the existing `BudgetEnforcingLlmProvider` calls.
It does NOT replace `budget.ts`'s gate — it **fast-paths** it: read the materialized row,
decide, and after a successful completion increment the counter (and flip the markers).

```ts
/**
 * lib/llm/dispatch-with-budget.ts
 *
 * Hot-path per-cycle token enforcer. Reads/writes the materialized
 * WorkspaceTokenUsage counter so the gate is O(1) per call instead of an
 * aggregate over LlmUsageRecord. Composes UNDER Logging, OVER Budget's
 * existing USD gate — the two agree because both derive from the same
 * pricing.ts cost and the same tier cap.
 *
 * Fail-OPEN on any error (a budget bug must never take down a customer LLM
 * call — same principle as persistBudgetGate and the usage recorder).
 */
import type { Prisma } from '@prisma/client';
import { withSystemContext } from '@/lib/db/rls';
import { costMicroCentsForUsage } from '@/lib/billing/usage/pricing';
import { getLogger } from '@/lib/observability/logger';
import { sendBudget80Alert } from '@/lib/billing/budget-alert';

export class BudgetExceededError extends Error {
  readonly workspaceId: string;
  readonly consumedTokens: bigint;
  readonly budgetTokens: bigint;
  readonly upgradeUrl: string;
  constructor(args: {
    workspaceId: string; consumedTokens: bigint; budgetTokens: bigint; upgradeUrl: string;
  }) {
    super(`Workspace ${args.workspaceId} reached its monthly token budget`);
    this.name = 'BudgetExceededError';
    Object.assign(this, args);
  }
}

/** Pre-call guard. Throws BudgetExceededError when the workspace is already
 *  over its cycle ceiling. Called by assertBudgetAvailable() before
 *  expensive (Opus / long-output) calls; cheap Haiku classifier calls may
 *  skip the pre-check and rely on the post-increment marker. */
export async function assertBudgetAvailable(workspaceId: string): Promise<void> {
  const row = await currentCycleRow(workspaceId);
  if (!row || row.budgetTokens == null) return;            // NO_CAP
  const consumed = row.tokensIn + row.tokensOut + row.cacheCreationTokens + row.cacheReadTokens;
  if (consumed >= row.budgetTokens) {
    throw new BudgetExceededError({
      workspaceId,
      consumedTokens: consumed,
      budgetTokens: row.budgetTokens,
      upgradeUrl: `/app/workspace/${workspaceId}/settings/billing?reason=budget`,
    });
  }
}

/** Post-call accounting. Increments the cycle counter, derives cost, and
 *  flips alertedAt80Pct / budgetExceededAt exactly once. Returns the new
 *  consumed-fraction so the wrapper can decide to send the 80% email. */
export async function recordAndMark(input: {
  workspaceId: string; model: string;
  inputTokens: number; outputTokens: number;
  cacheCreationTokens: number; cacheReadTokens: number;
}): Promise<void> {
  const cost = costMicroCentsForUsage(
    input.model, input.inputTokens, input.outputTokens,
    input.cacheCreationTokens, input.cacheReadTokens,
  );
  try {
    const crossed80 = await withSystemContext(async (tx) => {
      // Atomic increment; the unique (workspaceId, cycleStartDate) row is
      // guaranteed to exist (opened by signup provisioning or the cron).
      const row = await tx.workspaceTokenUsage.update({
        where: { workspaceId_cycleStartDate: {
          workspaceId: input.workspaceId, cycleStartDate: currentCycleAnchor(),
        }},
        data: {
          tokensIn: { increment: BigInt(input.inputTokens) },
          tokensOut: { increment: BigInt(input.outputTokens) },
          cacheCreationTokens: { increment: BigInt(input.cacheCreationTokens) },
          cacheReadTokens: { increment: BigInt(input.cacheReadTokens) },
          estimatedCostUsdCents: { increment: cost },
          updatedAt: new Date(),
        },
      });
      if (row.budgetTokens == null) return false;
      const consumed = row.tokensIn + row.tokensOut + row.cacheCreationTokens + row.cacheReadTokens;
      const pct = Number(consumed) / Number(row.budgetTokens);
      if (pct >= 1 && row.budgetExceededAt == null) {
        await tx.workspaceTokenUsage.update({ where: { id: row.id }, data: { budgetExceededAt: new Date() }});
      }
      if (pct >= 0.8 && row.alertedAt80Pct == null) {
        await tx.workspaceTokenUsage.update({ where: { id: row.id }, data: { alertedAt80Pct: new Date() }});
        return true; // newly crossed 80% — caller sends the email
      }
      return false;
    });
    if (crossed80) await sendBudget80Alert(input.workspaceId);
  } catch (err) {
    getLogger().warn('token_budget.record_failed', {
      workspace_id: input.workspaceId,
      error: err instanceof Error ? err.message : String(err),
    });
    // swallow — accounting must never break the customer's response
  }
}
```

`currentCycleRow` reads the `(workspaceId, currentCycleAnchor())` row through
`withSystemContext` with a 30s perf cache (same pattern as `statusForGate`);
`currentCycleAnchor()` returns the subscription `currentPeriodStart` (UTC date) or the
first-of-month fallback. Wire `recordAndMark` into `LoggingLlmProvider`'s existing
post-completion sink (next to `persistUsageRecorder`), and `assertBudgetAvailable` into
`BudgetEnforcingLlmProvider` for `sourceSurface ∈ {DRAFT, SUPPORT_HANDLER, PLAINO_CHAT,
ANALYTICS_PULSE, FINANCE_PULSE, CONTENT_CALENDAR, RESEARCH_BRIEF}` (the Opus / long-output
surfaces). Cheap Haiku classifiers skip the pre-check.

---

## 4. 80% alert email — `lib/billing/budget-alert.ts`

Behind the existing `lib/email` seam (`getEmailProvider().send(...)`). Resolves the owner
email, renders the calm Plaino-voiced warning, sends once (the `alertedAt80Pct` marker
guarantees idempotency upstream), and writes an `AuditLog` row.

```ts
import { getEmailProvider } from '@/lib/email';
import { withSystemContext } from '@/lib/db/rls';
import { getWorkspaceBudgetSnapshot } from './budget';

export async function sendBudget80Alert(workspaceId: string): Promise<void> {
  const { ownerEmail, status, workspaceName, upgradeUrl } =
    await loadAlertContext(workspaceId);
  if (!ownerEmail) return; // nothing to notify; AuditLog still written below
  await getEmailProvider().send({
    to: ownerEmail,
    subject: `You've used 80% of this month's Plaino usage`,
    text: render80Text(workspaceName, status, upgradeUrl),
    html: render80Html(workspaceName, status, upgradeUrl),
    tags: { kind: 'budget_80', workspace: workspaceId },
    headers: { 'List-Unsubscribe': '<mailto:hello@agentplain.com>' },
  });
  await withSystemContext((tx) => tx.auditLog.create({ data: {
    workspaceId, action: 'billing.budget_80_alert', /* …actor=system… */
  }}));
}
```

---

## 5. Hard-gate UX (BudgetExceededError surfacing)

The enforcer throws `BudgetExceededError`; the **no-throw `llmError` seam**
(`project_llm_provider_compose_order`) converts it to a typed degraded result so the
customer never sees a stack trace. Surfacing per surface:

- **Plaino chat / talk:** the degraded-mode notice renders the budget copy (§6) with an
  inline **"See usage & upgrade"** button → `/settings/billing?reason=budget`. Same
  graceful pattern as the PAUSED-key degrade (it already exists — reuse `checkDegradedMode`).
- **Cron skills (pulses, support drafts):** skip silently for the cycle and write an
  `AuditLog` `billing.budget_gated` row; the next cycle reset clears it. No customer-
  facing failure row (avoids the "FAILED rows in onboarding" leak the audit flagged).
- **In-app banner:** workspace layout reads `budgetExceededAt != null` on the current
  cycle row → renders the persistent banner (§6) until reset or upgrade.
- **Hard-gate page** at `/settings/billing?reason=budget`: the meter at 100%, the upgrade
  CTA, and the calm explanation (§6). Upgrading (or an operator raising the cap) writes a
  larger `budgetTokens` to the current cycle row, immediately clearing the gate.

---

## 6. Cron — `token-budget-cycle-reset`

New Inngest function `lib/inngest/functions/token-budget-cycle-reset.ts`, cron
`TZ=America/New_York 0 2 * * *` (nightly 02:00 ET), registered in
`app/api/inngest/route.ts` (additive — the single recurring rebase seam; union the import
+ array entry) **and declared in `lib/skills/sweep-dispatch-manifest.ts`** if it dispatches
a skill (it does not — it is a maintenance cron, so add it to the route only). Wrapped in
`runWithDisableGate`.

Per nightly run, for every active workspace:
1. Compute the **current cycle anchor** (`subscription.currentPeriodStart` UTC date, or
   first-of-month fallback).
2. If no `WorkspaceTokenUsage` row exists for `(workspace, anchor)` → **open it**:
   `budgetTokens = budgetTokensForUsd(tierBudgetUsd × seats)`, all counters 0, markers
   null. This is the "reset" — a new cycle starts with a fresh counter and a cleared gate.
3. Idempotent: the `@@unique([workspaceId, cycleStartDate])` makes a re-run a no-op
   (`upsert` with `create`-only effect).

The cron does **not** delete old rows (they are the per-cycle history the operator + the
value ledger read). A separate retention sweep can prune rows older than 13 months.

Signup provisioning (`lib/billing/provisioning.ts`) also opens the first cycle row so a
brand-new workspace is metered from its first call without waiting for the nightly cron.

---

## 7. Test plan

**Unit (node:test, no DB) — pure logic:**
- `budgetTokensForUsd`: $40→8M tokens at 500µ¢/tok; null/0/negative → null (NO_CAP).
- `BudgetExceededError` carries workspaceId / consumed / budget / upgradeUrl.
- The 80%/100% threshold math: 0.79→no mark, 0.80→alert once, 1.0→gate once; second call
  at same level does NOT re-fire (markers non-null).
- Blended-rate assumption surfaced (regression guard on the constant).

**Integration (test DB or InMemory store seam):**
- `recordAndMark` increments all four token columns + cost; `assertBudgetAvailable`
  throws only when consumed ≥ budgetTokens; NO_CAP never throws.
- Idempotency: two concurrent `recordAndMark` crossing 80% send **one** email
  (marker flip is inside the same `update` returning the row — assert single
  `sendBudget80Alert` via a recording email provider, `__setEmailProviderForTests`).
- Cron opens exactly one row per cycle; re-run is a no-op; new cycle clears the gate.
- Fail-open: a thrown DB error in `recordAndMark` is swallowed (logged), the completion
  still returns.
- RLS: a row for workspace A is invisible under workspace B's RLS context (extend the
  wave5 isolation test's `WORKSPACE_SCOPED_MODELS`).

**Playwright E2E** (extends the existing revenue-path suite,
`project_e2e_playwright_suite_2026_06_13`; mocked billing + seeded usage):
- Seed a workspace at 79% → no banner, no email row. Seed at 80% → banner absent but
  alert AuditLog present + 80% email captured. Seed at 100% → hard-gate banner visible,
  Plaino chat shows the budget degrade with the upgrade CTA, `/settings/billing?reason=
  budget` renders the 100% meter + CTA.
- Upgrade action raises `budgetTokens` → banner clears on next load, chat works again.
- Skip-guard the live-LLM assertions behind the paused-key flag (reuse the suite's
  existing guard).

---

## 8. Customer-facing copy (Plaino voice — calm, never alarmist)

**80% alert email**
> **Subject:** You've used 80% of this month's Plaino usage
>
> Hi {{firstName}},
>
> Quick heads-up — Plaino has handled enough work this month that you're at about 80% of
> your plan's usage. Nothing's changed yet; everything keeps running.
>
> If you'd like more headroom, you can move up a plan anytime and the new limit takes
> effect immediately. If this is a busy stretch and next month looks lighter, you can
> ignore this — your usage resets when your billing cycle does.
>
> **[See your usage →]({{upgradeUrl}})**
>
> — Plaino, agentplain

**In-app banner (at 100%)**
> Plaino has reached this month's usage limit for your plan. Work already drafted is
> safe, and everything resets {{cycleResetDate}}. To keep new work flowing now, move up a
> plan — it takes effect right away. **[See usage & upgrade]**

**Hard-gate page** (`/settings/billing?reason=budget`)
> **You've reached this month's usage**
> Your {{tierName}} plan includes {{budgetDisplay}} of Plaino's work each cycle, and
> you've used all of it — which usually means Plaino is earning its keep. Here's where it
> went: *[usage meter, by agent]*. New work pauses until {{cycleResetDate}}, or move up a
> plan to keep going now. Your drafts and history are untouched. **[Upgrade plan]**

**Settings usage meter (always visible)**
> **This cycle:** {{tokensDisplay}} used of {{budgetDisplay}} · {{percentUsed}}%
> *{{costDisplay}} of work value · resets {{cycleResetDate}}*
> [calm progress bar — green < 80%, amber 80–99%, red ≥ 100%]
> *Cache saved you ~{{cacheSavingsDisplay}} this cycle.*

---

## 9. Wiring checklist

1. Migration `20260614000000_workspace_token_usage` (table + RLS policy). No drift-baseline entry.
2. `WorkspaceTokenUsage[]` back-relation on `Workspace`; add to wave5 `WORKSPACE_SCOPED_MODELS`.
3. `TOKEN_BUDGET_USD_BY_TIER` + `budgetTokensForUsd` + `BLENDED_MICRO_CENTS_PER_TOKEN`.
4. `lib/llm/dispatch-with-budget.ts` (gate + incrementer + `BudgetExceededError`).
5. `lib/billing/budget-alert.ts` (Resend 80% email via `lib/email` seam + AuditLog).
6. Wire `recordAndMark` into `LoggingLlmProvider` sink; `assertBudgetAvailable` into
   `BudgetEnforcingLlmProvider` for expensive surfaces.
7. `BudgetExceededError` → `llmError` degraded result; degraded-mode + banner + hard-gate page.
8. Cron `token-budget-cycle-reset` (route.ts additive union); provisioning opens first row.
9. Tests: unit + integration + Playwright (skip-guard live-LLM).
10. Copy into the email templates + degraded-mode + settings meter components.

**Zero new WorkApprovalKind, zero drift-baseline entries, fail-open throughout.**
