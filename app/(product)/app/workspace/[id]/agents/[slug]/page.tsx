import {
  ApEyebrow,
  ApHairlineList,
  ApHairlineRow,
  ApRootedEmptyState,
} from "@/components/ui/ap";
import { requireWorkspaceMember } from "@/lib/auth";
import { withRls } from "@/lib/db";

interface PageProps {
  params: Promise<{ id: string; slug: string }>;
}

export default async function AgentDetailPage({ params }: PageProps) {
  const { id: workspaceId, slug: agentSlug } = await params;
  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);
  const ctx = { userId: member.userId, workspaceId, isOperator: false };

  const [pendingItems, recentHandoffs] = await Promise.all([
    withRls(ctx, (tx) =>
      tx.workApprovalQueueItem.findMany({
        where: { workspaceId, agentSlug, status: "PENDING" },
        orderBy: { proposedAt: "desc" },
        take: 10,
      }),
    ),
    withRls(ctx, (tx) =>
      tx.handoffLogEntry.findMany({
        where: {
          workspaceId,
          OR: [{ fromAgent: agentSlug }, { toAgent: agentSlug }],
        },
        orderBy: { occurredAt: "desc" },
        take: 20,
      }),
    ),
  ]);

  return (
    <div>
      <ApEyebrow className="mb-3">{agentSlug}</ApEyebrow>
      <h1 className="font-display text-3xl text-ink">Agent activity</h1>

      <section className="mt-8">
        <ApEyebrow className="mb-3">
          awaiting your decision ({pendingItems.length})
        </ApEyebrow>
        {pendingItems.length === 0 ? (
          <ApRootedEmptyState
            motif="wheat"
            reality="Nothing waiting from this capability."
            change="Drafts queue here when this agent surfaces a decision above your threshold."
          />
        ) : (
          <ApHairlineList aria-label="Pending decisions">
            {pendingItems.map((item) => (
              <ApHairlineRow
                key={item.id}
                right={
                  <span className="font-mono text-[11px] uppercase text-mute">
                    {new Date(item.proposedAt).toLocaleString()}
                  </span>
                }
              >
                <div>
                  <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
                    {item.kind}
                  </p>
                  <p className="mt-1 text-[15px] text-ink">
                    {item.refTable}:{item.refId}
                  </p>
                </div>
              </ApHairlineRow>
            ))}
          </ApHairlineList>
        )}
      </section>

      <section className="mt-10">
        <ApEyebrow className="mb-3">recent handoffs</ApEyebrow>
        {recentHandoffs.length === 0 ? (
          <ApRootedEmptyState
            motif="horizon"
            reality="No handoffs logged involving this capability yet."
            change="Handoffs land here as soon as the fleet routes work through this agent."
          />
        ) : (
          <ApHairlineList aria-label="Recent handoffs">
            {recentHandoffs.map((h) => (
              <ApHairlineRow
                key={h.id}
                right={
                  <span className="font-mono text-[11px] uppercase text-mute">
                    {new Date(h.occurredAt).toLocaleString()}
                  </span>
                }
              >
                <span className="text-ink-soft">
                  <span className="font-mono text-ink">{h.fromAgent}</span>
                  <span className="mx-2 text-mute">→</span>
                  <span className="font-mono text-ink">{h.toAgent}</span>
                  <span className="ml-2 text-mute">· {h.handoffType}</span>
                </span>
              </ApHairlineRow>
            ))}
          </ApHairlineList>
        )}
      </section>
    </div>
  );
}
