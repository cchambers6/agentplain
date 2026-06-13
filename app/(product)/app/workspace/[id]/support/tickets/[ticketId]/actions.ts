"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspaceMember } from "@/lib/auth/server";
import { PrismaTicketStore } from "@/lib/support/tickets";

export interface CustomerReplyResult {
  ok: boolean;
  error?: string;
}

const formString = (form: FormData, key: string): string => {
  const v = form.get(key);
  return typeof v === "string" ? v : "";
};

// A customer reply re-opens the ticket (ball back to the team) and posts a
// CUSTOMER message under the member's own RLS context. Writes through the
// store; the staff inbox sees it immediately.
export async function customerReplyAction(
  workspaceId: string,
  ticketId: string,
  _prev: CustomerReplyResult | undefined,
  form: FormData,
): Promise<CustomerReplyResult> {
  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);
  const body = formString(form, "body").trim();
  if (body.length === 0) {
    return { ok: false, error: "Type a message before sending." };
  }

  const store = new PrismaTicketStore();
  // Confirm the ticket belongs to this workspace (and is visible to the
  // member) before posting — defense in depth on top of RLS.
  const ticket = await store.loadTicketForCustomer(workspaceId, ticketId, {
    userId: member.userId,
    isOperator: member.isOperator,
  });
  if (!ticket) {
    return { ok: false, error: "We couldn't find that ticket." };
  }
  if (ticket.status === "CLOSED") {
    return {
      ok: false,
      error: "This ticket is closed. Open a new one and we'll pick it up.",
    };
  }

  try {
    await store.addMessage({
      ticketId,
      workspaceId,
      author: "CUSTOMER",
      authorUserId: member.userId,
      body,
      internal: false,
      // Reopen unless it's already an active staff-working state.
      advanceStatusTo:
        ticket.status === "RESOLVED" || ticket.status === "WAITING_ON_CUSTOMER"
          ? "OPEN"
          : undefined,
      viewer: { userId: member.userId, isOperator: member.isOperator },
    });
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not send your reply.",
    };
  }

  revalidatePath(`/app/workspace/${workspaceId}/support/tickets/${ticketId}`);
  return { ok: true };
}
