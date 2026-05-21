// /operator/support — triage surface for in-app support messages.
//
// Scaffold companion to lib/support (feat/support-routing). Customers submit
// from /app/workspace/[id]/help; each submission persists a SupportRequest
// row + emails the support inbox. This page is the durable queue so a
// customer's question doesn't live only in an inbox. Status actions flip
// NEW → OPEN → RESOLVED and record an audit row. Real ticketing is later.

import Link from "next/link";
import type { SupportRequestStatus } from "@prisma/client";
import { requireUser } from "@/lib/auth/server";
import { withSystemContext } from "@/lib/db/rls";
import {
  markSupportOpenAction,
  markSupportResolvedAction,
  reopenSupportAction,
} from "./actions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STATUS_FILTER_OPTIONS = [
  { value: "open", label: "Open (new + open)" },
  { value: "new", label: "New only" },
  { value: "resolved", label: "Resolved" },
  { value: "all", label: "All" },
] as const;

const STATUS_LABEL: Record<SupportRequestStatus, string> = {
  NEW: "New",
  OPEN: "Open",
  RESOLVED: "Resolved",
};

const STATUS_TONE: Record<SupportRequestStatus, string> = {
  NEW: "border-clay bg-paper text-ink",
  OPEN: "border-ink bg-paper-deep text-ink",
  RESOLVED: "border-rule bg-paper text-mute",
};

interface PageProps {
  searchParams: Promise<{ status?: string | string[] }>;
}

function pickFirst(v: string | string[] | undefined): string | undefined {
  if (!v) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

function resolveStatusFilter(
  raw: string | undefined,
): "open" | "new" | "resolved" | "all" {
  if (raw === "new" || raw === "resolved" || raw === "all") return raw;
  return "open";
}

function statusFilterToList(
  filter: "open" | "new" | "resolved" | "all",
): SupportRequestStatus[] | null {
  switch (filter) {
    case "new":
      return ["NEW"];
    case "resolved":
      return ["RESOLVED"];
    case "open":
      return ["NEW", "OPEN"];
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

export default async function OperatorSupportPage({ searchParams }: PageProps) {
  const session = await requireUser();
  if (!session.isOperator) {
    return <div className="container-wide py-12">Forbidden.</div>;
  }
  const params = await searchParams;
  const statusFilter = resolveStatusFilter(pickFirst(params.status));
  const statusList = statusFilterToList(statusFilter);

  const [rows, counts] = await Promise.all([
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
          In-app support messages from{" "}
          <code className="font-mono text-xs">/app/workspace/[id]/help</code>.
          Each row also emailed the support inbox. Status changes record an
          audit row. Real ticketing comes later — this is the durable queue so
          a customer&rsquo;s question is never only in an inbox.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <SummaryCell label="New" value={countByStatus.NEW ?? 0} />
        <SummaryCell label="Open" value={countByStatus.OPEN ?? 0} />
        <SummaryCell label="Resolved" value={countByStatus.RESOLVED ?? 0} />
      </section>

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
        {statusFilter !== "open" && (
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
                    <h2 className="mt-3 font-display text-xl text-ink">
                      {req.subject}
                    </h2>
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
                      <div className="mt-1 text-flag">email send failed</div>
                    ) : null}
                  </div>
                </div>

                <pre className="mt-4 whitespace-pre-wrap border-l-2 border-rule bg-paper-deep p-3 font-sans text-[14px] leading-relaxed text-ink">
                  {req.body}
                </pre>

                <div className="mt-5 flex flex-wrap gap-2">
                  {!isResolved ? (
                    <>
                      {req.status === "NEW" ? (
                        <ActionButton
                          actionFn={markSupportOpenAction.bind(null, req.id)}
                          label="Mark open"
                          tone="primary"
                        />
                      ) : null}
                      <ActionButton
                        actionFn={markSupportResolvedAction.bind(null, req.id)}
                        label="Mark resolved"
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
    </div>
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
