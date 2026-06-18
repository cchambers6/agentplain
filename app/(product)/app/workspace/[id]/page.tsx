import { requireWorkspaceMember } from "@/lib/auth";
import { verticalSlugFromEnum } from "@/lib/auth/vertical-enum";
import { withRls } from "@/lib/db";
import { getBriefingsProvider } from "@/lib/notion";
import { servicePartnerForWorkspace } from "@/lib/onboarding/service-partner";
import { getVerticalContent } from "@/lib/verticals";
import { isDemoMode } from "@/lib/demo/demo-mode";
import { killerWorkflowStoryFor } from "@/lib/workflows/verticals";
import { env } from "@/lib/env";
import { readSavedTimeSummary } from "@/lib/guarantee/saved-time";
import {
  barHoursToMinutes,
  evaluateGuarantee,
  formatMinutes,
} from "@/lib/guarantee/evaluation";
import { WalkAwayOffer } from "@/components/guarantee/WalkAwayOffer";
import { OverviewView } from "./overview-view";
import { acceptWalkAway } from "./guarantee/actions";

interface PageProps {
  params: Promise<{ id: string }>;
}

// Thin server loader for the broker-owner overview. All presentation,
// copy, and state logic lives in `overview-view.tsx` (DB-free, unit
// tested). This file only fetches and shapes data, then hands it over.

export default async function WorkspaceOverviewPage({ params }: PageProps) {
  const { id: workspaceId } = await params;
  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);

  const ctx = {
    userId: member.userId,
    workspaceId,
    isOperator: false,
  };

  const now = new Date();
  const [
    pendingApprovals,
    openFlags,
    recentHandoffs,
    workspace,
    onboarding,
    activePause,
    savings,
  ] =
    await Promise.all([
      withRls(ctx, (tx) =>
        tx.workApprovalQueueItem.count({
          where: { workspaceId, status: "PENDING" },
        }),
      ),
      withRls(ctx, (tx) =>
        tx.complianceFlag.count({ where: { workspaceId, state: "OPEN" } }),
      ),
      withRls(ctx, (tx) =>
        tx.handoffLogEntry.findMany({
          where: { workspaceId },
          orderBy: { occurredAt: "desc" },
          take: 8,
        }),
      ),
      withRls(ctx, (tx) =>
        tx.workspace.findUnique({
          where: { id: workspaceId },
          select: {
            vertical: true,
            verticalTier: true,
            createdAt: true,
            closureStatus: true,
          },
        }),
      ),
      withRls(ctx, (tx) =>
        tx.onboardingState.findUnique({ where: { workspaceId } }),
      ),
      // Wave-5 active-pause banner. Pull the first currently-active
      // pause (if any) so the overview can render "Plaino is paused"
      // above the headline. We surface only `pausedUntil` +
      // discipline scope — the encrypted reason stays out of the
      // overview to keep the banner non-PII.
      withRls(ctx, (tx) =>
        tx.workspacePauseConfig.findFirst({
          where: {
            workspaceId,
            pausedFrom: { lte: new Date() },
            pausedUntil: { gt: new Date() },
          },
          select: { pausedUntil: true, pausedDisciplineIds: true },
          orderBy: { pausedUntil: "desc" },
        }),
      ),
      // Trial-guarantee time-savings totals for the counter + the Day-7
      // walk-away eligibility check. Read under the broker-owner's RLS.
      withRls(ctx, (tx) => readSavedTimeSummary(tx, workspaceId, now)),
    ]);

  const verticalSlug = workspace
    ? verticalSlugFromEnum(workspace.vertical)
    : null;
  const verticalContent = verticalSlug
    ? getVerticalContent(verticalSlug)
    : null;
  const verticalIsLive = verticalSlug === "real-estate";
  const onboardingComplete = onboarding?.completedAt != null;
  const partner = servicePartnerForWorkspace(workspaceId);

  const briefings = await getBriefingsProvider().fetchBriefings({
    workspaceId,
    limit: 1,
  });
  const briefing = briefings[0] ?? null;

  // Demo mode: a brand-new workspace with no real work yet leads the overview
  // with its vertical's killer workflow running on synthetic data — so the
  // first impression is Plaino visibly working, not an empty queue. Steps
  // aside the moment real drafts or handoffs land. Deterministic + LLM-free.
  const demoStory = isDemoMode({
    pendingApprovals,
    recentHandoffsCount: recentHandoffs.length,
  })
    ? killerWorkflowStoryFor(workspace?.vertical ?? null)
    : null;

  // Day-7 guarantee: surface the walk-away offer when the fleet hasn't
  // cleared the bar by the evaluation day. Computed LIVE here (not gated on
  // the cron having run) so the surface is correct even if the cron is
  // paused. Bounded to a short action window after the evaluation day so it
  // never haunts a settled, long-running customer.
  const evaluationDays = env.guaranteeEvaluationDays();
  const barMinutes = barHoursToMinutes(env.guaranteeBarHours());
  const ageDays = workspace?.createdAt
    ? Math.floor(
        (now.getTime() - workspace.createdAt.getTime()) / (24 * 60 * 60 * 1000),
      )
    : 0;
  const guaranteeEval = evaluateGuarantee({
    totalMinutesSaved: savings.totalMinutes,
    barMinutes,
    ageDays,
    evaluationDays,
  });
  const walkAwayEligible =
    guaranteeEval.walkAwayEligible &&
    ageDays <= evaluationDays + 7 &&
    workspace?.closureStatus === "ACTIVE";

  return (
    <>
      {walkAwayEligible ? (
        <div className="mb-8">
          <WalkAwayOffer
            workspaceId={workspaceId}
            partner={partner}
            savedLabel={formatMinutes(savings.totalMinutes)}
            barLabel={formatMinutes(barMinutes)}
            onAccept={acceptWalkAway}
          />
        </div>
      ) : null}
      <OverviewView
      workspaceId={workspaceId}
      email={member.email}
      partner={partner}
      pendingApprovals={pendingApprovals}
      openFlags={openFlags}
      recentHandoffs={recentHandoffs}
      briefing={briefing}
      onboardingComplete={onboardingComplete}
      verticalName={verticalContent?.name ?? null}
      verticalTier={workspace?.verticalTier ?? null}
      verticalIsLive={verticalIsLive}
      verticalIntegrationsWindow={
        verticalContent?.integrations.plannedWindow ?? null
      }
      verticalPublicHref={verticalSlug ? `/${verticalSlug}` : null}
      activePause={activePause}
      demoStory={demoStory}
      savingsWeekMinutes={savings.weekMinutes}
      savingsTotalMinutes={savings.totalMinutes}
      />
    </>
  );
}
