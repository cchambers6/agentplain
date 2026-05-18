import { requireWorkspaceMember } from "@/lib/auth";
import { withRls } from "@/lib/db";
import {
  ApEyebrow,
  ApHeritageButton,
  ApRootedEmptyState,
} from "@/components/ui/ap";
import { renderApprovalPayload } from "./renderApprovalPayload";
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
      <ApEyebrow className="mb-3">work approvals</ApEyebrow>
      <h1 className="font-display text-3xl text-ink">
        Decisions waiting for you.
      </h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
        Routine items send through automatically. Anything above your threshold
        lands here for explicit ratification.
      </p>

      {items.length === 0 ? (
        <div className="mt-8">
          <ApRootedEmptyState
            motif="wheat"
            reality="Nothing in the queue right now."
            change="Your fleet routes new items here as it surfaces them."
          />
        </div>
      ) : (
        <ul className="mt-8 space-y-4">
          {items.map((item) => {
            const rendered = renderApprovalPayload(item.kind, item.payload);
            return (
              <li key={item.id}>
                <article className="bg-paper border border-rule p-6 md:p-8">
                  <header className="flex flex-wrap items-baseline justify-between gap-3">
                    <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
                      {rendered.kindLabel}
                      <span className="mx-2">·</span>
                      {item.agentSlug}
                      <span className="mx-2">·</span>
                      {relativeTime(item.proposedAt)}
                    </p>
                  </header>

                  {rendered.recipientLine ? (
                    <p className="mt-3 font-mono text-[12px] text-ink-soft">
                      {rendered.recipientLine}
                    </p>
                  ) : null}

                  {rendered.title ? (
                    <h2 className="mt-2 font-display text-xl leading-snug text-ink">
                      {rendered.title}
                    </h2>
                  ) : null}

                  <div className="mt-4 border-t border-rule pt-4">
                    {rendered.body.map((paragraph, idx) => (
                      <p
                        key={idx}
                        className="mt-3 max-w-prose text-[15px] leading-relaxed text-ink first:mt-0"
                      >
                        {paragraph}
                      </p>
                    ))}
                  </div>

                  {rendered.metaLine ? (
                    <p className="mt-4 border-t border-rule pt-4 font-mono text-[11px] tracking-eyebrow uppercase text-mute">
                      {rendered.metaLine}
                    </p>
                  ) : null}

                  <footer className="mt-5 flex flex-wrap items-center gap-3 border-t border-rule pt-5">
                    <form action={decideApprovalAction}>
                      <input type="hidden" name="workspaceId" value={workspaceId} />
                      <input type="hidden" name="itemId" value={item.id} />
                      <input type="hidden" name="decision" value="APPROVED" />
                      <ApHeritageButton variant="primary" type="submit">
                        approve
                      </ApHeritageButton>
                    </form>
                    <form action={decideApprovalAction}>
                      <input type="hidden" name="workspaceId" value={workspaceId} />
                      <input type="hidden" name="itemId" value={item.id} />
                      <input type="hidden" name="decision" value="REJECTED" />
                      <button
                        type="submit"
                        className="inline-flex items-center justify-center gap-2 rounded-none px-3 py-2 font-sans text-sm font-medium text-flag underline-offset-4 transition hover:underline"
                      >
                        reject
                      </button>
                    </form>
                  </footer>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function relativeTime(date: Date): string {
  const diffMs = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} d ago`;
  return new Date(date).toLocaleDateString();
}
