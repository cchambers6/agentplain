import Link from "next/link";
import { notFound } from "next/navigation";
import {
  PrismaTicketStore,
  formatTicketNumber,
  isSlaBreached,
  TICKET_STATUSES,
  TICKET_PRIORITIES,
} from "@/lib/support/tickets";
import { servicePartnerForWorkspace } from "@/lib/onboarding/service-partner";
import { TicketThread } from "@/components/support/TicketThread";
import {
  TicketStatusBadge,
  TicketPriorityBadge,
  categoryLabel,
} from "@/components/support/TicketBadges";
import {
  staffReplyAction,
  staffNoteAction,
  staffUpdateTicketAction,
} from "../actions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface PageProps {
  params: Promise<{ ticketId: string }>;
}

const FIELD =
  "mt-1 block w-full border border-rule bg-paper px-3 py-2 text-[14px] text-ink outline-none focus:border-ink";
const SELECT = FIELD;
const BTN =
  "border border-ink bg-ink px-4 py-2 font-mono text-[12px] uppercase tracking-eyebrow text-paper transition hover:bg-clay hover:border-clay";
const BTN_GHOST =
  "border border-rule bg-paper px-4 py-2 font-mono text-[12px] uppercase tracking-eyebrow text-ink transition hover:border-ink";

export default async function OperatorTicketDetailPage({ params }: PageProps) {
  const { ticketId } = await params;
  const ticket = await new PrismaTicketStore().loadTicketForStaff(ticketId);
  if (!ticket) notFound();

  const partner = servicePartnerForWorkspace(ticket.workspaceId);
  const breached = isSlaBreached(
    ticket.firstResponseDueAt,
    ticket.firstRespondedAt,
    new Date(),
  );
  const ctx = ticket.context;

  return (
    <div className="container-wide py-8">
      <Link
        href="/operator/tickets"
        className="font-mono text-[11px] uppercase tracking-eyebrow text-mute underline-offset-4 hover:text-ink hover:underline"
      >
        ← all tickets
      </Link>

      <div className="mt-4 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
        {/* Main column: header + thread + reply/note */}
        <div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[12px] text-mute">
                {formatTicketNumber(ticket.number)}
              </p>
              <h1 className="mt-1 font-display text-2xl leading-tight text-ink">
                {ticket.subject}
              </h1>
              <p className="mt-1 font-mono text-[11px] uppercase tracking-eyebrow text-mute">
                {categoryLabel(ticket.category)} · from{" "}
                {ticket.openedByEmail ?? "unknown (account removed)"}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <TicketStatusBadge status={ticket.status} audience="staff" />
              <TicketPriorityBadge priority={ticket.priority} />
              {breached ? (
                <span className="font-mono text-[11px] text-flag">
                  SLA BREACHED
                </span>
              ) : null}
            </div>
          </div>

          <div className="mt-8">
            <TicketThread
              messages={ticket.messages}
              partnerName={partner}
              staffView
            />
          </div>

          {/* Reply to customer */}
          <form
            action={staffReplyAction.bind(null, ticketId)}
            className="mt-8 border-t border-rule pt-6"
          >
            <label className="block">
              <span className="font-mono text-[11px] uppercase tracking-eyebrow text-mute">
                reply to customer
              </span>
              <textarea
                name="body"
                rows={4}
                required
                className={`${FIELD} resize-y leading-relaxed`}
              />
            </label>
            <p className="mt-2 text-[12px] text-mute">
              Sends an email to {ticket.openedByEmail ?? "the customer"} and
              moves the ticket to “waiting on customer”.
            </p>
            <button type="submit" className={`${BTN} mt-3`}>
              send reply
            </button>
          </form>

          {/* Internal note */}
          <form
            action={staffNoteAction.bind(null, ticketId)}
            className="mt-6 border-t border-rule pt-6"
          >
            <label className="block">
              <span className="font-mono text-[11px] uppercase tracking-eyebrow text-mute">
                internal note (staff only)
              </span>
              <textarea
                name="body"
                rows={3}
                required
                className={`${FIELD} resize-y leading-relaxed`}
              />
            </label>
            <button type="submit" className={`${BTN_GHOST} mt-3`}>
              add internal note
            </button>
          </form>
        </div>

        {/* Side column: lifecycle controls + context snapshot */}
        <aside className="space-y-6">
          <form
            action={staffUpdateTicketAction.bind(null, ticketId)}
            className="border border-rule bg-paper-deep p-4"
          >
            <h2 className="font-mono text-[11px] uppercase tracking-eyebrow text-mute">
              manage
            </h2>
            <label className="mt-3 block">
              <span className="text-[12px] text-ink-soft">Status</span>
              <select name="status" defaultValue={ticket.status} className={SELECT}>
                {TICKET_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.toLowerCase().replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-3 block">
              <span className="text-[12px] text-ink-soft">Priority</span>
              <select
                name="priority"
                defaultValue={ticket.priority}
                className={SELECT}
              >
                {TICKET_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-3 block">
              <span className="text-[12px] text-ink-soft">
                Assigned to (email)
              </span>
              <input
                type="email"
                name="assignedTo"
                defaultValue={ticket.assignedTo ?? ""}
                className={FIELD}
                placeholder="staff@agentplain.com"
              />
            </label>
            <label className="mt-3 block">
              <span className="text-[12px] text-ink-soft">Note (optional)</span>
              <input name="reason" className={FIELD} />
            </label>
            <button type="submit" className={`${BTN} mt-4 w-full`}>
              update ticket
            </button>
          </form>

          <div className="border border-rule bg-paper p-4 text-[13px] leading-relaxed">
            <h2 className="font-mono text-[11px] uppercase tracking-eyebrow text-mute">
              workspace context
            </h2>
            <dl className="mt-3 space-y-2 text-ink-soft">
              <Row label="Vertical" value={ctx?.vertical ?? "—"} />
              <Row label="Plan" value={ctx?.plan ?? "—"} />
              <Row label="Plaino" value={ctx?.plainoState ?? "—"} />
              <Row
                label="Integrations"
                value={
                  ctx && ctx.integrationsConnected.length > 0
                    ? ctx.integrationsConnected.join(", ")
                    : "none"
                }
              />
            </dl>
            {ctx && ctx.recentQueueItems.length > 0 ? (
              <div className="mt-3">
                <span className="text-[12px] text-mute">Recent queue items</span>
                <ul className="mt-1 list-disc pl-4 text-ink-soft">
                  {ctx.recentQueueItems.map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <p className="mt-3 font-mono text-[10px] text-mute">
              workspace {ticket.workspaceId}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-mute">{label}</dt>
      <dd className="text-right text-ink">{value}</dd>
    </div>
  );
}
