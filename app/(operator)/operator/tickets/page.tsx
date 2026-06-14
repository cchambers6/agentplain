import Link from "next/link";
import {
  PrismaTicketStore,
  formatTicketNumber,
  isSlaBreached,
  TICKET_STATUSES,
  TICKET_PRIORITIES,
  type StaffTicketFilter,
  type TicketStatus,
  type TicketPriority,
} from "@/lib/support/tickets";
import {
  TicketStatusBadge,
  TicketPriorityBadge,
  categoryLabel,
} from "@/components/support/TicketBadges";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface PageProps {
  searchParams: Promise<{ status?: string; priority?: string; vertical?: string }>;
}

// Staff support inbox. The operator (admin) console's home for the customer-
// facing ticket lifecycle. Gated to operators by app/(operator)/layout.tsx.
export default async function OperatorTicketsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const filter: StaffTicketFilter = {};
  if (sp.status && (TICKET_STATUSES as readonly string[]).includes(sp.status))
    filter.status = sp.status as TicketStatus;
  if (sp.priority && (TICKET_PRIORITIES as readonly string[]).includes(sp.priority))
    filter.priority = sp.priority as TicketPriority;
  if (sp.vertical) filter.vertical = sp.vertical;

  const tickets = await new PrismaTicketStore().listTicketsForStaff(filter);
  const now = new Date();
  const openCount = tickets.filter(
    (t) => t.status !== "RESOLVED" && t.status !== "CLOSED",
  ).length;
  const breachedCount = tickets.filter((t) =>
    isSlaBreached(t.firstResponseDueAt, t.firstRespondedAt, now),
  ).length;

  return (
    <div className="container-wide py-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl text-ink">Support tickets</h1>
          <p className="mt-1 text-[13px] text-mute">
            {openCount} open · {breachedCount} past first-response SLA
          </p>
        </div>
      </div>

      <FilterBar active={sp} />

      {tickets.length === 0 ? (
        <p className="mt-8 border border-rule bg-paper-deep p-6 text-[14px] text-ink-soft">
          No tickets match this filter.
        </p>
      ) : (
        <table className="mt-6 w-full border-collapse text-[14px]">
          <thead>
            <tr className="border-b border-rule text-left font-mono text-[11px] uppercase tracking-eyebrow text-mute">
              <th className="py-2 pr-3">#</th>
              <th className="py-2 pr-3">Subject</th>
              <th className="py-2 pr-3">Category</th>
              <th className="py-2 pr-3">Priority</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Workspace</th>
              <th className="py-2 pr-3">Assigned</th>
              <th className="py-2 pr-3">SLA</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((t) => {
              const breached = isSlaBreached(
                t.firstResponseDueAt,
                t.firstRespondedAt,
                now,
              );
              return (
                <tr key={t.id} className="border-b border-rule/60 align-top">
                  <td className="py-3 pr-3 font-mono text-[12px] text-mute">
                    {formatTicketNumber(t.number)}
                  </td>
                  <td className="py-3 pr-3">
                    <Link
                      href={`/operator/tickets/${t.id}`}
                      className="text-ink underline-offset-4 hover:text-clay hover:underline"
                    >
                      {t.subject}
                    </Link>
                  </td>
                  <td className="py-3 pr-3 text-ink-soft">
                    {categoryLabel(t.category)}
                  </td>
                  <td className="py-3 pr-3">
                    <TicketPriorityBadge priority={t.priority} />
                  </td>
                  <td className="py-3 pr-3">
                    <TicketStatusBadge status={t.status} audience="staff" />
                  </td>
                  <td className="py-3 pr-3 text-ink-soft">
                    {t.workspaceName ?? "—"}
                  </td>
                  <td className="py-3 pr-3 text-ink-soft">
                    {t.assignedTo ?? "—"}
                  </td>
                  <td className="py-3 pr-3">
                    {t.firstRespondedAt ? (
                      <span className="font-mono text-[11px] text-mute">
                        responded
                      </span>
                    ) : breached ? (
                      <span className="font-mono text-[11px] text-flag">
                        BREACHED
                      </span>
                    ) : (
                      <span className="font-mono text-[11px] text-mute">
                        {t.firstResponseDueAt
                          ? new Intl.DateTimeFormat("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                            }).format(t.firstResponseDueAt)
                          : "—"}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function FilterBar({
  active,
}: {
  active: { status?: string; priority?: string };
}) {
  const link = (params: Record<string, string>) => {
    const q = new URLSearchParams(params).toString();
    return q ? `/operator/tickets?${q}` : "/operator/tickets";
  };
  return (
    <div className="mt-5 flex flex-wrap gap-x-6 gap-y-3 border-y border-rule py-3 text-[13px]">
      <div className="flex items-center gap-3">
        <span className="font-mono text-[11px] uppercase tracking-eyebrow text-mute">
          status
        </span>
        <Link href={link({})} className={active.status ? "text-mute hover:text-ink" : "text-ink"}>
          all
        </Link>
        {TICKET_STATUSES.map((s) => (
          <Link
            key={s}
            href={link({ status: s })}
            className={active.status === s ? "text-clay" : "text-mute hover:text-ink"}
          >
            {s.toLowerCase().replace(/_/g, " ")}
          </Link>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <span className="font-mono text-[11px] uppercase tracking-eyebrow text-mute">
          priority
        </span>
        {TICKET_PRIORITIES.map((p) => (
          <Link
            key={p}
            href={link({ priority: p })}
            className={active.priority === p ? "text-clay" : "text-mute hover:text-ink"}
          >
            {p}
          </Link>
        ))}
      </div>
    </div>
  );
}
