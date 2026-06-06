/**
 * lib/billing/usage/cache-stats.ts
 *
 * Per-skill prompt-cache observability. Reads `LlmUsageRecord` (the rows the
 * `LoggingLlmProvider` -> `persistUsageRecorder` seam writes on every
 * workspace-tagged completion) and rolls them up by `sourceSurface` — which
 * is this codebase's stand-in for "which skill / agent made the call".
 *
 * Powers the cache-hit-rate panel on `/operator/integrations`. The whole
 * point of the `CachingLlmProvider` wrapper is to drive cache reads up; this
 * is how an operator SEES whether it's working, per skill, without grepping
 * the `llm.usage` log lines.
 *
 * Cache-hit rate definition (matches `logging-provider.ts` summarizeUsage):
 *
 *     hitRate = cacheRead / (cacheRead + input + cacheWrite)
 *
 * i.e. the share of input-like tokens served from cache vs. processed fresh
 * (uncached input) or written into cache (the ~1.25x-rate write). Output
 * tokens are excluded — caching is an input-side mechanism. A surface whose
 * stable prefix never caches sits at 0; a hot surface re-reading a warm
 * prefix trends toward 1.
 *
 * Per feedback_no_silent_vendor_lock: the Prisma boundary for cache stats
 * lives here, beside the recorder. The operator page imports a typed result,
 * not a query.
 *
 * Per feedback_cold_start_safe_agents: stateless. Every call re-reads the DB;
 * nothing is memoized.
 */

import type { LlmSourceSurface } from '@prisma/client';
import { withSystemContext } from '@/lib/db';

export interface SkillCacheStat {
  /** The `LlmSourceSurface` enum value — the skill / agent surface tag. */
  sourceSurface: LlmSourceSurface;
  /** Number of `LlmUsageRecord` rows (≈ completions) in the window. */
  calls: number;
  /** Uncached input tokens billed at full rate. */
  inputTokens: number;
  /** Tokens read FROM cache (~0.1x rate) — the savings. */
  cacheReadTokens: number;
  /** Tokens WRITTEN to cache (~1.25x rate) — amortized across later reads. */
  cacheCreationTokens: number;
  /** read / (read + input + write); 0 when no input-like tokens. 0..1, 3dp. */
  cacheHitRate: number;
}

/**
 * Pure rate math, exported for unit tests. Mirrors the live log-line formula
 * so the operator panel and the `llm.usage` logs never disagree.
 */
export function computeCacheHitRate(
  cacheReadTokens: number,
  inputTokens: number,
  cacheCreationTokens: number,
): number {
  const denom = cacheReadTokens + inputTokens + cacheCreationTokens;
  if (denom <= 0) return 0;
  return Math.round((cacheReadTokens / denom) * 1000) / 1000;
}

/**
 * Aggregate cache stats per skill surface over the trailing `windowDays`
 * (default 7). Cross-workspace read via the operator/system GUC — this is an
 * operator-only surface, so per-membership RLS would wrongly scope it.
 * Sorted by call volume so the busiest surfaces lead.
 */
export async function loadCacheHitRateBySkill(
  windowDays = 7,
): Promise<SkillCacheStat[]> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  const grouped = await withSystemContext((tx) =>
    tx.llmUsageRecord.groupBy({
      by: ['sourceSurface'],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
      _sum: {
        inputTokens: true,
        cacheReadTokens: true,
        cacheCreationTokens: true,
      },
    }),
  );

  return grouped
    .map((g): SkillCacheStat => {
      const input = g._sum.inputTokens ?? 0;
      const read = g._sum.cacheReadTokens ?? 0;
      const write = g._sum.cacheCreationTokens ?? 0;
      return {
        sourceSurface: g.sourceSurface,
        calls: g._count._all,
        inputTokens: input,
        cacheReadTokens: read,
        cacheCreationTokens: write,
        cacheHitRate: computeCacheHitRate(read, input, write),
      };
    })
    .sort((a, b) => b.calls - a.calls);
}
