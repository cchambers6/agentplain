"use server";

import { revalidatePath } from "next/cache";
import { getPortalContext } from "@/lib/portal/server";
import { ensurePortalThread, runPortalChatTurn } from "@/lib/portal/chat";

export interface PortalChatActionResult {
  ok: boolean;
  /** Friendly status shown after a successful send. */
  notice?: string;
  /** Field/blocking error. */
  error?: string;
}

/**
 * End-client chat send. Persists the client's message and queues Plaino's
 * drafted reply for owner approval (it never reaches the client until the owner
 * approves). The client sees a calm "on its way" notice — the gating is
 * invisible to them by design.
 */
export async function sendPortalMessageAction(
  slug: string,
  _prev: PortalChatActionResult | undefined,
  form: FormData,
): Promise<PortalChatActionResult> {
  const body = typeof form.get("body") === "string" ? (form.get("body") as string) : "";
  if (!body.trim()) return { ok: false, error: "Type a message to send." };

  const ctx = await getPortalContext(slug);
  if (!ctx) return { ok: false, error: "This portal isn't available." };
  if (!ctx.signedIn) {
    return { ok: false, error: "Your session has expired — open your portal link again." };
  }

  const threadId = await ensurePortalThread({
    portalConfigId: ctx.brand.portalConfigId,
    clientId: ctx.signedIn.clientId,
    caseId: null,
  });

  const result = await runPortalChatTurn(
    {
      portalConfigId: ctx.brand.portalConfigId,
      workspaceId: ctx.workspaceId,
      clientId: ctx.signedIn.clientId,
      clientEmail: ctx.signedIn.email,
      brandName: ctx.brand.brandName,
      threadId,
    },
    body,
  );

  revalidatePath(`/portal/${slug}/chat`);

  if (result.ok) {
    return {
      ok: true,
      notice: `Thanks — your message is with the ${ctx.brand.brandName} team. You'll see their reply here.`,
    };
  }
  // Degraded / draft-failed / empty all surface the same calm acknowledgment:
  // the client's message WAS saved; only Plaino's auto-draft didn't run.
  return { ok: true, notice: result.customerNotice };
}
