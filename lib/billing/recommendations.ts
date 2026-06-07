/**
 * lib/billing/recommendations.ts
 *
 * Budget-cap *recommendations* — explicitly NOT enforcement. PR #145 first
 * shipped an MRR-proportional ceiling (MRR × 0.30) and enforced it inside the
 * LLM seam. PR #146 then locked `lib/billing/budget.ts` as the single source
 * of truth for what "over budget" means, with the rule that the only enforced
 * cap is an operator-set explicit `$/mo` value (`NO_CAP` when unset, no
 * auto-derivation). To honor both, the MRR math moved here as advice:
 *
 *   - The operator deep-dive surfaces "Recommended cap: $X — Apply", which
 *     WRITES the explicit cap (`tokenBudgetUsdMonthly`) only on click.
 *   - The customer billing pane shows "Recommended budget: $X" as advisory
 *     copy — it changes nothing on its own.
 *
 * Nothing in this module enforces a budget or is read by the gate. It is a
 * pure advisory calculator over the pricing ladder.
 *
 * ── The economics (production+growth plan §2) ─────────────────────────────
 * `outputs/production_growth_plan_2026_06_03/PLAN.md` §2 establishes that at
 * the post-wave-8 model mix a heavy single-seat workspace costs ~$162–279/mo
 * in Anthropic tokens against a $99–199/mo subscription — i.e. at/below
 * break-even on the heaviest customers. A healthy-margin token budget caps
 * token COGS at a fraction of MRR:
 *
 *   recommended cap = MRR × (1 − gross-margin target)
 *                   = MRR × 0.30   (at a 70% gross-margin target, PLAN §2)
 *
 * reproducing the plan's "Break-even token budget per workspace" table:
 *   $199/seat → ~$60/mo   (Regular, 1 seat)
 *   $149/seat → ~$45/mo   (Regular, 10–24 band)
 *   $99/seat  → ~$30/mo   (Regular, 50–99 band)
 *
 * The quote-based Max tier has no productized price, so it gets no
 * recommendation (`null`) — ceilings there are negotiated per engagement.
 */

import type { WorkspaceVerticalTier } from '@prisma/client';
import {
  perSeatMonthlyUsdCents,
  seatBandForSeats,
  tierFromVerticalTier,
  type TierName,
} from '@/lib/pricing/tiers';

/** Target gross margin per seat (PLAN §2 "Break-even token budget per
 *  workspace"). */
export const RECOMMENDED_GROSS_MARGIN_TARGET = 0.7;

/** Fraction of MRR the recommended token budget targets. 1 − margin = 0.30. */
export const RECOMMENDED_COGS_FRACTION = 1 - RECOMMENDED_GROSS_MARGIN_TARGET;

/**
 * Recommended monthly token budget (whole USD) for a given workspace MRR
 * (whole USD). Rounds to the nearest dollar. Returns 0 for a non-positive /
 * non-finite MRR. This is advice only — applying it is an explicit operator
 * action.
 */
export function recommendBudgetCapUsd(workspaceMrrUsd: number): number {
  if (!Number.isFinite(workspaceMrrUsd) || workspaceMrrUsd <= 0) return 0;
  return Math.round(workspaceMrrUsd * RECOMMENDED_COGS_FRACTION);
}

// ── MRR resolution from a workspace row (for surfaces without a precomputed
//    revenue figure) ────────────────────────────────────────────────────────

export interface WorkspaceMrrInputs {
  tier: TierName;
  /** Monthly recurring revenue for the whole workspace, in whole USD. */
  mrrUsd: number;
  seats: number;
  /** Where the MRR was resolved from. */
  source: 'subscription' | 'workspace-manual' | 'workspace-default';
}

/** The minimal Workspace shape MRR resolution needs. */
export interface WorkspaceMrrRow {
  verticalTier: WorkspaceVerticalTier;
  /** Manual-invoice override price in USD cents (Workspace.tierPriceUsdMonthly). */
  tierPriceUsdMonthly: number | null;
  subscription: { tier: WorkspaceVerticalTier; seats: number } | null;
}

/** Per-seat charge × seats in whole USD, clamping out-of-ladder (100+) seat
 *  counts to the top band so we never throw on a custom/large workspace. */
function safeMonthlyChargeUsd(tier: TierName, seats: number): number {
  const clampedForBand = Math.min(99, Math.max(1, seats));
  const band = seatBandForSeats(clampedForBand);
  const perSeatCents = perSeatMonthlyUsdCents(tier, band);
  return (perSeatCents * Math.max(1, seats)) / 100;
}

/** Resolve (tier, MRR, seats) from a selected workspace row. Prefers the live
 *  Subscription; falls back to the workspace's manual-invoice price; finally
 *  to ladder pricing at 1 seat. */
export function resolveWorkspaceMrr(row: WorkspaceMrrRow): WorkspaceMrrInputs {
  const sub = row.subscription;
  if (sub) {
    const tier = tierFromVerticalTier(sub.tier);
    const seats = Math.max(1, sub.seats);
    return {
      tier,
      seats,
      mrrUsd: safeMonthlyChargeUsd(tier, seats),
      source: 'subscription',
    };
  }
  const tier = tierFromVerticalTier(row.verticalTier);
  if (row.tierPriceUsdMonthly != null && row.tierPriceUsdMonthly > 0) {
    return {
      tier,
      seats: 1,
      mrrUsd: row.tierPriceUsdMonthly / 100,
      source: 'workspace-manual',
    };
  }
  return {
    tier,
    seats: 1,
    mrrUsd: safeMonthlyChargeUsd(tier, 1),
    source: 'workspace-default',
  };
}

/** Recommended cap (whole USD) for a workspace row, or `null` for the
 *  quote-based Max tier (no productized price to anchor a recommendation). */
export function recommendBudgetCapUsdFromRow(
  row: WorkspaceMrrRow,
): number | null {
  const inputs = resolveWorkspaceMrr(row);
  if (inputs.tier === 'max') return null;
  return recommendBudgetCapUsd(inputs.mrrUsd);
}
