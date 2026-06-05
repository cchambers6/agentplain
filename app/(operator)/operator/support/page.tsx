// /operator/support — support reply review + triage surface.
//
// Two surfaces, top to bottom:
//
//   1. "Drafts awaiting review" — the fleet's support-handler skill drafts
//      a first-touch reply into the approval queue (kind=
//      SUPPORT_HANDLER_REPLY_DRAFT) whenever a customer submits from
//      /app/workspace/[id]/help. Each pending draft renders in full:
//      the customer's question, the drafted reply (editable inline), the
//      cited knowledge chunks, the workspace context, and a confidence
//      badge. The operator edits if needed, then "Approve and send"
//      (reply goes out via Resend, request closes RESOLVED) or "Reject"
//      (draft archived, request returns to OPEN). The customer NEVER
//      gets an auto-sent reply — the operator's approval is the only
//      thing that fires the send. See lib/support/resolve-reply.ts +
//      project_no_outbound_architecture.md.
//
//   2. "All support requests" — the durable request log with status
//      triage (NEW → IN_REVIEW → OPEN → RESOLVED / ARCHIVED) for requests
//      with no fleet draft (e.g. the skill emitted a placeholder, or the
//      draft was rejected and now needs manual handling).
//
// Oldest-first on the drafts queue: the customer who has waited longest
// is reviewed first.

import Link from "next/link";
import type { SupportRequestStatus } from "@prisma/client";
import { requireUser } from "@/lib/auth/server";
import { withSystemContext } from "@/lib/db/rls";
import { decryptPayloadForRead } from "@/lib/security/payload-crypto";
import {
  approveAndSendSupportReplyAction,
  archiveSupportRequestAction,
  markSupportOpenAction,
  markSupportResolvedAction,
  rejectSupportReplyAction,
  reopenSupportAction,
} from "./actions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SUPPORT_REPLY_KIND = "SUPPORT_HANDLER_REPLY_DRAFT";

const STATUS_FILTER_OPTIONS = [
  { value: "active", label: "Active (new + in-review + open)" },
  { value: "new", label: "New only" },
  { value: "resolved", label: "Resolved" },
  { value: "archived", label: "Archived" },
  { value: "all", label: "All" },
] as const;

const STATUS_LABEL: Record<SupportRequestStatus, string> = {
  NEW: "New",
  IN_REVIEW: "In review",
  OPEN: "Open",
  RESOLVED: "Resolved",
  ARCHIVED: "Archived",
};

const STATUS_TONE: Record<SupportRequestStatus, string> = {
  NEW: "border-clay bg-paper text-ink",
  IN_REVIEW: "border-ink bg-paper-deep text-ink",
  OPEN: "border-ink bg-paper-deep text-ink",
  RESOLVED: "border-rule bg-paper text-mute",
  ARCHIVED: "border-rule bg-paper text-mute",
};

const CONFIDENCE_TONE: Record<string, string> = {
  high: "border-ink bg-ink text-paper",
  medium: "border-ink bg-paper-deep text-ink",
  low: "border-clay bg-paper text-ink",
  placeholder: "border-clay bg-paper text-clay",
};

interface PageProps {
  searchParams: Promise<{ status?: string | string[]; msg?: string | string[] }>;
}

interface SupportCitation {
  title: string;
  bodyExcerpt: string;
  sourceUrl: string | null;
  similarity: number | null;
}

interface DraftCard {
  queueItemId: string;
  proposedAt: Date;
  workspaceName: string;
  workspaceVertical: string | null;
  customerEmail: string | null;
  requestSubject: string;
  requestBody: string;
  requestCreatedAt: Date;
  draftSubject: string;
  draftBody: string;
  confidence: string | null;
  suggestedAction: string | null;
  reasoning: string | null;
  citations: SupportCitation[];
}

function pickFirst(v: string | string[] | undefined): string | undefined {
  if (!v) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

function resolveStatusFilter(
  raw: string | undefined,
): "active" | "new" | "resolved" | "archived" | "all" {
  if (
    raw === "new" ||
    raw === "resolved" ||
    raw === "archived" ||
    raw === "all"
  ) {
    return raw;
  }
  return "active";
}

function statusFilterToList(
  filter: "active" | "new" | "resolved" | "archived" | "all",
): SupportRequestStatus[] | null {
  switch (filter) {
    case "new":
      return ["NEW"];
    case "resolved":
      return ["RESOLVED"];
    case "archived":
      return ["ARCHIVED"];
    case "active":
      return ["NEW", "IN_REVIEW", "OPEN"];
    case "all":
      return null;
  }
}

const formatDateTime = (date: Date): string =>
  date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

function decodeDraftPayload(raw: unknown): {
  subject: string | null;
  body: string;
  confidence: string | null;
  suggestedAction: string | null;
  reasoning: string | null;
  citations: SupportCitation[];
} {
  const decrypted = decryptPayloadForRead(raw);
  if (!decrypted || typeof decrypted !== "object") {
    return {
      subject: null,
      body: "",
      confidence: null,
      suggestedAction: null,
      reasoning: null,
      citations: [],
    };
  }
  const p = decrypted as Record<string, unknown>;
  const citationsRaw = Array.isArray(p.citations) ? p.citations : [];
  const citations: SupportCitation[] = [];
  for (const c of citationsRaw) {
    if (!c || typeof c !== "object") continue;
    const r = c as Record<string, unknown>;
    const title = typeof r.title === "string" ? r.title : null;
    if (!title) continue;
    citations.push({
      title,
      bodyExcerpt: typeof r.bodyExcerpt === "string" ? r.bodyExcerpt : "",
      sourceUrl: typeof r.sourceUrl === "string" ? r.sourceUrl : null,
      similarity:
        typeof r.similarity === "number" && Number.isFinite(r.similarity)
          ? r.similarity
          : null,
    });
  }
  return {
    subject: typeof p.subject === "string" ? p.subject : null,
    body: typeof p.body === "string" ? p.body : "",
    confidence: typeof p.confidence === "string" ? p.confidence : null,
    suggestedAction:
      typeof p.suggestedAction === "string" ? p.suggestedAction : null,
    reasoning: typeof p.reasoning === "string" ? p.reasoning : null,
    citations,
  };
}

async function loadDraftCards(): Promise<DraftCard[]> {
  const items = await withSystemContext((tx) =>
    tx.workApprovalQueueItem.findMany({
      where: { kind: SUPPORT_REPLY_KIND, status: "PENDING" },
      orderBy: { proposedAt: "asc" },
      take: 100,
      select: {
        id: true,
        refId: true,
        proposedAt: true,
        payload: true,
        workspace: { select: { name: true, vertical: true } },
      },
    }),
  );
  if (items.length === 0) return [];

  const requestIds = Array.from(new Set(items.map((i) => i.refId)));
  const requests = await withSystemContext((tx) =>
    tx.supportRequest.findMany({
      where: { id: { in: requestIds } },
      select: {
        id: true,
        subject: true,
        body: true,
        createdAt: true,
        fromUser: { select: { email: true } },
      },
    }),
  );
  const byId = new Map(requests.map((r) => [r.id, r]));

  const cards: DraftCard[] = [];
  for (const item of items) {
    const req = byId.get(item.refId);
    if (!req) continue; // request deleted between draft + review
    const decoded = decodeDraftPayload(item.payload);
    cards.push({
      queueItemId: item.id,
      proposedAt: item.proposedAt,
      workspaceName: item.workspace?.name ?? "your workspace",
      workspaceVertical: item.workspace?.vertical ?? null,
      customerEmail: req.fromUser?.email ?? null,
      requestSubject: req.subject,
      requestBody: req.body,
      requestCreatedAt: req.createdAt,
      draftSubject: decoded.subject ?? `Re: ${req.subject}`,
      draftBody: decoded.body,
      confidence: decoded.confidence,
      suggestedAction: decoded.suggestedAction,
      reasoning: decoded.reasoning,
      citations: decoded.citations,
    });
  }
  return cards;
}

export default async function OperatorSupportPage({ searchParams }: PageProps) {
  const session = await requireUser();
  if (!session.isOperator) {
    return <div className="container-wide py-12">Forbidden.</div>;
  }
  const params = await searchParams;
  const statusFilter = resolveStatusFilter(pickFirst(params.status));
  const statusList = statusFilterToList(statusFilter);
  const notice = pickFirst(params.msg);

  const [drafts, rows, counts] = await Promise.all([
    loadDraftCards(),
    withSystemContext((tx) =>
      tx.supportRequest.findMany({
        where: statusList ? { status: { in: statusList } } : {},
        orderBy: { createdAt: "desc" },
        take: 100,
        include: {
          workspace: { select: { name: true, slug: true } },
          fromUser: { select: { email: true } },
        },
      }),
    ),
    withSystemContext((tx) =>
      tx.supportRequest.groupBy({ by: ["status"], _count: { _all: true } }),
    ),
  ]);

  const countByStatus: Partial<Record<SupportRequestStatus, number>> = {};
  for (const row of counts) countByStatus[row.status] = row._count._all;

  return (
    <div className="container-wide space-y-10 py-12">
      <header>
        <h1 className="font-display text-2xl text-ink">Operator · Support</h1>
        <p className="mt-2 max-w-3xl text-sm text-mute">
          The fleet drafts a first-touch reply for every customer message
          from <code className="font-mono text-xs">/help</code> and queues it
          here. You review, edit if needed, and approve to send — the customer
          never gets an auto-sent reply. Approving sends via email and closes
          the request; rejecting archives the draft and reopens it for manual
          handling.
        </p>
      </header>

      {notice ? (
        <p className="border border-ink bg-paper-deep px-4 py-2 text-sm text-ink">
          {notice}
        </p>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-5">
        <SummaryCell label="New" value={countByStatus.NEW ?? 0} />
        <SummaryCell label="In review" value={countByStatus.IN_REVIEW ?? 0} />
        <SummaryCell label="Open" value={countByStatus.OPEN ?? 0} />
        <SummaryCell label="Resolved" value={countByStatus.RESOLVED ?? 0} />
        <SummaryCell label="Archived" value={countByStatus.ARCHIVED ?? 0} />
      </section>

      {/* ── Drafts awaiting review ───────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-xl text-ink">
            Drafts awaiting review
          </h2>
          <span className="font-mono text-[11px] uppercase tracking-eyebrow text-mute">
            {drafts.length} pending · oldest first
          </span>
        </div>

        {drafts.length === 0 ? (
          <p className="border border-rule bg-paper p-6 text-sm text-mute">
            No drafts awaiting review. New customer messages will be drafted
            here within seconds of submission.
          </p>
        ) : (
          <ul className="space-y-6">
            {drafts.map((d) => (
              <DraftReviewCard key={d.queueItemId} draft={d} />
            ))}
          </ul>
        )}
      </section>

      {/* ── All support requests (triage) ───────────────────────────── */}
      <section className="space-y-4">
        <h2 className="font-display text-xl text-ink">All support requests</h2>

        <form
          method="GET"
          className="flex flex-wrap items-end gap-4 border border-rule bg-paper p-4"
        >
          <label className="flex flex-col gap-1 text-[13px]">
            <span className="font-mono uppercase tracking-eyebrow text-[11px] text-mute">
              Status
            </span>
            <select
              name="status"
              defaultValue={statusFilter}
              className="border border-rule bg-paper px-3 py-2 text-[14px] text-ink"
            >
              {STATUS_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="border border-ink bg-ink px-4 py-2 text-[13px] font-mono uppercase tracking-eyebrow text-paper"
          >
            Filter
          </button>
          {statusFilter !== "active" && (
            <Link
              href="/operator/support"
              className="font-mono text-xs underline text-mute"
            >
              Reset
            </Link>
          )}
        </form>

        {rows.length === 0 ? (
          <p className="border border-rule bg-paper p-6 text-sm text-mute">
            No support requests match this filter.
          </p>
        ) : (
          <ul className="space-y-6">
            {rows.map((req) => {
              const isResolved = req.status === "RESOLVED";
              const isArchived = req.status === "ARCHIVED";
              return (
                <li key={req.id} className="border border-rule bg-paper p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex border px-2 py-0.5 font-mono text-[11px] tracking-eyebrow uppercase ${STATUS_TONE[req.status]}`}
                        >
                          {STATUS_LABEL[req.status]}
                        </span>
                        <span className="font-mono text-[11px] text-mute">
                          {formatDateTime(req.createdAt)}
                        </span>
                      </div>
                      <h3 className="mt-3 font-display text-lg text-ink">
                        {req.subject}
                      </h3>
                      <p className="mt-1 text-[13px] text-mute">
                        {req.workspace.name}
                        {req.fromUser ? (
                          <>
                            {" · "}
                            <a
                              href={`mailto:${req.fromUser.email}`}
                              className="underline"
                            >
                              {req.fromUser.email}
                            </a>
                          </>
                        ) : null}
                      </p>
                    </div>
                    <div className="text-right text-[11px] font-mono text-mute">
                      <div>id {req.id.slice(0, 8)}…</div>
                      {req.emailMessageId === null ? (
                        <div className="mt-1 text-flag">
                          notify email send failed
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <pre className="mt-4 whitespace-pre-wrap border-l-2 border-rule bg-paper-deep p-3 font-sans text-[14px] leading-relaxed text-ink">
                    {req.body}
                  </pre>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {!isResolved && !isArchived ? (
                      <>
                        {req.status === "NEW" ? (
                          <ActionButton
                            actionFn={markSupportOpenAction.bind(null, req.id)}
                            label="Mark open"
                            tone="primary"
                          />
                        ) : null}
                        <ActionButton
                          actionFn={markSupportResolvedAction.bind(
                            null,
                            req.id,
                          )}
                          label="Mark resolved"
                          tone="default"
                        />
                        <ActionButton
                          actionFn={archiveSupportRequestAction.bind(
                            null,
                            req.id,
                          )}
                          label="Archive"
                          tone="default"
                        />
                      </>
                    ) : (
                      <ActionButton
                        actionFn={reopenSupportAction.bind(null, req.id)}
                        label="Reopen"
                        tone="default"
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function DraftReviewCard({ draft }: { draft: DraftCard }) {
  const approveFn = approveAndSendSupportReplyAction.bind(
    null,
    draft.queueItemId,
  );
  const rejectFn = rejectSupportReplyAction.bind(null, draft.queueItemId);
  const confidenceKey = (draft.confidence ?? "").toLowerCase();
  const confidenceTone =
    CONFIDENCE_TONE[confidenceKey] ?? "border-rule bg-paper text-mute";

  return (
    <li className="border border-ink bg-paper p-6">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex border px-2 py-0.5 font-mono text-[11px] tracking-eyebrow uppercase ${confidenceTone}`}
        >
          confidence: {draft.confidence ?? "unknown"}
        </span>
        <span className="inline-flex border border-rule bg-paper px-2 py-0.5 font-mono text-[11px] tracking-eyebrow uppercase text-mute">
          {draft.citations.length} citation
          {draft.citations.length === 1 ? "" : "s"}
        </span>
        {draft.suggestedAction ? (
          <span className="inline-flex border border-rule bg-paper px-2 py-0.5 font-mono text-[11px] tracking-eyebrow uppercase text-mute">
            suggested: {draft.suggestedAction}
          </span>
        ) : null}
        <span className="font-mono text-[11px] text-mute">
          waiting since {formatDateTime(draft.proposedAt)}
        </span>
      </div>

      {/* Workspace context */}
      <p className="mt-3 text-[13px] text-mute">
        {draft.workspaceName}
        {draft.workspaceVertical ? ` · ${draft.workspaceVertical}` : ""}
        {" · "}
        {draft.customerEmail ? (
          <a href={`mailto:${draft.customerEmail}`} className="underline">
            {draft.customerEmail}
          </a>
        ) : (
          <span className="text-flag">no recipient on file</span>
        )}
      </p>

      {/* The customer's question */}
      <div className="mt-4">
        <p className="font-mono text-[11px] uppercase tracking-eyebrow text-mute">
          Customer asked · {formatDateTime(draft.requestCreatedAt)}
        </p>
        <h3 className="mt-1 font-display text-lg text-ink">
          {draft.requestSubject}
        </h3>
        <pre className="mt-2 whitespace-pre-wrap border-l-2 border-rule bg-paper-deep p-3 font-sans text-[14px] leading-relaxed text-ink">
          {draft.requestBody}
        </pre>
      </div>

      {/* The drafted reply — editable */}
      <form action={approveFn} className="mt-5">
        <p className="font-mono text-[11px] uppercase tracking-eyebrow text-mute">
          Drafted reply · {draft.draftSubject}
        </p>
        <textarea
          name="body"
          defaultValue={draft.draftBody}
          rows={Math.min(18, Math.max(8, draft.draftBody.split("\n").length + 2))}
          className="mt-2 w-full border border-rule bg-paper p-3 font-sans text-[14px] leading-relaxed text-ink"
        />
        {draft.reasoning ? (
          <p className="mt-2 text-[12px] italic text-mute">
            Why this draft: {draft.reasoning}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={!draft.customerEmail}
          className="mt-3 border border-ink bg-ink px-4 py-2 font-mono text-[12px] uppercase tracking-eyebrow text-paper hover:bg-ink-soft disabled:cursor-not-allowed disabled:opacity-40"
        >
          Approve and send
        </button>
      </form>

      {/* Cited knowledge chunks — operator verifies grounding before approving */}
      {draft.citations.length > 0 ? (
        <div className="mt-5">
          <p className="font-mono text-[11px] uppercase tracking-eyebrow text-mute">
            Cited knowledge ({draft.citations.length})
          </p>
          <ul className="mt-2 space-y-3">
            {draft.citations.map((c, i) => (
              <li
                key={`${draft.queueItemId}-cite-${i}`}
                className="border border-rule bg-paper-deep p-3"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-mono text-[12px] text-ink">
                    {c.sourceUrl ? (
                      <a
                        href={c.sourceUrl}
                        className="underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {c.title}
                      </a>
                    ) : (
                      c.title
                    )}
                  </span>
                  {c.similarity !== null ? (
                    <span className="font-mono text-[11px] text-mute">
                      similarity {c.similarity.toFixed(2)}
                    </span>
                  ) : null}
                </div>
                {c.bodyExcerpt ? (
                  <p className="mt-1 text-[13px] leading-relaxed text-mute">
                    {c.bodyExcerpt}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-5 border border-clay bg-paper p-3 text-[13px] text-clay">
          No knowledge was cited — this is a holding reply. Verify the answer
          by hand before sending, or reject and handle manually.
        </p>
      )}

      {/* Reject — archive the draft without sending */}
      <form action={rejectFn} className="mt-5 flex flex-wrap items-end gap-3">
        <label className="flex flex-1 flex-col gap-1 text-[13px]">
          <span className="font-mono uppercase tracking-eyebrow text-[11px] text-mute">
            Reject reason (optional)
          </span>
          <input
            type="text"
            name="reason"
            placeholder="e.g. needs a human — billing dispute"
            className="border border-rule bg-paper px-3 py-2 text-[14px] text-ink"
          />
        </label>
        <button
          type="submit"
          className="border border-rule bg-paper px-4 py-2 font-mono text-[12px] uppercase tracking-eyebrow text-ink hover:bg-paper-deep"
        >
          Reject
        </button>
      </form>
    </li>
  );
}

function SummaryCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-rule bg-paper p-3">
      <p className="font-mono text-[11px] uppercase tracking-eyebrow text-mute">
        {label}
      </p>
      <p className="mt-1 font-display text-2xl text-ink">{value}</p>
    </div>
  );
}

function ActionButton({
  actionFn,
  label,
  tone,
}: {
  actionFn: () => Promise<void>;
  label: string;
  tone: "primary" | "default";
}) {
  const className =
    tone === "primary"
      ? "border border-ink bg-ink px-3 py-1.5 font-mono text-[12px] uppercase tracking-eyebrow text-paper hover:bg-ink-soft"
      : "border border-rule bg-paper px-3 py-1.5 font-mono text-[12px] uppercase tracking-eyebrow text-ink hover:bg-paper-deep";
  return (
    <form action={actionFn}>
      <button type="submit" className={className}>
        {label}
      </button>
    </form>
  );
}
