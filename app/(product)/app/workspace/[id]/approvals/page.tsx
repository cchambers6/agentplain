import { requireWorkspaceMember } from "@/lib/auth";
import { withRls } from "@/lib/db";
import { decideApprovalAction } from "./actions";

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

  return (
    <div>
      <p className="eyebrow mb-3">Work approvals</p>
      <h1 className="font-display text-3xl text-ink">
        Decisions waiting for you.
      </h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
        Routine items send through automatically. Anything above your
        threshold lands here for explicit ratification — we draft, you
        decide, your existing system sends.
      </p>

      {items.length === 0 ? (
        <p className="mt-8 border border-rule bg-paper p-5 text-[15px] text-mute">
          Nothing in the queue. New items appear when we flag something
          above your threshold.
        </p>
      ) : (
        <ul className="mt-8 space-y-3">
          {items.map((item) => (
            <ApprovalRow
              key={item.id}
              item={item}
              workspaceId={workspaceId}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

interface ApprovalItem {
  id: string;
  kind: string;
  agentSlug: string;
  proposedAt: Date;
  payload: unknown;
  refTable: string;
  refId: string;
}

function ApprovalRow({
  item,
  workspaceId,
}: {
  item: ApprovalItem;
  workspaceId: string;
}) {
  const draft = parseDraftPayload(item.payload);
  const kindLabel = humanKind(item.kind);
  const relativeTime = formatRelativeTime(item.proposedAt);
  return (
    <li className="border border-rule bg-paper">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-rule px-5 py-3">
        <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
          {kindLabel} · {item.agentSlug} · {relativeTime}
        </p>
        {draft?.confidence != null ? (
          <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
            Confidence: {draft.confidence.toFixed(2)}
          </p>
        ) : null}
      </header>

      <div className="px-5 py-4">
        {draft ? (
          <DraftBody draft={draft} />
        ) : (
          <NonDraftSummary item={item} />
        )}
      </div>

      <footer className="flex flex-wrap items-center gap-3 border-t border-rule px-5 py-3">
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
          <button
            type="submit"
            className="text-[13px] text-flag underline-offset-4 hover:underline"
          >
            Reject
          </button>
        </form>
      </footer>
    </li>
  );
}

interface ParsedDraftPayload {
  subject: string | null;
  body: string | null;
  tone: string | null;
  confidence: number | null;
  persisted: boolean | null;
  inboundSummary: string | null;
  categorizationSummary: string | null;
  scheduledSlots: Array<{ day: string; startLocal: string; endLocal: string }>;
}

function parseDraftPayload(payload: unknown): ParsedDraftPayload | null {
  if (!payload || typeof payload !== "object") return null;
  const rec = payload as Record<string, unknown>;
  const subject = typeof rec.subject === "string" ? rec.subject : null;
  const body = typeof rec.body === "string" ? rec.body : null;
  if (!subject && !body) return null;
  const tone = typeof rec.tone === "string" ? rec.tone : null;
  const confidence =
    typeof rec.confidence === "number" && Number.isFinite(rec.confidence)
      ? rec.confidence
      : null;
  const persisted = typeof rec.persisted === "boolean" ? rec.persisted : null;
  const inboundSummary =
    typeof rec.inboundSummary === "string" ? rec.inboundSummary : null;
  const categorizationSummary =
    typeof rec.categorizationSummary === "string"
      ? rec.categorizationSummary
      : null;
  const sched = rec.scheduledProposal;
  const scheduledSlots: ParsedDraftPayload["scheduledSlots"] = [];
  if (sched && typeof sched === "object") {
    const slots = (sched as Record<string, unknown>).proposedSlots;
    if (Array.isArray(slots)) {
      for (const s of slots) {
        if (s && typeof s === "object") {
          const r = s as Record<string, unknown>;
          if (
            typeof r.day === "string" &&
            typeof r.startLocal === "string" &&
            typeof r.endLocal === "string"
          ) {
            scheduledSlots.push({
              day: r.day,
              startLocal: r.startLocal,
              endLocal: r.endLocal,
            });
          }
        }
      }
    }
  }
  return {
    subject,
    body,
    tone,
    confidence,
    persisted,
    inboundSummary,
    categorizationSummary,
    scheduledSlots,
  };
}

function DraftBody({ draft }: { draft: ParsedDraftPayload }) {
  return (
    <div className="space-y-3">
      {draft.inboundSummary ? (
        <p className="border-l-2 border-rule pl-3 text-[13px] leading-relaxed text-mute">
          In reply to: {draft.inboundSummary}
        </p>
      ) : null}
      {draft.subject ? (
        <p className="font-mono text-[12px] tracking-tight text-ink-soft">
          Subject: {draft.subject}
        </p>
      ) : null}
      {draft.body ? (
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink">
          {draft.body}
        </p>
      ) : null}
      {draft.scheduledSlots.length > 0 ? (
        <div className="border-t border-rule pt-3">
          <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
            Proposed slots
          </p>
          <ul className="mt-2 space-y-1 text-[14px] text-ink-soft">
            {draft.scheduledSlots.map((s, i) => (
              <li key={`${s.day}-${i}`}>
                {capitalize(s.day)} {s.startLocal}–{s.endLocal}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {draft.persisted === false ? (
        <p className="border border-rule bg-paper-deep px-3 py-2 text-[12px] leading-relaxed text-mute">
          Held for review — confidence below the persist threshold, so we
          did not write to your Gmail Drafts. Approve to send it through.
        </p>
      ) : draft.persisted === true ? (
        <p className="text-[12px] leading-relaxed text-mute">
          Saved to your Gmail Drafts. Approve here to confirm it ships
          on your side; reject to discard the draft.
        </p>
      ) : null}
    </div>
  );
}

function NonDraftSummary({ item }: { item: ApprovalItem }) {
  return (
    <div className="space-y-2">
      <p className="text-[14px] text-ink">
        {humanKind(item.kind)} flagged for review. Reference:{" "}
        <span className="font-mono text-[12px] text-mute">
          {item.refTable}:{item.refId}
        </span>
      </p>
      <p className="text-[12px] text-mute">
        Open the item from the referencing surface for the full context.
      </p>
    </div>
  );
}

function humanKind(kind: string): string {
  switch (kind) {
    case "BUYER_INQUIRY_REPLY_DRAFT":
      return "Draft reply";
    case "COMPLIANCE_FLAG":
      return "Compliance flag";
    case "LISTING_RECOMMENDATION":
      return "Listing recommendation";
    case "PRICING_RECOMMENDATION":
      return "Pricing recommendation";
    default:
      return kind.replace(/_/g, " ").toLowerCase();
  }
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}

function formatRelativeTime(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const diffMs = Date.now() - date.getTime();
  const mins = Math.round(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days} d ago`;
  return date.toLocaleDateString();
}
