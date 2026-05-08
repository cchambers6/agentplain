import { requireWorkspaceMember } from "@/lib/auth";
import { withRls } from "@/lib/db";
import { decideApprovalAction } from "./actions";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ApprovalsPage({ params }: PageProps) {
  const { id: workspaceId } = await params;
  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);
  const ctx = { userId: member.userId, workspaceId, isOperator: false };

  const items = await withRls(ctx, (tx) =>
    tx.workApprovalQueueItem.findMany({
      where: { workspaceId, status: "PENDING" },
      orderBy: { proposedAt: "asc" },
      take: 50,
    }),
  );

  return (
    <div>
      <p className="eyebrow mb-3">Work approvals</p>
      <h1 className="font-display text-3xl text-ink">
        Decisions waiting for you.
      </h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
        Work-execution items only. Threshold defaults send routine items
        through automatically; anything above threshold lands here for
        explicit ratification.
      </p>

      {items.length === 0 ? (
        <p className="mt-8 border border-rule bg-paper p-5 text-[15px] text-slate-soft">
          Nothing in the queue. New items appear when the fleet flags
          something above your threshold.
        </p>
      ) : (
        <ul className="mt-8 divide-y divide-rule border border-rule bg-paper">
          {items.map((item) => (
            <li key={item.id} className="p-5">
              <div className="flex items-baseline justify-between gap-4">
                <div>
                  <p className="font-mono text-[11px] tracking-eyebrow uppercase text-slate-soft">
                    {item.kind} · {item.agentSlug}
                  </p>
                  <p className="mt-1 text-[15px] text-ink">
                    {item.refTable}:{item.refId}
                  </p>
                </div>
                <span className="font-mono text-[11px] uppercase text-slate-soft">
                  {new Date(item.proposedAt).toLocaleString()}
                </span>
              </div>
              <pre className="mt-3 overflow-x-auto bg-paper-deep p-3 font-mono text-[12px] leading-relaxed text-ink">
                {JSON.stringify(item.payload, null, 2)}
              </pre>
              <div className="mt-3 flex gap-3">
                <form action={decideApprovalAction}>
                  <input type="hidden" name="workspaceId" value={workspaceId} />
                  <input type="hidden" name="itemId" value={item.id} />
                  <input type="hidden" name="decision" value="APPROVED" />
                  <button type="submit" className="btn-primary">
                    Approve
                  </button>
                </form>
                <form action={decideApprovalAction}>
                  <input type="hidden" name="workspaceId" value={workspaceId} />
                  <input type="hidden" name="itemId" value={item.id} />
                  <input type="hidden" name="decision" value="REJECTED" />
                  <button type="submit" className="btn-secondary">
                    Reject
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
