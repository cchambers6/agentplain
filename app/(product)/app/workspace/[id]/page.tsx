import { requireWorkspaceMember } from "@/lib/auth";
import { verticalSlugFromEnum } from "@/lib/auth/vertical-enum";
import { withRls } from "@/lib/db";
import { getBriefingsProvider } from "@/lib/notion";
import { servicePartnerForWorkspace } from "@/lib/onboarding/service-partner";
import { getVerticalContent } from "@/lib/verticals";
import { OverviewView } from "./overview-view";

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

  const [pendingApprovals, openFlags, recentHandoffs, workspace, onboarding, activePause] =
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
          select: { vertical: true, verticalTier: true },
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

  return (
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
    />
  );
}
