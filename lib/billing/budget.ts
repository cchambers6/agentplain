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
 */

import type { Prisma } from '@prisma/client';
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
