// /operator/workspaces/[workspaceId] — per-workspace deep-dive inspector.
//
// Single operator surface to triage one workspace's health: token-budget
// consumption, approval-queue depth + age, connected-integration health,
// recent agent activity, billing state, members + last human activity, and
// capability proposals awaiting review. Plus a read-only "impersonate" entry
// (renders the customer's own home view) and a JSON "export workspace state"
// for support investigations.
//
// Thin loader: this file authorizes, reads, and shapes; all rendering lives
// in `workspace-detail-view.tsx` (DB-free, unit-tested) and all shaping in
// `lib/operator/workspace-inspector.ts` (pure, unit-tested). The budget math
// goes through the shared `lib/billing/budget.ts` seam so the consumption
// bar here uses the exact derivation the budget-enforcement wave gates on.
//
// RLS: like the workspaces list, this reads every workspace's rows, so the
// loads run under `withSystemContext` (operator GUC branch). Defense-in-depth
// `isOperator` check below mirrors `actions.ts`.

import { notFound, redirect } from "next/navigation";
import { withSystemContext } from "@/lib/db/rls";
import { requireUser } from "@/lib/auth/server";
import { listIntegrations } from "@/lib/integrations/marketplace";
import { getWorkspaceUsageReport } from "@/lib/billing/usage/aggregate";
import { deriveBudgetStatus, resolveBudgetCapUsd } from "@/lib/billing/budget";
import { recommendBudgetCapUsdFromRow } from "@/lib/billing/recommendations";
import {
  tierDisplayName,
  tierFromVerticalTier,
  monthlyChargeUsdCents,
} from "@/lib/pricing/tiers";
import { applyBudgetCapAction } from "../actions";
import {
  buildActivityTimeline,
  buildApprovalQueueSummary,
  deriveIntegrationHealth,
  deriveLastUserActivity,
  mapUsageSurfaces,
  summarizeActivity,
} from "@/lib/operator/workspace-inspector";
import {
  WorkspaceDetailView,
  type BillingSummary,
  type CapabilityProposalRow,
  type MembershipRow,
} from "./workspace-detail-view";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface PageProps {
  params: Promise<{ workspaceId: string }>;
}

// Provider → display name, sourced once from the marketplace catalog
// (single source of truth per feedback_no_silent_vendor_lock).
function integrationNameByProvider(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const entry of listIntegrations()) {
    if (entry.providerKey) out[entry.providerKey] = entry.name;
  }
  return out;
}

export default async function OperatorWorkspaceDetailPage(props: PageProps) {
  const session = await requireUser();
  if (!session.isOperator) {
    redirect("/app");
  }
  const { workspaceId } = await props.params;
  const now = new Date();

  const data = await withSystemContext(async (tx) => {
    const workspace = await tx.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        id: true,
        name: true,
        slug: true,
        vertical: true,
        verticalTier: true,
        tierPriceUsdMonthly: true,
        billingMode: true,
        closureStatus: true,
        settings: true,
        subscription: {
          select: {
            tier: true,
            seats: true,
            status: true,
            currentPeriodEnd: true,
          },
        },
      },
    });
    if (!workspace) return null;

    const [
      memberships,
      credentials,
      openApprovals,
      recentRuns,
      capabilityProposals,
      lastBillingEvent,
      lastApprovalDecision,
      lastUserAudit,
      usage,
    ] = await Promise.all([
      tx.membership.findMany({
        where: { workspaceId, status: { not: "DEACTIVATED" } },
        select: {
          userId: true,
          role: true,
          status: true,
          user: { select: { email: true, name: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
      tx.integrationCredential.findMany({
        where: { workspaceId },
        select: {
          provider: true,
          accountEmail: true,
          status: true,
          scopes: true,
          expiresAt: true,
          lastRefreshedAt: true,
        },
      }),
      tx.workApprovalQueueItem.findMany({
        where: { workspaceId, status: "PENDING" },
        select: { proposedAt: true },
      }),
      tx.skillRun.findMany({
        where: { workspaceId },
        select: {
          id: true,
          skillSlug: true,
          discipline: true,
          firedAt: true,
          completedAt: true,
          outcome: true,
          durationMs: true,
          queueItem: { select: { status: true } },
        },
        orderBy: { firedAt: "desc" },
        take: 100,
      }),
      tx.capabilityProposal.findMany({
        where: { workspaceId, state: { in: ["AWAITING_REVIEW", "AWAITING_VOICE_BLOCK", "DRAFT"] } },
        select: {
          id: true,
          targetAgentSlug: true,
          state: true,
          proposer: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      tx.billingEvent.findFirst({
        where: { workspaceId },
        select: { type: true, receivedAt: true },
        orderBy: { receivedAt: "desc" },
      }),
      tx.workApprovalQueueItem.findFirst({
        where: { workspaceId, decidedAt: { not: null } },
        select: { decidedAt: true },
        orderBy: { decidedAt: "desc" },
      }),
      tx.auditLog.findFirst({
        where: { workspaceId, actorUserId: { not: null } },
        select: { occurredAt: true },
        orderBy: { occurredAt: "desc" },
      }),
      getWorkspaceUsageReport(tx, {
        workspaceId,
        periodStart: null,
        now,
      }),
    ]);

    return {
      workspace,
      memberships,
      credentials,
      openApprovals,
      recentRuns,
      capabilityProposals,
      lastBillingEvent,
      lastApprovalDecision,
      lastUserAudit,
      usage,
    };
  });

  if (!data) {
    notFound();
  }

  const { workspace } = data;

  // Budget — period spend through the usage seam, capped by the workspace's
  // configured cap (settings.tokenBudgetUsdMonthly) when set; otherwise the
  // bar shows raw spend with no cap. We do NOT fold revenue into the cap so
  // the budget state stays aligned with the enforcement gate; the revenue
  // comparison is surfaced separately as a margin signal.
  const period = data.usage.period;
  const budget = deriveBudgetStatus({
    workspaceId,
    consumedMicroCents: period.costMicroCents,
    capUsdMonthly: resolveBudgetCapUsd(workspace.settings, null),
    tokensThisPeriod:
      period.inputTokens +
      period.outputTokens +
      period.cacheCreationTokens +
      period.cacheReadTokens,
  });

  const integrations = deriveIntegrationHealth(
    data.credentials,
    integrationNameByProvider(),
    now,
  );

  const activity = buildActivityTimeline(
    data.recentRuns.map((r) => ({
      id: r.id,
      skillSlug: r.skillSlug,
      discipline: r.discipline,
      firedAt: r.firedAt,
      completedAt: r.completedAt,
      outcome: r.outcome,
      durationMs: r.durationMs,
      queueStatus: r.queueItem?.status ?? null,
    })),
  );

  // Subscription revenue (margin context). monthlyChargeUsdCents throws
  // outside the 1–99 self-serve seat ladder, so guard before computing.
  let monthlyRevenueUsd: number | null = null;
  const sub = workspace.subscription;
  if (sub && sub.seats >= 1 && sub.seats < 100) {
    const tier = tierFromVerticalTier(sub.tier);
    monthlyRevenueUsd = monthlyChargeUsdCents(tier, sub.seats).totalCents / 100;
  }

  // Advisory budget-cap recommendation (MRR × 0.30). NOT enforced — the
  // operator applies it explicitly via the Apply control, which writes
  // settings.tokenBudgetUsdMonthly (the only cap the gate throttles on). Max
  // (quote-based) workspaces have no productized price → null (no rec).
  const recommendedCapUsd = recommendBudgetCapUsdFromRow({
    verticalTier: workspace.verticalTier,
    tierPriceUsdMonthly: workspace.tierPriceUsdMonthly,
    subscription: sub ? { tier: sub.tier, seats: sub.seats } : null,
  });

  const billing: BillingSummary = {
    hasSubscription: Boolean(sub),
    status: sub?.status ?? null,
    tierLabel: sub ? tierDisplayName(tierFromVerticalTier(sub.tier)) : null,
    seats: sub?.seats ?? null,
    currentPeriodEnd: sub?.currentPeriodEnd ?? null,
    monthlyRevenueUsd,
    lastEventType: data.lastBillingEvent?.type ?? null,
    lastEventAt: data.lastBillingEvent?.receivedAt ?? null,
  };

  const memberships: MembershipRow[] = data.memberships.map((m) => ({
    userId: m.userId,
    email: m.user.email,
    name: m.user.name,
    role: m.role,
    status: m.status,
  }));

  const capabilityProposals: CapabilityProposalRow[] =
    data.capabilityProposals.map((p) => ({
      id: p.id,
      targetAgentSlug: p.targetAgentSlug,
      state: p.state,
      proposer: p.proposer,
      createdAt: p.createdAt,
    }));

  const lastUserActivityAt = deriveLastUserActivity([
    data.lastApprovalDecision?.decidedAt ?? null,
    data.lastUserAudit?.occurredAt ?? null,
  ]);

  return (
    <WorkspaceDetailView
      workspace={{
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        vertical: workspace.vertical,
        verticalTier: workspace.verticalTier,
        billingMode: workspace.billingMode,
        closureStatus: workspace.closureStatus,
      }}
      now={now}
      budget={budget}
      approvals={buildApprovalQueueSummary(data.openApprovals, now)}
      integrations={integrations}
      activity={activity}
      activityCounts={summarizeActivity(activity)}
      topSurfaces={mapUsageSurfaces(data.usage.periodBySurface).slice(0, 8)}
      billing={billing}
      memberships={memberships}
      capabilityProposals={capabilityProposals}
      lastUserActivityAt={lastUserActivityAt}
      recommendedCapUsd={recommendedCapUsd}
      applyBudgetCapAction={applyBudgetCapAction}
    />
  );
}
