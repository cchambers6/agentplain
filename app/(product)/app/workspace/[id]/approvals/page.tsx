import { requireWorkspaceMember } from "@/lib/auth";
import { withRls } from "@/lib/db";
import { decryptPayloadForRead } from "@/lib/security/payload-crypto";
import { ApEyebrow, ApRootedEmptyState } from "@/components/ui/ap";
import { asDisciplineId } from "@/lib/disciplines";
import { renderApprovalPayload } from "./renderApprovalPayload";
import { ApprovalsList, type ApprovalRow } from "./ApprovalsList";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ discipline?: string }>;
}

export const dynamic = "force-dynamic";

export default async function ApprovalsPage({ params, searchParams }: PageProps) {
  const { id: workspaceId } = await params;
  const sp = await searchParams;
  const initialDiscipline = asDisciplineId(sp.discipline ?? null);

  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);
  const ctx = { userId: member.userId, workspaceId, isOperator: false };

  const items = await withRls(ctx, (tx) =>
    tx.workApprovalQueueItem.findMany({
      where: { workspaceId, status: "PENDING" },
      orderBy: { proposedAt: "desc" },
      take: 50,
    }),
  );

  const rows: ApprovalRow[] = items.map((item) => ({
    id: item.id,
    agentSlug: item.agentSlug,
    kind: item.kind,
    discipline: asDisciplineId(item.discipline),
    proposedAtIso: item.proposedAt.toISOString(),
    rendered: renderApprovalPayload(item.kind, decryptPayloadForRead(item.payload)),
  }));

  return (
    <div>
      <ApEyebrow className="mb-3">work approvals</ApEyebrow>
      <h1 className="font-display text-3xl text-ink">
        Decisions waiting for you.
      </h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
        Nothing leaves agentplain on its own. We draft; you decide; your
        existing system is what actually sends. Every customer-facing item
        lands here first. Routine, low-stakes work clears in a quieter lane;
        anything above the threshold you set waits here for your yes.
      </p>

      {rows.length === 0 ? (
        <div className="mt-8">
          <ApRootedEmptyState
            scene="empty-approvals"
            reality="Nothing waiting on you."
            change="Plaino is sitting ready, fetching from your connected sources and herding work as it surfaces. New decisions land here as they cross your threshold."
          />
        </div>
      ) : (
        <ApprovalsList
          workspaceId={workspaceId}
          rows={rows}
          initialDiscipline={initialDiscipline}
        />
      )}
    </div>
  );
}
