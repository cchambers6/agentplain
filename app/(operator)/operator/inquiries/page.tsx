// /operator/inquiries — triage surface for /custom contact-form submissions.
//
// Unifies the Custom-skill-build path AND the Max-tier quote path through
// one queue (per feat/max-quote-intake decision A — see
// docs/pricing-page-handoff-2026-05-15.md). Operator filters by inquiry
// type + status, reads the row, picks the routing decision via the
// quick-action form, and types triage notes. Downstream provisioning
// (workspace creation, Max invoice, Custom SOW) happens out of band.
//
// Per `project_no_outbound_architecture.md`: no emails, no auto-reply,
// nothing leaves agentplain from triage. The actions only flip status and
// record AuditLog rows.

import Link from "next/link";
import type { InquiryStatus, InquiryType } from "@prisma/client";
import { requireUser } from "@/lib/auth/server";
import { withSystemContext } from "@/lib/db/rls";
import {
  declineInquiryAction,
  markInquiryConvertedAction,
  reopenInquiryAction,
  triageInquiryBothAction,
  triageInquiryCustomAction,
  triageInquiryMaxAction,
  updateInquiryNotesAction,
} from "./actions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TYPE_FILTER_OPTIONS = [
  { value: "all", label: "All types" },
  { value: "CUSTOM_SKILL_BUILD", label: "Custom skill build" },
  { value: "MAX_SERVICE_ENGAGEMENT", label: "Max-tier" },
  { value: "NOT_SURE", label: "Not sure / both" },
] as const;

const STATUS_FILTER_OPTIONS = [
  { value: "open", label: "Open (NEW + triaged, not closed)" },
  { value: "new", label: "New only" },
  { value: "triaged", label: "Triaged" },
  { value: "closed", label: "Closed (declined + converted)" },
  { value: "all", label: "All statuses" },
] as const;

const TYPE_LABEL: Record<InquiryType, string> = {
  CUSTOM_SKILL_BUILD: "Custom skill build",
  MAX_SERVICE_ENGAGEMENT: "Max-tier",
  NOT_SURE: "Not sure / both",
};

const STATUS_LABEL: Record<InquiryStatus, string> = {
  NEW: "New",
  TRIAGED_CUSTOM: "Triaged · Custom",
  TRIAGED_MAX: "Triaged · Max",
  TRIAGED_BOTH: "Triaged · Both",
  DECLINED: "Declined",
  CONVERTED: "Converted",
};

const STATUS_TONE: Record<InquiryStatus, string> = {
  NEW: "border-clay bg-paper text-ink",
  TRIAGED_CUSTOM: "border-rule bg-paper-deep text-ink",
  TRIAGED_MAX: "border-ink bg-paper-deep text-ink",
  TRIAGED_BOTH: "border-rule bg-paper-deep text-ink",
  DECLINED: "border-rule bg-paper text-mute",
  CONVERTED: "border-rule bg-paper text-ink-soft",
};

interface PageProps {
  searchParams: Promise<{
    type?: string | string[];
    status?: string | string[];
  }>;
}

function pickFirst(v: string | string[] | undefined): string | undefined {
  if (!v) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

function resolveTypeFilter(raw: string | undefined): InquiryType | "all" {
  if (
    raw === "CUSTOM_SKILL_BUILD" ||
    raw === "MAX_SERVICE_ENGAGEMENT" ||
    raw === "NOT_SURE"
  ) {
    return raw;
  }
  return "all";
}

function resolveStatusFilter(
  raw: string | undefined,
): "open" | "new" | "triaged" | "closed" | "all" {
  if (
    raw === "new" ||
    raw === "triaged" ||
    raw === "closed" ||
    raw === "all"
  ) {
    return raw;
  }
  return "open";
}

function statusFilterToEnumList(
  filter: "open" | "new" | "triaged" | "closed" | "all",
): InquiryStatus[] | null {
  switch (filter) {
    case "new":
      return ["NEW"];
    case "triaged":
      return ["TRIAGED_CUSTOM", "TRIAGED_MAX", "TRIAGED_BOTH"];
    case "closed":
      return ["DECLINED", "CONVERTED"];
    case "open":
      return ["NEW", "TRIAGED_CUSTOM", "TRIAGED_MAX", "TRIAGED_BOTH"];
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

export default async function OperatorInquiriesPage({ searchParams }: PageProps) {
  const session = await requireUser();
  if (!session.isOperator) {
    return <div className="container-wide py-12">Forbidden.</div>;
  }
  const params = await searchParams;
  const typeFilter = resolveTypeFilter(pickFirst(params.type));
  const statusFilter = resolveStatusFilter(pickFirst(params.status));
  const statusList = statusFilterToEnumList(statusFilter);

  const [rows, counts] = await Promise.all([
    withSystemContext((tx) =>
      tx.inquiry.findMany({
        where: {
          ...(typeFilter !== "all" ? { inquiryType: typeFilter } : {}),
          ...(statusList ? { status: { in: statusList } } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 100,
        include: {
          triagedBy: { select: { email: true } },
        },
      }),
    ),
    withSystemContext((tx) =>
      tx.inquiry.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
    ),
  ]);

  const countByStatus: Partial<Record<InquiryStatus, number>> = {};
  for (const row of counts) {
    countByStatus[row.status] = row._count._all;
  }

  return (
    <div className="container-wide space-y-10 py-12">
      <header>
        <h1 className="font-display text-2xl text-ink">Operator · Inquiries</h1>
        <p className="mt-2 max-w-3xl text-sm text-mute">
          Submissions from{" "}
          <code className="font-mono text-xs">agentplain.com/custom</code>.
          Unified queue covering Custom-skill-build inquiries AND Max-tier
          quote inquiries (per{" "}
          <code className="font-mono text-xs">project_stripe_both_surfaces.md</code>
          ). Triage flips status + records an audit row; provisioning
          happens out-of-band once the quote/SOW is signed.
        </p>
      </header>

      {/* Status summary */}
      <section className="grid gap-3 md:grid-cols-4 lg:grid-cols-6">
        <SummaryCell label="New" value={countByStatus.NEW ?? 0} />
        <SummaryCell
          label="Custom"
          value={countByStatus.TRIAGED_CUSTOM ?? 0}
        />
        <SummaryCell label="Max" value={countByStatus.TRIAGED_MAX ?? 0} />
        <SummaryCell label="Both" value={countByStatus.TRIAGED_BOTH ?? 0} />
        <SummaryCell
          label="Converted"
          value={countByStatus.CONVERTED ?? 0}
        />
        <SummaryCell
          label="Declined"
          value={countByStatus.DECLINED ?? 0}
        />
      </section>

      {/* Filters */}
      <form
        method="GET"
        className="flex flex-wrap items-end gap-4 border border-rule bg-paper p-4"
      >
        <label className="flex flex-col gap-1 text-[13px]">
          <span className="font-mono uppercase tracking-eyebrow text-[11px] text-mute">
            Type
          </span>
          <select
            name="type"
            defaultValue={typeFilter === "all" ? "all" : typeFilter}
            className="border border-rule bg-paper px-3 py-2 text-[14px] text-ink"
          >
            {TYPE_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
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
        {(typeFilter !== "all" || statusFilter !== "open") && (
          <Link
            href="/operator/inquiries"
            className="font-mono text-xs underline text-mute"
          >
            Reset
          </Link>
        )}
      </form>

      {/* Inquiry list */}
      {rows.length === 0 ? (
        <p className="border border-rule bg-paper p-6 text-sm text-mute">
          No inquiries match these filters.
        </p>
      ) : (
        <ul className="space-y-6">
          {rows.map((inq) => {
            const isClosed =
              inq.status === "DECLINED" || inq.status === "CONVERTED";
            return (
              <li
                key={inq.id}
                className="border border-rule bg-paper p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex border px-2 py-0.5 font-mono text-[11px] tracking-eyebrow uppercase ${STATUS_TONE[inq.status]}`}
                      >
                        {STATUS_LABEL[inq.status]}
                      </span>
                      <span className="inline-flex border border-rule bg-paper-deep px-2 py-0.5 font-mono text-[11px] tracking-eyebrow uppercase text-ink-soft">
                        {TYPE_LABEL[inq.inquiryType]}
                      </span>
                      <span className="font-mono text-[11px] text-mute">
                        {formatDateTime(inq.createdAt)}
                      </span>
                    </div>
                    <h2 className="mt-3 font-display text-xl text-ink">
                      {inq.business}{" "}
                      <span className="text-ink-soft">·</span>{" "}
                      <span className="text-ink-soft">{inq.vertical}</span>
                    </h2>
                    <p className="mt-1 text-[13px] text-mute">
                      {inq.name} ·{" "}
                      <a
                        href={`mailto:${inq.email}`}
                        className="underline"
                      >
                        {inq.email}
                      </a>{" "}
                      · {inq.seats}
                    </p>
                  </div>
                  <div className="text-right text-[11px] font-mono text-mute">
                    <div>id {inq.id.slice(0, 8)}…</div>
                    {inq.triagedAt && inq.triagedBy ? (
                      <div className="mt-1">
                        triaged {formatDateTime(inq.triagedAt)}
                        <br />
                        by {inq.triagedBy.email}
                      </div>
                    ) : inq.emailMessageId === null ? (
                      <div className="mt-1 text-flag">email send failed</div>
                    ) : null}
                  </div>
                </div>

                <div className="mt-5 grid gap-5 lg:grid-cols-2">
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-eyebrow text-mute">
                      What they need
                    </p>
                    <pre className="mt-2 whitespace-pre-wrap border-l-2 border-rule bg-paper-deep p-3 font-sans text-[14px] leading-relaxed text-ink">
                      {inq.needs}
                    </pre>
                  </div>
                  {inq.serviceIntensityNotes ? (
                    <div>
                      <p className="font-mono text-[11px] uppercase tracking-eyebrow text-mute">
                        Service intensity
                      </p>
                      <pre className="mt-2 whitespace-pre-wrap border-l-2 border-clay bg-paper-deep p-3 font-sans text-[14px] leading-relaxed text-ink">
                        {inq.serviceIntensityNotes}
                      </pre>
                    </div>
                  ) : null}
                </div>

                {/* Triage notes */}
                <form
                  action={updateInquiryNotesAction.bind(null, inq.id)}
                  className="mt-5"
                >
                  <label
                    htmlFor={`notes-${inq.id}`}
                    className="font-mono text-[11px] uppercase tracking-eyebrow text-mute"
                  >
                    Triage notes (internal)
                  </label>
                  <textarea
                    id={`notes-${inq.id}`}
                    name="notes"
                    defaultValue={inq.triageNotes ?? ""}
                    rows={3}
                    placeholder="Call scheduled Thursday. Reads like a Max engagement (multi-state)."
                    className="mt-2 w-full border border-rule bg-paper px-3 py-2 text-[14px] text-ink focus:border-ink focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="mt-2 border border-rule bg-paper px-3 py-1.5 font-mono text-[12px] uppercase tracking-eyebrow text-ink hover:bg-paper-deep"
                  >
                    Save notes
                  </button>
                </form>

                {/* Quick actions */}
                <div className="mt-5 flex flex-wrap gap-2">
                  {!isClosed ? (
                    <>
                      <ActionButton
                        actionFn={triageInquiryCustomAction.bind(null, inq.id)}
                        label="Convert to /custom engagement"
                        tone={
                          inq.status === "TRIAGED_CUSTOM"
                            ? "active"
                            : "default"
                        }
                      />
                      <ActionButton
                        actionFn={triageInquiryMaxAction.bind(null, inq.id)}
                        label="Mark workspace as Max"
                        tone={
                          inq.status === "TRIAGED_MAX" ? "active" : "primary"
                        }
                      />
                      <ActionButton
                        actionFn={triageInquiryBothAction.bind(null, inq.id)}
                        label="Both"
                        tone={
                          inq.status === "TRIAGED_BOTH"
                            ? "active"
                            : "default"
                        }
                      />
                      <ActionButton
                        actionFn={markInquiryConvertedAction.bind(null, inq.id)}
                        label="Mark converted"
                        tone="muted"
                      />
                      <ActionButton
                        actionFn={declineInquiryAction.bind(null, inq.id)}
                        label="Decline"
                        tone="muted"
                      />
                    </>
                  ) : (
                    <ActionButton
                      actionFn={reopenInquiryAction.bind(null, inq.id)}
                      label="Reopen"
                      tone="default"
                    />
                  )}
                </div>

                {inq.status === "TRIAGED_MAX" || inq.status === "TRIAGED_BOTH" ? (
                  <p className="mt-4 border-l-2 border-clay bg-paper-deep p-3 font-mono text-[11px] leading-relaxed text-mute">
                    Next step: provision workspace + invoice manually
                    against the existing custom-build product. Workspace
                    creation lives outside this surface — see the workspace
                    provisioning flow in{" "}
                    <code className="font-mono text-[11px]">lib/billing/provisioning.ts</code>
                    .
                  </p>
                ) : null}
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
  tone: "primary" | "default" | "muted" | "active";
}) {
  const className =
    tone === "primary"
      ? "border border-ink bg-ink px-3 py-1.5 font-mono text-[12px] uppercase tracking-eyebrow text-paper hover:bg-ink-soft"
      : tone === "active"
        ? "border border-ink bg-paper-deep px-3 py-1.5 font-mono text-[12px] uppercase tracking-eyebrow text-ink"
        : tone === "muted"
          ? "border border-rule bg-paper px-3 py-1.5 font-mono text-[12px] uppercase tracking-eyebrow text-mute hover:bg-paper-deep"
          : "border border-rule bg-paper px-3 py-1.5 font-mono text-[12px] uppercase tracking-eyebrow text-ink hover:bg-paper-deep";
  return (
    <form action={actionFn}>
      <button type="submit" className={className}>
        {label}
      </button>
    </form>
  );
}
