"use server";

import { requireWorkspaceMember } from "@/lib/auth/server";
import { withSystemContext } from "@/lib/db/rls";
import { servicePartnerForWorkspace } from "@/lib/onboarding/service-partner";
import {
  createSupportTicket,
  buildTicketContext,
  PrismaTicketStore,
  PageHumanTicketNotifier,
  type TicketCategory,
} from "@/lib/support/tickets";

export interface NewTicketActionResult {
  ok: boolean;
  formError?: string;
  fieldErrors?: Partial<Record<"subject" | "category" | "description", string>>;
  /** On success: where to send the customer (their new ticket page). */
  ticketId?: string;
  number?: number;
  slaWindowLabel?: string;
}

const formString = (form: FormData, key: string): string => {
  const v = form.get(key);
  return typeof v === "string" ? v : "";
};

export async function createTicketAction(
  workspaceId: string,
  _prev: NewTicketActionResult | undefined,
  form: FormData,
): Promise<NewTicketActionResult> {
  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);

  const workspace = await withSystemContext((tx) =>
    tx.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true },
    }),
  );

  // Best-effort context snapshot — never blocks creation.
  const context = await buildTicketContext(workspaceId);

  const result = await createSupportTicket(
    {
      workspaceId,
      userId: member.userId,
      fromEmail: member.email,
      fromName: null,
      workspaceName: workspace?.name ?? "your workspace",
      subject: formString(form, "subject"),
      category: formString(form, "category") as TicketCategory,
      description: formString(form, "description"),
    },
    {
      store: new PrismaTicketStore(),
      notifier: new PageHumanTicketNotifier(),
      context,
      partnerName: servicePartnerForWorkspace(workspaceId),
    },
  );

  if (!result.ok) {
    return {
      ok: false,
      formError: result.code === "VALIDATION" ? undefined : result.message,
      fieldErrors: result.fieldErrors,
    };
  }

  return {
    ok: true,
    ticketId: result.value.ticketId,
    number: result.value.number,
    slaWindowLabel: result.value.slaWindowLabel,
  };
}
