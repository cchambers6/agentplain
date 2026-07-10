// Cost meter: every AI call is tagged agent + tier + tokens + $ estimate and
// aggregated into DailyCostRecord, so the ≤$10/family/month target is a
// query, not a guess. Operator surface only — parent-facing pages never show
// tokens, tiers, or models.

import { prisma } from "@/lib/db";
import type { AiUsage } from "./route";

export type AgentName = "integrator" | "headmaster" | "tutor" | "registrar";

// $/MTok sticker prices per tier's bound model (keep in lockstep with
// route.ts TIERS). Microcents = 1e-6 cents; integer math end to end.
const PRICES: Record<string, { inPerMTok: number; outPerMTok: number }> = {
  heavy: { inPerMTok: 5.0, outPerMTok: 25.0 },
  conversational: { inPerMTok: 3.0, outPerMTok: 15.0 },
  lightweight: { inPerMTok: 1.0, outPerMTok: 5.0 },
};

const CACHE_READ_FACTOR = 0.1;
const CACHE_WRITE_FACTOR = 1.25;

export function estimateMicrocents(tier: string, usage: AiUsage): number {
  const p = PRICES[tier];
  if (!p) return 0;
  const perTokIn = (p.inPerMTok / 1_000_000) * 100 * 1_000_000; // microcents/token
  const perTokOut = (p.outPerMTok / 1_000_000) * 100 * 1_000_000;
  return Math.round(
    usage.inputTokens * perTokIn +
      usage.outputTokens * perTokOut +
      usage.cacheReadTokens * perTokIn * CACHE_READ_FACTOR +
      usage.cacheWriteTokens * perTokIn * CACHE_WRITE_FACTOR,
  );
}

export async function recordCall(args: {
  familyId: string;
  agent: AgentName;
  tier: string;
  model: string;
  usage: AiUsage;
}): Promise<void> {
  const day = new Date();
  day.setUTCHours(0, 0, 0, 0);
  const cost = estimateMicrocents(args.tier, args.usage);

  await prisma.dailyCostRecord.upsert({
    where: {
      familyId_date_agent_tier: {
        familyId: args.familyId,
        date: day,
        agent: args.agent,
        tier: args.tier,
      },
    },
    create: {
      workspaceId: args.familyId,
      familyId: args.familyId,
      date: day,
      agent: args.agent,
      tier: args.tier,
      calls: 1,
      inputTokens: args.usage.inputTokens,
      outputTokens: args.usage.outputTokens,
      cacheReadTokens: args.usage.cacheReadTokens,
      cacheWriteTokens: args.usage.cacheWriteTokens,
      costMicrocents: cost,
    },
    update: {
      calls: { increment: 1 },
      inputTokens: { increment: args.usage.inputTokens },
      outputTokens: { increment: args.usage.outputTokens },
      cacheReadTokens: { increment: args.usage.cacheReadTokens },
      cacheWriteTokens: { increment: args.usage.cacheWriteTokens },
      costMicrocents: { increment: cost },
    },
  });
}

/** Month-to-date spend in cents for a family (operator/ops surface). */
export async function monthToDateCents(familyId: string): Promise<number> {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const agg = await prisma.dailyCostRecord.aggregate({
    where: { familyId, date: { gte: monthStart } },
    _sum: { costMicrocents: true },
  });
  return Math.round((agg._sum.costMicrocents ?? 0) / 1_000_000);
}
