// /operator/workspaces/[workspaceId]/impersonate — read-only "view as the
// customer" surface. Renders the customer's OWN overview component
// (OverviewView) so the operator sees exactly what the broker-owner sees on
// their workspace home — no parallel mock to drift.
//
// Read-only by construction (see lib/operator/impersonation.ts): this lives
// under /operator, wires NO server actions, and reads under operator RLS.
// The operator has no membership, so even the customer's own actions —
// unreachable from here anyway — would reject them. Every view writes an
// AuditLog row.

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/server";
import { withSystemContext } from "@/lib/db/rls";
import { verticalSlugFromEnum } from "@/lib/auth/vertical-enum";
import { getBriefingsProvider } from "@/lib/notion";
import { servicePartnerForWorkspace } from "@/lib/onboarding/service-partner";
import { getVerticalContent } from "@/lib/verticals";
import { OverviewView } from "@/app/(product)/app/workspace/[id]/overview-view";
import { buildImpersonationAuditEntry } from "@/lib/operator/impersonation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface PageProps {
  params: Promise<{ workspaceId: string }>;
}

export default async function OperatorImpersonatePage(props: PageProps) {
  const session = await requireUser();
  if (!session.isOperator) {
    redirect("/app");
  }
  const { workspaceId } = await props.params;

  const loaded = await withSystemContext(async (tx) => {
    const workspace = await tx.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, name: true, slug: true, vertical: true, verticalTier: true },
    });
    if (!workspace) return null;

    const [brokerOwner, pendingApprovals, openFlags, recentHandoffs, onboarding, activePause] =
      await Promise.all([
        tx.membership.findFirst({
          where: { workspaceId, role: "BROKER_OWNER", status: "ACTIVE" },
          select: { user: { select: { email: true } } },
          orderBy: { createdAt: "asc" },
        }),
        tx.workApprovalQueueItem.count({
          where: { workspaceId, status: "PENDING" },
        }),
        tx.complianceFlag.count({ where: { workspaceId, state: "OPEN" } }),
        tx.handoffLogEntry.findMany({
          where: { workspaceId },
          orderBy: { occurredAt: "desc" },
          take: 8,
        }),
        tx.onboardingState.findUnique({ where: { workspaceId } }),
        tx.workspacePauseConfig.findFirst({
          where: {
            workspaceId,
            pausedFrom: { lte: new Date() },
            pausedUntil: { gt: new Date() },
          },
          select: { pausedUntil: true, pausedDisciplineIds: true },
          orderBy: { pausedUntil: "desc" },
        }),
      ]);

    // Audit every entry into the read-only view.
    await tx.auditLog.create({
      data: buildImpersonationAuditEntry({
        operatorUserId: session.userId,
        workspaceId,
        workspaceName: workspace.name,
        workspaceSlug: workspace.slug,
      }),
    });

    return { workspace, brokerOwner, pendingApprovals, openFlags, recentHandoffs, onboarding, activePause };
  });

  if (!loaded) {
    notFound();
  }

  const { workspace } = loaded;
  const verticalSlug = verticalSlugFromEnum(workspace.vertical);
  const verticalContent = verticalSlug ? getVerticalContent(verticalSlug) : null;
  const verticalIsLive = verticalSlug === "real-estate";
  const onboardingComplete = loaded.onboarding?.completedAt != null;
  const partner = servicePartnerForWorkspace(workspaceId);
  const customerEmail = loaded.brokerOwner?.user.email ?? `${workspace.slug}@workspace`;

  const briefings = await getBriefingsProvider().fetchBriefings({
    workspaceId,
    limit: 1,
  });
  const briefing = briefings[0] ?? null;

  return (
    <div>
      {/* Read-only operator banner — non-dismissible, top of view. */}
      <div
        role="status"
        className="border-b border-flag bg-paper-deep px-4 py-3 text-[13px] text-ink"
      >
        <div className="container-wide flex flex-wrap items-center justify-between gap-3">
          <span>
            You are viewing as <strong>{workspace.name}</strong> — read-only.
            No actions are available; nothing here is editable.
          </span>
          <Link
            href={`/operator/workspaces/${workspaceId}`}
            className="font-mono text-[11px] uppercase tracking-eyebrow text-ink underline"
          >
            ← back to deep-dive
          </Link>
        </div>
      </div>

      <div className="container-wide py-10">
        <OverviewView
          workspaceId={workspaceId}
          email={customerEmail}
          partner={partner}
          pendingApprovals={loaded.pendingApprovals}
          openFlags={loaded.openFlags}
          recentHandoffs={loaded.recentHandoffs}
          briefing={briefing}
          onboardingComplete={onboardingComplete}
          verticalName={verticalContent?.name ?? null}
          verticalTier={workspace.verticalTier}
          verticalIsLive={verticalIsLive}
          verticalIntegrationsWindow={
            verticalContent?.integrations.plannedWindow ?? null
          }
          activePause={loaded.activePause}
        />
      </div>
    </div>
  );
}
