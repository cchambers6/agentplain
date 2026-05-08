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
      <p className="eyebrow mb-3">{agentSlug}</p>
      <h1 className="font-display text-3xl text-ink">Agent activity</h1>

      <section className="mt-8">
        <h2 className="eyebrow mb-3">Awaiting your decision ({pendingItems.length})</h2>
        {pendingItems.length === 0 ? (
          <p className="text-[15px] text-slate-soft">
            No pending items from this agent.
          </p>
        ) : (
          <ul className="divide-y divide-rule border border-rule bg-paper">
            {pendingItems.map((item) => (
              <li key={item.id} className="flex items-baseline justify-between gap-4 p-4">
                <div>
                  <p className="font-mono text-[11px] tracking-eyebrow uppercase text-slate-soft">
                    {item.kind}
                  </p>
                  <p className="mt-1 text-[15px] text-ink">
                    {item.refTable}:{item.refId}
                  </p>
                </div>
                <span className="font-mono text-[11px] uppercase text-slate-soft">
                  {new Date(item.proposedAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="eyebrow mb-3">Recent handoffs</h2>
        {recentHandoffs.length === 0 ? (
          <p className="text-[15px] text-slate-soft">
            No handoffs involving this agent yet.
          </p>
        ) : (
          <ul className="divide-y divide-rule border border-rule bg-paper">
            {recentHandoffs.map((h) => (
              <li key={h.id} className="flex items-baseline justify-between gap-4 p-4 text-[14px]">
                <span className="truncate">
                  <span className="font-mono">{h.fromAgent}</span>
                  <span className="mx-1 text-slate-soft">→</span>
                  <span className="font-mono">{h.toAgent}</span>
                  <span className="ml-2 text-slate-soft">{h.handoffType}</span>
                </span>
                <span className="font-mono text-[11px] uppercase text-slate-soft">
                  {new Date(h.occurredAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
