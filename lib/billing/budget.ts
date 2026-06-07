/**
 * lib/billing/budget.ts
 *
 * Per-workspace token-budget seam. ONE place that answers two questions:
 *
 *   "How much of this workspace's monthly token budget is consumed?"  (read)
 *   "Is this workspace over budget right now?"                        (gate)
 *
 * Two waves share this file by design:
 *   - The operator deep-dive inspector (Stream D.2) renders the consumption
 *     bar from `getWorkspaceBudget` / `deriveBudgetStatus`.
 *   - The per-workspace budget-enforcement wave gates fleet activity off the
 *     SAME `deriveBudgetStatus` so the number a customer is throttled on is
 *     the exact number the operator sees. Divergent math here would mean an
 *     operator debugging a throttle against a different total than the gate
 *     used — so the derivation lives here, once.
 *
 * Per `feedback_no_silent_vendor_lock.md`: cost-from-tokens is a billing
 * concern owned by the billing seam, so this sits next to `usage/` and reads
 * through `getWorkspaceUsageReport` rather than touching `LlmUsageRecord`
 * directly.
 *
 * Cost unit: micro-cents (1 cent = 1,000,000 micro-cents), matching
 * `LlmUsageRecord.costMicroCents`. The cap is expressed in whole USD because
 * that is how a human configures a budget ("$200/mo"); the derivation
 * converts once at the boundary.
 *
 * This module deliberately does NOT decide a *default* cap. A workspace with
 * no configured cap resolves to `NO_CAP` — the inspector still shows raw
 * spend, and the enforcement wave is free to layer a policy default on top.
 * Inventing a business default here would couple two waves to a number
 * neither of them ratified.
 *
 * ── Enforcement vs. recommendation (PR #145 ↔ #146 reconciliation) ─────────
 * The ONLY cap that is enforced is the operator-set explicit `$/mo` cap read
 * from workspace settings (`resolveBudgetCapUsd`). The MRR-proportional cap
 * (MRR × 0.30) PR #145 originally enforced is now a *recommendation* only —
 * it lives in `lib/billing/recommendations.ts` and is never auto-applied.
 * The gate below short-circuits a call ONLY when the workspace has reached
 * its explicit cap (`OVER`); an unbudgeted workspace (`NO_CAP`) is never
 * throttled, regardless of MRR. This keeps #146's locked seam the single
 * source of truth for what "over budget" means.
 *
 * ── Cold-start safety ─────────────────────────────────────────────────────
 * Per `feedback_cold_start_safe_agents`: correctness reads durable state
 * (`LlmUsageRecord` + `Workspace.settings`) on every decision. The in-process
 * status cache (`statusForGate`) is PERFORMANCE ONLY — a soft monthly budget
 * tolerates a ≤60s-stale read, and the cache rebuilds from the DB on any
 * cold start.
 */

import type { Prisma } from '@prisma/client';
import { withSystemContext } from '@/lib/db/rls';
import { getLogger } from '@/lib/observability/logger';
import type { LlmRequestMeta } from '@/lib/llm/types';
import { getWorkspaceUsageReport } from './usage/aggregate';

const MICRO_CENTS_PER_DOLLAR = 100_000_000;

/** Fraction of the cap at which the bar flips from calm to a warning tone. */
export const BUDGET_WARN_THRESHOLD = 0.8;

export type BudgetState = 'NO_CAP' | 'OK' | 'WARN' | 'OVER';

export interface WorkspaceBudgetStatus {
  workspaceId: string;
  /** Configured monthly cap in whole USD, or null when none is set. */
  capUsdMonthly: number | null;
  /** Raw period spend in micro-cents (exact). */
  consumedMicroCents: bigint;
  /** Period spend in USD (lossy display number derived from the above). */
  consumedUsd: number;
  /** consumed / cap, 0..>1. Null when there is no cap to divide by. */
  percentUsed: number | null;
  /** cap - consumed in USD; negative when over. Null when no cap. */
  remainingUsd: number | null;
  state: BudgetState;
  /** Total billable tokens this period (input+output+cache) — the unit a
   *  customer recognizes alongside the dollar figure. */
  tokensThisPeriod: number;
}

/** Pure state classifier — shared so the bar color and the gate decision
 *  can never disagree. `>= 1` is OVER (cap reached counts as over). */
export function deriveBudgetState(percentUsed: number | null): BudgetState {
  if (percentUsed === null) return 'NO_CAP';
  if (percentUsed >= 1) return 'OVER';
  if (percentUsed >= BUDGET_WARN_THRESHOLD) return 'WARN';
  return 'OK';
}

export function microCentsToUsd(microCents: bigint): number {
  // Number() is safe here: a workspace would need >$90B of spend to lose
  // integer precision, far beyond any monthly total.
  return Number(microCents) / MICRO_CENTS_PER_DOLLAR;
}

export interface DeriveBudgetArgs {
  workspaceId: string;
  consumedMicroCents: bigint;
  /** Whole-USD monthly cap, or null for an unbudgeted workspace. */
  capUsdMonthly: number | null;
  tokensThisPeriod?: number;
}

/** Pure derivation — no IO. The gate and the inspector both call this with
 *  the same `(consumed, cap)` so the numbers are identical on both sides. */
export function deriveBudgetStatus(args: DeriveBudgetArgs): WorkspaceBudgetStatus {
  const consumedUsd = microCentsToUsd(args.consumedMicroCents);
  const hasCap =
    args.capUsdMonthly !== null &&
    Number.isFinite(args.capUsdMonthly) &&
    args.capUsdMonthly > 0;
  const cap = hasCap ? (args.capUsdMonthly as number) : null;
  const percentUsed = cap !== null ? consumedUsd / cap : null;
  return {
    workspaceId: args.workspaceId,
    capUsdMonthly: cap,
    consumedMicroCents: args.consumedMicroCents,
    consumedUsd,
    percentUsed,
    remainingUsd: cap !== null ? cap - consumedUsd : null,
    state: deriveBudgetState(percentUsed),
    tokensThisPeriod: args.tokensThisPeriod ?? 0,
  };
}

/** Convenience predicate for the enforcement wave: true once the workspace
 *  has a cap AND has reached it. Unbudgeted workspaces are never blocked. */
export function isOverBudget(status: WorkspaceBudgetStatus): boolean {
  return status.state === 'OVER';
}

/**
 * Read a configured monthly cap (whole USD) off a workspace's `settings`
 * JSON. The enforcement wave owns where this is *written*; readers go
 * through here so the settings key name is defined once.
 *
 * Returns `fallbackUsd` (default null) when no valid positive number is
 * present under `tokenBudgetUsdMonthly`.
 */
export const BUDGET_SETTINGS_KEY = 'tokenBudgetUsdMonthly';

export function resolveBudgetCapUsd(
  settings: unknown,
  fallbackUsd: number | null = null,
): number | null {
  if (settings && typeof settings === 'object') {
    const raw = (settings as Record<string, unknown>)[BUDGET_SETTINGS_KEY];
    if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
      return raw;
    }
  }
  return fallbackUsd;
}

/** Merge a new explicit cap into a settings JSON blob without dropping other
 *  keys. `null` clears the cap (removes the key). Used by the operator
 *  "apply recommended cap" / "set cap" action. */
export function withBudgetCapUsd(
  settings: unknown,
  capUsd: number | null,
): Record<string, unknown> {
  const base: Record<string, unknown> =
    settings && typeof settings === 'object'
      ? { ...(settings as Record<string, unknown>) }
      : {};
  if (capUsd !== null && Number.isFinite(capUsd) && capUsd > 0) {
    base[BUDGET_SETTINGS_KEY] = Math.round(capUsd);
  } else {
    delete base[BUDGET_SETTINGS_KEY];
  }
  return base;
}

export interface GetWorkspaceBudgetArgs {
  workspaceId: string;
  /** Inclusive lower bound for the billing period; null → last 30 days
   *  (matches `getWorkspaceUsageReport`). */
  periodStart: Date | null;
  /** Whole-USD monthly cap; null for an unbudgeted workspace. */
  capUsdMonthly: number | null;
  now?: Date;
}

/**
 * Read-side helper: aggregate the period spend through the usage seam and
 * derive the budget status. Accepts a transactional client already scoped to
 * the workspace's RLS context, mirroring `getWorkspaceUsageReport`.
 */
export async function getWorkspaceBudget(
  tx: Prisma.TransactionClient,
  args: GetWorkspaceBudgetArgs,
): Promise<WorkspaceBudgetStatus> {
  const report = await getWorkspaceUsageReport(tx, {
    workspaceId: args.workspaceId,
    periodStart: args.periodStart,
    now: args.now,
  });
  const p = report.period;
  const tokens =
    p.inputTokens + p.outputTokens + p.cacheCreationTokens + p.cacheReadTokens;
  return deriveBudgetStatus({
    workspaceId: args.workspaceId,
    consumedMicroCents: p.costMicroCents,
    capUsdMonthly: args.capUsdMonthly,
    tokensThisPeriod: tokens,
  });
}

// ════════════════════════════════════════════════════════════════════════
// Enforcement seam (PR #145) — built ENTIRELY on `deriveBudgetStatus` above.
// No parallel cost math: the gate throttles on the exact `WorkspaceBudgetStatus`
// the operator inspector renders. The only enforced cap is the operator-set
// explicit `$/mo` cap (`resolveBudgetCapUsd`); `NO_CAP` never throttles.
// ════════════════════════════════════════════════════════════════════════

const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/** The decision the enforcement wrapper acts on. */
export interface BudgetGateDecision {
  outcome: 'ALLOW' | 'WARN' | 'BLOCK';
  /** Resolved workspace id, or null when the call was not workspace-tagged
   *  (operator / system scaffolding — never budgeted). */
  workspaceId: string | null;
  state: BudgetState | null;
  status: WorkspaceBudgetStatus | null;
}

/** The seam the `BudgetEnforcingLlmProvider` calls per completion. Dependency-
 *  inverted (a plain callback, not an imported class) so `lib/llm` stays free
 *  of a Prisma dependency and tests can pin a stub gate. */
export type BudgetGate = (
  meta: LlmRequestMeta | undefined,
) => Promise<BudgetGateDecision>;

/** Raised (or surfaced as the `OVER_BUDGET` typed result) when a workspace
 *  has reached its monthly explicit cap. Carries the status so an
 *  operator-side caller can present the numbers without re-querying. */
export class WorkspaceOverBudgetError extends Error {
  readonly workspaceId: string;
  readonly status: WorkspaceBudgetStatus | null;
  constructor(workspaceId: string, status: WorkspaceBudgetStatus | null) {
    super(
      `Workspace ${workspaceId} has reached its monthly token budget` +
        (status?.capUsdMonthly != null
          ? ` ($${status.consumedUsd.toFixed(2)} / $${status.capUsdMonthly})`
          : ''),
    );
    this.name = 'WorkspaceOverBudgetError';
    this.workspaceId = workspaceId;
    this.status = status;
  }
}

/** Map a budget state to a gate outcome. The single rule the gate obeys:
 *  block ONLY on `OVER` (explicit cap reached); `WARN` is allowed-but-logged;
 *  `OK` and `NO_CAP` (and an unresolved null) always allow. Pure + exported
 *  so the decision is unit-testable without a DB. */
export function budgetGateOutcome(
  state: BudgetState | null,
): BudgetGateDecision['outcome'] {
  if (state === 'OVER') return 'BLOCK';
  if (state === 'WARN') return 'WARN';
  return 'ALLOW';
}

/**
 * Full status for one workspace, resolving its explicit cap from settings.
 * Used by the customer billing pane, the operator surfaces, and the
 * enforcement gate. Defaults to the rolling 30-day window (matching the
 * operator deep-dive inspector) so the gate throttles on the same number the
 * operator sees. Returns `null` when the workspace does not exist.
 */
export async function getWorkspaceBudgetSnapshot(
  tx: Prisma.TransactionClient,
  args: { workspaceId: string; periodStart?: Date | null; now?: Date },
): Promise<WorkspaceBudgetStatus | null> {
  const workspace = await tx.workspace.findUnique({
    where: { id: args.workspaceId },
    select: { settings: true },
  });
  if (!workspace) return null;
  return getWorkspaceBudget(tx, {
    workspaceId: args.workspaceId,
    periodStart: args.periodStart ?? null,
    capUsdMonthly: resolveBudgetCapUsd(workspace.settings, null),
    now: args.now,
  });
}

/**
 * Statuses for every workspace (or a given subset), each derived through the
 * SAME `deriveBudgetStatus`. Two queries total (workspaces + one grouped
 * spend aggregate) — does NOT issue a usage report per workspace. For the
 * operator fleet/workspaces board. Sorted by consumption DESC (capped
 * workspaces first by `percentUsed`, then raw spend).
 */
export async function getFleetBudgetSnapshots(
  tx: Prisma.TransactionClient,
  args: { workspaceIds?: string[]; now?: Date; atRiskOnly?: boolean } = {},
): Promise<WorkspaceBudgetStatus[]> {
  const now = args.now ?? new Date();
  const periodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const hasIdFilter = Boolean(args.workspaceIds && args.workspaceIds.length > 0);
  const [workspaces, spendRows] = await Promise.all([
    tx.workspace.findMany({
      where: hasIdFilter ? { id: { in: args.workspaceIds } } : {},
      select: { id: true, settings: true },
    }),
    tx.llmUsageRecord.groupBy({
      by: ['workspaceId'],
      where: {
        createdAt: { gte: periodStart },
        ...(hasIdFilter ? { workspaceId: { in: args.workspaceIds } } : {}),
      },
      _sum: { costMicroCents: true },
    }),
  ]);
  const spendByWorkspace = new Map<string, bigint>();
  for (const r of spendRows) {
    spendByWorkspace.set(r.workspaceId, r._sum.costMicroCents ?? 0n);
  }
  const statuses = workspaces.map((w) =>
    deriveBudgetStatus({
      workspaceId: w.id,
      consumedMicroCents: spendByWorkspace.get(w.id) ?? 0n,
      capUsdMonthly: resolveBudgetCapUsd(w.settings, null),
    }),
  );
  const filtered = args.atRiskOnly
    ? statuses.filter((s) => s.state === 'WARN' || s.state === 'OVER')
    : statuses;
  return filtered.sort((a, b) => sortKey(b) - sortKey(a));
}

/** Sort weight: capped workspaces rank by percentUsed; uncapped fall back to
 *  raw consumed USD (kept below any capped workspace's ratio). */
function sortKey(s: WorkspaceBudgetStatus): number {
  return s.percentUsed ?? Math.min(0.999, s.consumedUsd / 1_000_000);
}

// ── Production gate (system-context, cached) ──────────────────────────────

const ALLOW_SKIP: BudgetGateDecision = {
  outcome: 'ALLOW',
  workspaceId: null,
  state: null,
  status: null,
};

interface CacheEntry {
  status: WorkspaceBudgetStatus;
  expiresAtMs: number;
}

/** Per-workspace status cache. Performance only — see file header. On a
 *  serverless instance this is naturally bounded (per-instance, short TTL). */
const statusCache = new Map<string, CacheEntry>();

function cacheTtlMs(): number {
  const raw = process.env.LLM_BUDGET_CACHE_TTL_MS;
  if (raw === undefined) return 60_000;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 60_000;
}

/** Test seam — clear the status cache between cases. */
export function __resetBudgetCacheForTests(): void {
  statusCache.clear();
}

async function statusForGate(
  workspaceId: string,
): Promise<WorkspaceBudgetStatus | null> {
  const ttl = cacheTtlMs();
  const nowMs = Date.now();
  const cached = statusCache.get(workspaceId);
  if (cached && cached.expiresAtMs > nowMs) return cached.status;
  // System context: the gate runs mid-LLM-call under an arbitrary RLS
  // context (or none). withSystemContext bypasses RLS the same way the
  // usage recorder's writer path does.
  const status = await withSystemContext((tx) =>
    getWorkspaceBudgetSnapshot(tx, { workspaceId }),
  );
  if (status && ttl > 0) {
    statusCache.set(workspaceId, { status, expiresAtMs: nowMs + ttl });
  }
  return status;
}

/** Production gate, wired into the default provider by `lib/llm/index.ts`.
 *  Skips (ALLOW) when the call is not workspace-tagged. Blocks ONLY on an
 *  explicit-cap `OVER`. FAILS OPEN on any error — budget accounting must
 *  never take down a customer-facing LLM call (same principle as the usage
 *  recorder swallowing write failures). */
export const persistBudgetGate: BudgetGate = async (meta) => {
  const workspaceId = meta?.workspaceId;
  if (!workspaceId || !UUID_RE.test(workspaceId)) return ALLOW_SKIP;
  try {
    const status = await statusForGate(workspaceId);
    if (!status) return ALLOW_SKIP;
    const outcome = budgetGateOutcome(status.state);
    if (outcome !== 'ALLOW') {
      const line = {
        workspace_id: workspaceId,
        skill: meta?.skill ?? null,
        source_surface: meta?.sourceSurface ?? null,
        state: status.state,
        consumed_usd: Math.round(status.consumedUsd * 100) / 100,
        cap_usd: status.capUsdMonthly,
        percent_used:
          status.percentUsed !== null
            ? Math.round(status.percentUsed * 100) / 100
            : null,
      };
      if (outcome === 'BLOCK') {
        getLogger().warn('llm.budget.blocked', line);
      } else {
        getLogger().info('llm.budget.warning', line);
      }
    }
    return { outcome, workspaceId, state: status.state, status };
  } catch (err) {
    getLogger().warn('llm.budget.gate_failed', {
      workspace_id: workspaceId,
      error: err instanceof Error ? err.message : String(err),
    });
    return ALLOW_SKIP;
  }
};
