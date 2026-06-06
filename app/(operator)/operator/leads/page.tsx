// /operator/leads — triage surface for marketing Plaino-widget lead captures.
//
// When an anonymous site conversation produces qualified intent, the widget
// posts to /api/leads/capture and a LeadCapture row lands here. Operator
// reads the row + the intent, reaches out out-of-band, and flips status.
//
// Per project_no_outbound_architecture.md: no email fires from triage — the
// actions only record status + triaging operator on the row.

import type { LeadCaptureStatus } from "@prisma/client";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/server";
import { withSystemContext } from "@/lib/db/rls";
import {
  declineLeadAction,
  markLeadContactedAction,
  markLeadConvertedAction,
  reopenLeadAction,
} from "./actions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STATUS_FILTER_OPTIONS = [
  { value: "open", label: "Open (new + contacted)" },
  { value: "new", label: "New only" },
  { value: "contacted", label: "Contacted" },
  { value: "closed", label: "Closed (converted + declined)" },
  { value: "all", label: "All" },
] as const;

const STATUS_LABEL: Record<LeadCaptureStatus, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  CONVERTED: "Converted",
  DECLINED: "Declined",
};

const STATUS_TONE: Record<LeadCaptureStatus, string> = {
  NEW: "border-clay bg-paper text-ink",
  CONTACTED: "border-ink bg-paper-deep text-ink",
  CONVERTED: "border-rule bg-paper text-ink-soft",
  DECLINED: "border-rule bg-paper text-mute",
};

interface PageProps {
  searchParams: Promise<{ status?: string; cohort?: string }>;
}

function statusesFor(filter: string): LeadCaptureStatus[] | null {
  switch (filter) {
    case "new":
      return ["NEW"];
    case "contacted":
      return ["CONTACTED"];
    case "closed":
      return ["CONVERTED", "DECLINED"];
    case "all":
      return null;
    case "open":
    default:
      return ["NEW", "CONTACTED"];
  }
}

export default async function OperatorLeadsPage({ searchParams }: PageProps) {
  const session = await requireUser();
  if (!session.isOperator) redirect("/app");

  const { status: statusParam, cohort: cohortParam } = await searchParams;
  const filter = statusParam ?? "open";
  const statuses = statusesFor(filter);
  // Orthogonal cohort filter — the Claude-SBM comparison prospects, per
  // project_sbm_wrapper_positioning_2026_06_06. Composes with the status
  // filter so the operator can see, e.g., open leads that asked about Claude.
  const claudeOnly = cohortParam === "claude";

  const leads = await withSystemContext((tx) =>
    tx.leadCapture.findMany({
      where: {
        ...(statuses ? { status: { in: statuses } } : {}),
        ...(claudeOnly ? { askedAboutClaude: true } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  );

  return (
    <div className="container-wide py-8">
      <p className="eyebrow mb-2 text-clay">operator · leads</p>
      <h1 className="font-display text-4xl leading-tight text-ink">
        Marketing leads
      </h1>
      <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-ink-soft">
        Captured by the site&rsquo;s Plaino widget when a conversation produced
        real intent. Reach out from your own inbox — nothing here sends. Flip
        the status as you work each one.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {STATUS_FILTER_OPTIONS.map((opt) => {
          const active = opt.value === filter;
          const href = claudeOnly
            ? `/operator/leads?status=${opt.value}&cohort=claude`
            : `/operator/leads?status=${opt.value}`;
          return (
            <a
              key={opt.value}
              href={href}
              className={`border px-3 py-1.5 font-mono text-[11px] uppercase tracking-eyebrow ${
                active
                  ? "border-ink bg-paper-deep text-ink"
                  : "border-rule bg-paper text-mute hover:border-ink-soft"
              }`}
            >
              {opt.label}
            </a>
          );
        })}
      </div>

      {/* Cohort filter — orthogonal to status. Tracks the Claude-SBM
          comparison prospects per project_sbm_wrapper_positioning_2026_06_06. */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-eyebrow text-mute">
          Cohort
        </span>
        <a
          href={`/operator/leads?status=${filter}`}
          className={`border px-3 py-1.5 font-mono text-[11px] uppercase tracking-eyebrow ${
            !claudeOnly
              ? "border-ink bg-paper-deep text-ink"
              : "border-rule bg-paper text-mute hover:border-ink-soft"
          }`}
        >
          All leads
        </a>
        <a
          href={`/operator/leads?status=${filter}&cohort=claude`}
          className={`border px-3 py-1.5 font-mono text-[11px] uppercase tracking-eyebrow ${
            claudeOnly
              ? "border-clay bg-paper-deep text-ink"
              : "border-rule bg-paper text-mute hover:border-ink-soft"
          }`}
        >
          Asked about Claude
        </a>
      </div>

      {leads.length === 0 ? (
        <p className="mt-10 border border-rule bg-paper-deep p-6 text-[15px] text-ink-soft">
          No leads in this view yet.
        </p>
      ) : (
        <ul className="mt-8 space-y-4">
          {leads.map((lead) => (
            <li key={lead.id} className="border border-rule bg-paper p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-display text-xl text-ink">{lead.email}</p>
                  <p className="mt-1 font-mono text-[11px] uppercase tracking-eyebrow text-mute">
                    {lead.name ? `${lead.name} · ` : ""}
                    {lead.business ? `${lead.business} · ` : ""}
                    {lead.vertical ? `${lead.vertical} · ` : ""}
                    {new Date(lead.createdAt).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {lead.askedAboutClaude ? (
                    <span className="border border-clay bg-paper px-2 py-1 font-mono text-[10px] uppercase tracking-eyebrow text-clay">
                      Asked about Claude
                    </span>
                  ) : null}
                  <span
                    className={`border px-2 py-1 font-mono text-[10px] uppercase tracking-eyebrow ${STATUS_TONE[lead.status]}`}
                  >
                    {STATUS_LABEL[lead.status]}
                  </span>
                </div>
              </div>

              <p className="mt-3 whitespace-pre-wrap border-l-2 border-rule pl-3 text-[15px] leading-relaxed text-ink">
                {lead.intent}
              </p>

              {lead.sourcePage ? (
                <p className="mt-2 font-mono text-[11px] text-mute">
                  from {lead.sourcePage}
                </p>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                <LeadAction
                  leadId={lead.id}
                  action={markLeadContactedAction}
                  label="Mark contacted"
                />
                <LeadAction
                  leadId={lead.id}
                  action={markLeadConvertedAction}
                  label="Mark converted"
                />
                <LeadAction
                  leadId={lead.id}
                  action={declineLeadAction}
                  label="Decline"
                />
                <LeadAction
                  leadId={lead.id}
                  action={reopenLeadAction}
                  label="Reopen"
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Small server-action button. Binds the lead id so each row's actions post
// independently.
function LeadAction({
  leadId,
  action,
  label,
}: {
  leadId: string;
  action: (leadId: string) => Promise<void>;
  label: string;
}) {
  return (
    <form action={action.bind(null, leadId)}>
      <button
        type="submit"
        className="border border-rule bg-paper px-3 py-1.5 font-mono text-[11px] uppercase tracking-eyebrow text-ink-soft transition hover:border-ink"
      >
        {label}
      </button>
    </form>
  );
}
