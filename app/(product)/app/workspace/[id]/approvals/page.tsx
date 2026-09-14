import { requireWorkspaceMember } from "@/lib/auth";
import { withRls } from "@/lib/db";
import { decryptPayloadForRead } from "@/lib/security/payload-crypto";
import { ApEyebrow, ApRootedEmptyState } from "@/components/ui/ap";
import { asDisciplineId } from "@/lib/disciplines";
import { renderApprovalPayload } from "./renderApprovalPayload";
import { ApprovalsList, type ApprovalRow } from "./ApprovalsList";
import { ACCEPTED_APPROVAL_STATUSES } from "@/lib/approvals/executors";
import { buildApprovalArtifact } from "@/lib/approvals/artifact";
import { readStoredApprovalArtifact } from "@/lib/approvals/stored-artifact";
import {
  ApprovedHandoffSection,
  type ApprovedApprovalRow,
} from "./ApprovedHandoffSection";
import type { WorkApprovalKind } from "@prisma/client";

/** How many accepted items the customer can still reach from this screen.
 *  The queue is the working surface, not an archive, so this is a recent
 *  tail rather than a full history. */
const ACCEPTED_TAKE = 20;

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

  // Two lanes, one screen.
  //
  // PENDING is the deciding lane and is unchanged. The ACCEPTED lane is new,
  // and it exists because approving used to be the act that took the work
  // away: this query was `status: "PENDING"` only, so the card carrying the
  // copy / download / mailto handoff disappeared the moment the row left
  // PENDING, and the artifact ARTIFACT_HANDOFF had frozen to replace it had no
  // reader anywhere in production.
  //
  // The accepted set comes from `ACCEPTED_APPROVAL_STATUSES`, the same
  // constant `isAcceptedStatus` is built from, so AUTO_APPROVED rows are
  // included. A hand-rolled `status: "APPROVED"` here would silently drop
  // every row the confidence threshold accepted -- the specific mistake
  // lib/approvals/executors.ts warns about -- and would look like it worked.
  //
  // Ordered by `proposedAt` rather than `decidedAt`: `decidedAt` is nullable,
  // Postgres sorts NULLS FIRST on DESC, and a row accepted by the machine path
  // need not carry one. Sorting on the non-null column keeps the order
  // deterministic without depending on a nulls-ordering feature flag.
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
      tx.workApprovalQueueItem.findMany({
        where: {
          workspaceId,
          status: { in: [...ACCEPTED_APPROVAL_STATUSES] },
        },
        orderBy: { proposedAt: "desc" },
        take: ACCEPTED_TAKE,
      }),
    ]),
  );

  const rows: ApprovalRow[] = items.map((item) => ({
    id: item.id,
    agentSlug: item.agentSlug,
    kind: item.kind,
    discipline: asDisciplineId(item.discipline),
    proposedAtIso: item.proposedAt.toISOString(),
    rendered: renderApprovalPayload(item.kind, decryptPayloadForRead(item.payload)),
  }));

  const acceptedRows: ApprovedApprovalRow[] = acceptedItems.map((item) => {
    const payload = decryptPayloadForRead(item.payload);
    const rendered = renderApprovalPayload(item.kind, payload);

    // The stored artifact is the customer's record of WHAT THEY APPROVED. It
    // wins, unconditionally.
    const stored = readStoredApprovalArtifact(payload);

    // LEGACY PATH — and deliberately only that.
    //
    // Rows accepted before ARTIFACT_HANDOFF shipped carry no stored artifact,
    // so the only thing left is to rebuild one from the payload. That is a
    // strictly weaker record: the payload is mutable and the renderer changes
    // between releases, so a rebuild says "what this renders to now", not
    // "what you said yes to". It is the fallback and never the preference,
    // and the surface labels it so the customer is not shown a reconstruction
    // and a frozen record as though they were the same thing.
    const artifact =
      stored ?? buildApprovalArtifact(item.kind as WorkApprovalKind, rendered);

    return {
      row: {
        id: item.id,
        agentSlug: item.agentSlug,
        kind: item.kind,
        discipline: asDisciplineId(item.discipline),
        proposedAtIso: item.proposedAt.toISOString(),
        rendered,
      },
      artifact,
      artifactSource: stored ? "stored" : "legacy-rederived",
      decidedAtIso: (item.decidedAt ?? item.proposedAt).toISOString(),
    };
  });

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
          {initialFocusId && acceptedRows.length > 0 ? (
            <p className="mb-6 border border-rule bg-paper-deep px-4 py-3 text-[14px] leading-relaxed text-ink">
              That draft has already cleared your queue. If you approved it,
              it&rsquo;s below with its copy and download still attached.
            </p>
          ) : initialFocusId ? (
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
            initialDiscipline={initialDiscipline}
            initialFocusId={initialFocusId}
          />
        </>
      )}

      {/* Renders in BOTH branches — an empty pending queue is the most likely
          moment for a customer to come looking for something they approved,
          and it was previously the exact moment the screen had nothing to
          give them. Returns null on its own when there is nothing accepted. */}
      <ApprovedHandoffSection rows={acceptedRows} />
    </div>
  );
}
