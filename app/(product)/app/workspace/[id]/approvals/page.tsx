import { requireWorkspaceMember } from "@/lib/auth";
import { withRls } from "@/lib/db";
import { decryptPayloadForRead } from "@/lib/security/payload-crypto";
import { ApEyebrow, ApRootedEmptyState } from "@/components/ui/ap";
import { asDisciplineId } from "@/lib/disciplines";
import { ACCEPTED_APPROVAL_STATUSES } from "@/lib/approvals/accepted-status";
import { readStoredApprovalArtifact } from "@/lib/approvals/stored-artifact";
import { renderApprovalPayload } from "./renderApprovalPayload";
import { ApprovalsList, type ApprovalRow } from "./ApprovalsList";

/**
 * How many recently-accepted items carry their handoff on this page.
 *
 * Bounded on purpose. This section exists so the take-it-with-you controls
 * have somewhere to live now that they are gated on acceptance — not to be a
 * second inbox. The queue itself is still PENDING-only, so counts, discipline
 * chips and batch-approve are untouched by it.
 */
const RECENTLY_ACCEPTED_LIMIT = 20;

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ discipline?: string; focus?: string }>;
}

export const dynamic = "force-dynamic";

export default async function ApprovalsPage({ params, searchParams }: PageProps) {
  const { id: workspaceId } = await params;
  const sp = await searchParams;
  const initialDiscipline = asDisciplineId(sp.discipline ?? null);
  // `?focus=<queueItemId>` is the deep-link the onboarding first-fire watch
  // (and any "open in approvals" CTA) carries. It marks the item the
  // customer was sent here to act on — the magic-moment first draft. The
  // list scrolls to it, highlights it, and shows a one-time coach banner.
  const initialFocusId =
    typeof sp.focus === "string" && sp.focus.length > 0 ? sp.focus : null;

  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);
  const ctx = { userId: member.userId, workspaceId, isOperator: false };

  const [items, totalPending, acceptedItems] = await withRls(ctx, (tx) =>
    Promise.all([
      tx.workApprovalQueueItem.findMany({
        where: { workspaceId, status: "PENDING" },
        orderBy: { proposedAt: "desc" },
        take: 50,
      }),
      tx.workApprovalQueueItem.count({
        where: { workspaceId, status: "PENDING" },
      }),
      // The accepted tail. `ACCEPTED_APPROVAL_STATUSES` is the same tuple
      // `isAcceptedStatus` is built from, so the QUERY and the CARD's gate
      // cannot disagree about what "accepted" means. Ordered by proposedAt
      // rather than decidedAt: decidedAt is nullable (rows born AUTO_APPROVED
      // on the machine path may carry none) and Postgres sorts NULLs FIRST on
      // DESC, which would float undated rows to the top.
      tx.workApprovalQueueItem.findMany({
        where: {
          workspaceId,
          status: { in: [...ACCEPTED_APPROVAL_STATUSES] },
        },
        orderBy: { proposedAt: "desc" },
        take: RECENTLY_ACCEPTED_LIMIT,
      }),
    ]),
  );

  /**
   * One decryption per row, feeding BOTH consumers.
   *
   * `decryptPayloadForRead` was already this page's decrypt path for
   * `renderApprovalPayload`; the stored artifact is lifted off that same
   * plaintext. There is deliberately no second decryption route — the reader
   * takes an already-decrypted payload for exactly this reason. This is
   * strictly fewer decrypt calls than before, not more: the call moved out of
   * the argument list into a local that both consumers share.
   */
  const toRow = (item: (typeof items)[number]): ApprovalRow => {
    const payload = decryptPayloadForRead(item.payload);
    return {
      id: item.id,
      agentSlug: item.agentSlug,
      kind: item.kind,
      discipline: asDisciplineId(item.discipline),
      proposedAtIso: item.proposedAt.toISOString(),
      status: item.status,
      storedArtifact: readStoredApprovalArtifact(payload),
      rendered: renderApprovalPayload(item.kind, payload),
    };
  };

  const rows: ApprovalRow[] = items.map(toRow);
  const acceptedRows: ApprovalRow[] = acceptedItems.map(toRow);

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

      {rows.length === 0 && acceptedRows.length === 0 ? (
        <div className="mt-8">
          {initialFocusId ? (
            <p className="mb-6 border border-rule bg-paper-deep px-4 py-3 text-[14px] leading-relaxed text-ink">
              That draft has already cleared your queue — it was approved or
              sent back, so there&rsquo;s nothing left to decide on it. New
              work lands here as Plaino surfaces it.
            </p>
          ) : null}
          <ApRootedEmptyState
            scene="empty-approvals"
            reality="Nothing waiting on you."
            change="Plaino is sitting ready, fetching from your connected sources and herding work as it surfaces. New decisions land here as they cross your threshold."
          />
        </div>
      ) : (
        <>
          {totalPending > 50 && (
            <p className="mt-6 border border-rule bg-paper-deep px-4 py-3 font-mono text-[12px] tracking-wide text-ink-soft">
              Showing the 50 most recent of {totalPending} pending decisions.
              Approve or reject items to surface the rest.
            </p>
          )}
          <ApprovalsList
            workspaceId={workspaceId}
            rows={rows}
            acceptedRows={acceptedRows}
            initialDiscipline={initialDiscipline}
            initialFocusId={initialFocusId}
          />
        </>
      )}
    </div>
  );
}
