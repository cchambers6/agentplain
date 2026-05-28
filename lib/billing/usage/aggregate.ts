/**
 * lib/billing/usage/aggregate.ts
 *
 * Read-side aggregations for the customer-facing usage pane and the
 * Stripe-meter cron. Pure typed Prisma — no raw SQL — so the indexes
 * declared on `LlmUsageRecord` (composite `workspaceId, createdAt DESC`
 * + partial-style `workspaceId, stripeReportedAt`) handle every query
 * shape used below.
 *
 * Window semantics:
 *   - "today" → rows with `createdAt >= startOfTodayUtc(now)`.
 *   - "period" → rows with `createdAt >= subscription.currentPeriodStart`
 *     when known; otherwise the most-recent 30 days as a fallback.
 *   - "last30d" → rows with `createdAt >= now - 30 days`.
 *
 * Per-surface breakdown is a Prisma `groupBy` keyed on `sourceSurface`.
 *
 * Caller responsibilities:
 *   - Pass the workspace's RLS context — these functions accept a
 *     transactional client (`Prisma.TransactionClient`) from `withRls`,
 *     not the raw `prisma` instance. That keeps the workspace-isolation
 *     boundary at the call site.
 */

import type { LlmSourceSurface, Prisma } from '@prisma/client';

export interface UsageSums {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  costMicroCents: bigint;
  /** Row count — useful to distinguish "no usage yet" from "usage but
   *  zero tokens billed" (the latter shouldn't happen but defensive). */
  callCount: number;
}

export interface SurfaceBreakdownRow {
  sourceSurface: LlmSourceSurface;
  sums: UsageSums;
}

export interface WorkspaceUsageReport {
  today: UsageSums;
  period: UsageSums;
  last30Days: UsageSums;
  /** Per-surface breakdown for the current billing period — what the UI
   *  renders as "Which agent is consuming the most this period?". */
  periodBySurface: SurfaceBreakdownRow[];
}

export interface ReportArgs {
  workspaceId: string;
  /** Inclusive lower bound for the current billing period. When NULL
   *  the aggregator falls back to the last 30 days. */
  periodStart: Date | null;
  /** Clock injection for deterministic tests. */
  now?: Date;
}

const ZERO_SUMS: UsageSums = {
  inputTokens: 0,
  outputTokens: 0,
  cacheCreationTokens: 0,
  cacheReadTokens: 0,
  costMicroCents: 0n,
  callCount: 0,
};

/** Build the full report rendered on the billing usage pane. One round-
 *  trip per window so the page is fast even on a workspace with millions
 *  of rows (the `(workspaceId, createdAt DESC)` index makes each scan
 *  cheap). */
export async function getWorkspaceUsageReport(
  tx: Prisma.TransactionClient,
  args: ReportArgs,
): Promise<WorkspaceUsageReport> {
  const now = args.now ?? new Date();
  const startOfToday = startOfDayUtc(now);
  const last30dStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const periodStart = args.periodStart ?? last30dStart;

  const [today, period, last30Days, periodBySurface] = await Promise.all([
    sumWindow(tx, args.workspaceId, startOfToday, now),
    sumWindow(tx, args.workspaceId, periodStart, now),
    sumWindow(tx, args.workspaceId, last30dStart, now),
    sumWindowBySurface(tx, args.workspaceId, periodStart, now),
  ]);

  return { today, period, last30Days, periodBySurface };
}

/** Single-row aggregate (`SUM`s) over a window. */
async function sumWindow(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  fromInclusive: Date,
  toExclusive: Date,
): Promise<UsageSums> {
  const agg = await tx.llmUsageRecord.aggregate({
    where: {
      workspaceId,
      createdAt: { gte: fromInclusive, lt: toExclusive },
    },
    _sum: {
      inputTokens: true,
      outputTokens: true,
      cacheCreationTokens: true,
      cacheReadTokens: true,
      costMicroCents: true,
    },
    _count: { _all: true },
  });
  return {
    inputTokens: agg._sum.inputTokens ?? 0,
    outputTokens: agg._sum.outputTokens ?? 0,
    cacheCreationTokens: agg._sum.cacheCreationTokens ?? 0,
    cacheReadTokens: agg._sum.cacheReadTokens ?? 0,
    costMicroCents: agg._sum.costMicroCents ?? 0n,
    callCount: agg._count._all,
  };
}

/** Per-surface breakdown for the same window. Result is sorted by
 *  `costMicroCents` DESC so the heaviest surfaces appear first on the
 *  UI. Zero-cost surfaces (no rows in the window) are omitted — the UI
 *  is free to show "No activity from $surface this period" by checking
 *  the surface against the returned row list. */
async function sumWindowBySurface(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  fromInclusive: Date,
  toExclusive: Date,
): Promise<SurfaceBreakdownRow[]> {
  const rows = await tx.llmUsageRecord.groupBy({
    by: ['sourceSurface'],
    where: {
      workspaceId,
      createdAt: { gte: fromInclusive, lt: toExclusive },
    },
    _sum: {
      inputTokens: true,
      outputTokens: true,
      cacheCreationTokens: true,
      cacheReadTokens: true,
      costMicroCents: true,
    },
    _count: { _all: true },
  });
  return rows
    .map(
      (r): SurfaceBreakdownRow => ({
        sourceSurface: r.sourceSurface,
        sums: {
          inputTokens: r._sum.inputTokens ?? 0,
          outputTokens: r._sum.outputTokens ?? 0,
          cacheCreationTokens: r._sum.cacheCreationTokens ?? 0,
          cacheReadTokens: r._sum.cacheReadTokens ?? 0,
          costMicroCents: r._sum.costMicroCents ?? 0n,
          callCount: r._count._all,
        },
      }),
    )
    .sort((a, b) =>
      a.sums.costMicroCents > b.sums.costMicroCents
        ? -1
        : a.sums.costMicroCents < b.sums.costMicroCents
          ? 1
          : 0,
    );
}

export { ZERO_SUMS };

/** UTC midnight of `now`. We use UTC (not the customer's locale) because
 *  `createdAt` is stored in UTC and the daily Stripe cron operates in
 *  UTC; a locale-shifted "today" would create off-by-one rows at the
 *  edge of midnight. */
function startOfDayUtc(now: Date): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

/** Cache-savings helper used by the UI: "X% of input-equivalent tokens
 *  served from cache" + "saved roughly $Y vs uncached this period". The
 *  uncached cost is what the workspace WOULD have paid had every
 *  cache_read been a full input token; the saving is the delta. Both
 *  numbers are best-effort estimates derived from the current pricing
 *  table; the actual Anthropic invoice is what's billed. */
export interface CacheSavings {
  /** read / (input + write + read), 0..1, two-decimal precision. 0 when
   *  no tokens at all. */
  hitRate: number;
  /** Estimated saved spend (micro-cents) this period, vs an uncached
   *  baseline where every cache_read had been billed at full input rate. */
  estimatedSavedMicroCents: bigint;
}

export function computeCacheSavings(
  sums: UsageSums,
  /** Pass the Sonnet rates from `pricing.ts` unless the workspace's
   *  dominant model is different; cache savings are a coarse number,
   *  not an audit line. */
  inputRatePerMillionMicroCents: bigint,
  cacheReadRatePerMillionMicroCents: bigint,
): CacheSavings {
  const totalInputLike =
    sums.inputTokens + sums.cacheCreationTokens + sums.cacheReadTokens;
  const hitRate =
    totalInputLike === 0
      ? 0
      : Math.round((sums.cacheReadTokens / totalInputLike) * 100) / 100;
  const MILLION = 1_000_000n;
  const cacheReadTokens = BigInt(Math.max(0, sums.cacheReadTokens));
  const baselineIfUncached =
    (cacheReadTokens * inputRatePerMillionMicroCents) / MILLION;
  const actualPaidOnReads =
    (cacheReadTokens * cacheReadRatePerMillionMicroCents) / MILLION;
  const saved =
    baselineIfUncached > actualPaidOnReads
      ? baselineIfUncached - actualPaidOnReads
      : 0n;
  return { hitRate, estimatedSavedMicroCents: saved };
}
