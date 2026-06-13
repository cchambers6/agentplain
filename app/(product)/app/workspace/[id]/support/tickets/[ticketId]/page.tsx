import Link from "next/link";
import { notFound } from "next/navigation";
import { requireWorkspaceMember } from "@/lib/auth/server";
import { servicePartnerForWorkspace } from "@/lib/onboarding/service-partner";
import {
  PrismaTicketStore,
  formatTicketNumber,
  isSlaBreached,
} from "@/lib/support/tickets";
import { TicketThread } from "@/components/support/TicketThread";
import {
  TicketStatusBadge,
  TicketPriorityBadge,
  categoryLabel,
} from "@/components/support/TicketBadges";
import { CustomerReplyForm } from "./CustomerReplyForm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface PageProps {
  params: Promise<{ id: string; ticketId: string }>;
}

function slaLine(
  firstResponseDueAt: Date | null,
  firstRespondedAt: Date | null,
  now: Date,
): { tone: "ok" | "warn"; text: string } {
  if (firstRespondedAt) {
    return { tone: "ok", text: "A teammate has replied — see the thread below." };
  }
  if (!firstResponseDueAt) {
    return { tone: "ok", text: "We'll reply by email as soon as we can." };
  }
  if (isSlaBreached(firstResponseDueAt, firstRespondedAt, now)) {
    // Honest, not chirpy — we're past the window and we own it.
    return {
      tone: "warn",
      text: "We're past our target response time on this one — it's flagged for a teammate now. Sorry for the wait.",
    };
  }
  const when = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(firstResponseDueAt);
  return {
    tone: "ok",
    text: `Expected first response by ${when}.`,
  };
}

export default async function CustomerTicketPage({ params }: PageProps) {
  const { id: workspaceId, ticketId } = await params;
  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);
  const partner = servicePartnerForWorkspace(workspaceId);
  const basePath = `/app/workspace/${workspaceId}`;

  const ticket = await new PrismaTicketStore().loadTicketForCustomer(
    workspaceId,
    ticketId,
    { userId: member.userId, isOperator: member.isOperator },
  );
  if (!ticket) notFound();

  const sla = slaLine(
    ticket.firstResponseDueAt,
    ticket.firstRespondedAt,
    new Date(),
  );

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href={`${basePath}/support/tickets`}
        className="font-mono text-[11px] uppercase tracking-eyebrow text-mute underline-offset-4 hover:text-ink hover:underline"
      >
        ← my tickets
      </Link>

      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[12px] text-mute">
            {formatTicketNumber(ticket.number)}
          </p>
          <h1 className="mt-1 font-display text-2xl leading-tight text-ink">
            {ticket.subject}
          </h1>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-eyebrow text-mute">
            {categoryLabel(ticket.category)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <TicketStatusBadge status={ticket.status} />
          <TicketPriorityBadge priority={ticket.priority} />
        </div>
      </div>

      <div
        role="status"
        className={[
          "mt-5 border p-4 text-[14px] leading-relaxed",
          sla.tone === "warn"
            ? "border-flag/50 bg-flag/10 text-ink"
            : "border-rule bg-paper-deep text-ink",
        ].join(" ")}
      >
        {sla.text}
      </div>

      <div className="mt-8">
        <TicketThread messages={ticket.messages} partnerName={partner} />
      </div>

      {ticket.status !== "CLOSED" ? (
        <div className="mt-8 border-t border-rule pt-6">
          <CustomerReplyForm workspaceId={workspaceId} ticketId={ticketId} />
        </div>
      ) : (
        <p className="mt-8 border-t border-rule pt-6 text-[14px] text-mute">
          This ticket is closed.{" "}
          <Link
            href={`${basePath}/support/new`}
            className="text-ink underline underline-offset-4 hover:text-clay"
          >
            Open a new one
          </Link>{" "}
          if you need more help.
        </p>
      )}
    </div>
  );
}
