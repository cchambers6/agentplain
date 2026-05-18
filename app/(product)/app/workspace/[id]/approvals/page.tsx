import { requireWorkspaceMember } from "@/lib/auth";
import { withRls } from "@/lib/db";
import { ApEyebrow, ApRootedEmptyState } from "@/components/ui/ap";
import { renderApprovalPayload } from "./renderApprovalPayload";
import { ApprovalsList } from "./ApprovalsList";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

export default async function ApprovalsPage({ params }: PageProps) {
  const { id: workspaceId } = await params;
  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);
  const ctx = { userId: member.userId, workspaceId, isOperator: false };

  const items = await withRls(ctx, (tx) =>
    tx.workApprovalQueueItem.findMany({
      where: { workspaceId, status: "PENDING" },
      orderBy: { proposedAt: "desc" },
      take: 50,
    }),
  );

  const rows = items.map((item) => ({
    id: item.id,
    agentSlug: item.agentSlug,
    kind: item.kind,
    proposedAtIso: item.proposedAt.toISOString(),
    rendered: renderApprovalPayload(item.kind, item.payload),
  }));

  return (
    <div>
      <ApEyebrow className="mb-3">work approvals</ApEyebrow>
      <h1 className="font-display text-3xl text-ink">
        Decisions waiting for you.
      </h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
        Routine items send through automatically. Anything above your
        threshold lands here for explicit ratification — we draft, you
        decide, your existing system sends.
      </p>

      {rows.length === 0 ? (
        <div className="mt-8">
          <ApRootedEmptyState
            motif="wheat"
            reality="Nothing waiting on you."
            change="Your fleet is reading and acting. New items land here as they surface."
          />
        </div>
      ) : (
        <ApprovalsList workspaceId={workspaceId} rows={rows} />
      )}
    </div>
  );
}
