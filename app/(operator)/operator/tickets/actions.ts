"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/server";
import { getEmailProvider } from "@/lib/email";
import { env } from "@/lib/env";
import {
  PrismaTicketStore,
  formatTicketNumber,
  type TicketPriority,
  type TicketStatus,
} from "@/lib/support/tickets";
import { bodyToHtml } from "@/lib/support/resolve-reply";

const formString = (form: FormData, key: string): string => {
  const v = form.get(key);
  return typeof v === "string" ? v : "";
};

function ticketPath(ticketId: string): string {
  return `/operator/tickets/${ticketId}`;
}

/**
 * Staff reply to the customer. Mirrors the resolve-reply send ordering: we
 * SEND the email FIRST, then persist the STAFF message + advance status — so
 * a send failure leaves the ticket un-replied and retryable rather than
 * silently recording a reply that never went out. The reply email is the
 * operator-gated outbound (a human typed + clicked send), consistent with
 * project_no_outbound_architecture.
 */
export async function staffReplyAction(
  ticketId: string,
  form: FormData,
): Promise<void> {
  const session = await requireUser();
  if (!session.isOperator) return;

  const body = formString(form, "body").trim();
  if (body.length === 0) return;

  const store = new PrismaTicketStore();
  const ticket = await store.loadTicketForStaff(ticketId);
  if (!ticket) return;

  // Send first (when we have a recipient). A missing customer email (user
  // since deleted) still posts the reply to the thread for the record.
  if (ticket.openedByEmail) {
    try {
      await getEmailProvider().send({
        to: ticket.openedByEmail,
        subject: `Re: [${formatTicketNumber(ticket.number)}] ${ticket.subject}`,
        text: body,
        html: bodyToHtml(body),
        replyTo: env.supportEmail(),
        tags: {
          surface: "support-ticket-reply",
          workspace_id: ticket.workspaceId,
          ticket_id: ticketId,
        },
      });
    } catch {
      // Surface as a no-op (the page re-renders unchanged); the operator
      // sees the reply wasn't posted and can retry. We deliberately do NOT
      // persist a STAFF message we couldn't deliver.
      return;
    }
  }

  await store.addMessage({
    ticketId,
    workspaceId: ticket.workspaceId,
    author: "STAFF",
    authorUserId: session.userId,
    body,
    internal: false,
    advanceStatusTo: "WAITING_ON_CUSTOMER",
    viewer: "system",
  });
  revalidatePath(ticketPath(ticketId));
}

/** Add an internal note — staff-only, never shown to the customer. */
export async function staffNoteAction(
  ticketId: string,
  form: FormData,
): Promise<void> {
  const session = await requireUser();
  if (!session.isOperator) return;
  const body = formString(form, "body").trim();
  if (body.length === 0) return;

  const store = new PrismaTicketStore();
  const ticket = await store.loadTicketForStaff(ticketId);
  if (!ticket) return;

  await store.addMessage({
    ticketId,
    workspaceId: ticket.workspaceId,
    author: "STAFF",
    authorUserId: session.userId,
    body,
    internal: true,
    viewer: "system",
  });
  revalidatePath(ticketPath(ticketId));
}

/** Apply a lifecycle change: status, priority, and/or re-route to another
 *  staff member. */
export async function staffUpdateTicketAction(
  ticketId: string,
  form: FormData,
): Promise<void> {
  const session = await requireUser();
  if (!session.isOperator) return;

  const status = formString(form, "status");
  const priority = formString(form, "priority");
  const assignedTo = formString(form, "assignedTo").trim();
  const reason = formString(form, "reason").trim();

  await new PrismaTicketStore().updateTicket({
    ticketId,
    status: status ? (status as TicketStatus) : undefined,
    priority: priority ? (priority as TicketPriority) : undefined,
    assignedTo: assignedTo.length > 0 ? assignedTo : undefined,
    operatorUserId: session.userId,
    reason: reason || undefined,
  });
  revalidatePath(ticketPath(ticketId));
}
