/**
 * lib/team/performance.ts
 *
 * Per-member performance KPIs (item 9 of the 2026-06-17 strategic build),
 * surfaced as widgets in the Weekly BI report (item 7) and on the team
 * page. The question the owner asks: "Is everyone keeping up, and is the
 * work landing well?"
 *
 * Three honest, derivable signals — no new instrumentation:
 *   - tasksCompleted  : approval-queue items this member decided.
 *   - avgResponseMs   : mean (decidedAt − proposedAt) over those items.
 *   - satisfaction    : a PROXY, not a survey. Share of decided items the
 *                       member APPROVED (vs rejected/sent back). A healthy
 *                       member approves most of what reaches them; a high
 *                       reject rate signals the fleet's drafts aren't
 *                       landing for that person's work. Labelled a proxy
 *                       everywhere it surfaces so it's never mistaken for
 *                       a real CSAT number (per `feedback_no_guesses`).
 *
 * The core (`computeMemberKpis`) is pure: hand it the decided items + the
 * roster and it returns the per-member rows. The DB wrapper reads a time
 * window of decided items and joins the active roster.
 */

import type { Role, WorkApprovalStatus } from '@prisma/client';
import { withRls, type RlsContext } from '@/lib/db';

/** A decided approval-queue item, reduced to what the KPI math needs. */
export interface DecidedItem {
  decidedByUserId: string | null;
  proposedAt: Date;
  decidedAt: Date | null;
  status: WorkApprovalStatus;
}

/** A member the KPIs are computed for. */
export interface KpiMember {
  userId: string;
  label: string;
  role: Role;
}

export interface MemberKpis {
  userId: string;
  label: string;
  role: Role;
  /** Items this member decided in the window. */
  tasksCompleted: number;
  /** Mean response time in ms, or null if no timed decisions. */
  avgResponseMs: number | null;
  /** Approval-rate proxy in [0,1], or null if nothing decided. */
  satisfactionProxy: number | null;
}

/** Statuses that count as a positive ("approved") decision for the proxy. */
const POSITIVE_STATUSES: ReadonlySet<WorkApprovalStatus> = new Set<WorkApprovalStatus>([
  'APPROVED',
  'AUTO_APPROVED',
]);

/**
 * Pure KPI computation. Buckets decided items by member and rolls up the
 * three signals. Members with no decided items in the window still get a
 * row (zeros / nulls) so the widget shows the whole team, not just the
 * busy ones.
 */
export function computeMemberKpis(
  items: DecidedItem[],
  members: KpiMember[],
): MemberKpis[] {
  interface Acc {
    count: number;
    responseMsSum: number;
    timedCount: number;
    positive: number;
  }
  const byUser = new Map<string, Acc>();
  const ensure = (id: string): Acc => {
    let a = byUser.get(id);
    if (!a) {
      a = { count: 0, responseMsSum: 0, timedCount: 0, positive: 0 };
      byUser.set(id, a);
    }
    return a;
  };

  for (const item of items) {
    if (!item.decidedByUserId) continue;
    const a = ensure(item.decidedByUserId);
    a.count += 1;
    if (item.decidedAt) {
      const ms = item.decidedAt.getTime() - item.proposedAt.getTime();
      // Guard against clock skew / backfilled rows producing negatives.
      if (ms >= 0) {
        a.responseMsSum += ms;
        a.timedCount += 1;
      }
    }
    if (POSITIVE_STATUSES.has(item.status)) a.positive += 1;
  }

  return members.map((m) => {
    const a = byUser.get(m.userId);
    if (!a || a.count === 0) {
      return {
        userId: m.userId,
        label: m.label,
        role: m.role,
        tasksCompleted: 0,
        avgResponseMs: null,
        satisfactionProxy: null,
      };
    }
    return {
      userId: m.userId,
      label: m.label,
      role: m.role,
      tasksCompleted: a.count,
      avgResponseMs: a.timedCount > 0 ? Math.round(a.responseMsSum / a.timedCount) : null,
      satisfactionProxy: a.positive / a.count,
    };
  });
}

/** Format an avg-response duration for display. Coarse on purpose. */
export function formatResponseMs(ms: number | null): string {
  if (ms == null) return '—';
  const minutes = ms / 60_000;
  if (minutes < 60) return `${Math.max(1, Math.round(minutes))}m`;
  const hours = minutes / 60;
  if (hours < 48) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
}

/**
 * DB-backed KPIs over the trailing `windowDays`. Reads decided items in
 * the window + the active roster, then defers to the pure core. RLS-bound
 * via the caller's context.
 */
export async function getMemberPerformance(
  ctx: RlsContext,
  workspaceId: string,
  windowDays = 7,
): Promise<MemberKpis[]> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  const [items, members] = await Promise.all([
    withRls(ctx, (tx) =>
      tx.workApprovalQueueItem.findMany({
        where: {
          workspaceId,
          decidedAt: { gte: since },
          decidedByUserId: { not: null },
        },
        select: {
          decidedByUserId: true,
          proposedAt: true,
          decidedAt: true,
          status: true,
        },
      }),
    ),
    withRls(ctx, (tx) =>
      tx.membership.findMany({
        where: { workspaceId, status: 'ACTIVE', removedAt: null },
        select: {
          userId: true,
          role: true,
          user: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
    ),
  ]);

  const kpiMembers: KpiMember[] = members.map((m) => ({
    userId: m.userId,
    label: m.user.name ?? m.user.email,
    role: m.role,
  }));

  return computeMemberKpis(items as DecidedItem[], kpiMembers);
}
